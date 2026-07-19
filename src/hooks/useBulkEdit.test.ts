import { describe, expect, it } from 'vitest'
import { runBulkEdit, type BulkEditApi, type BulkEditTarget } from './useBulkEdit'
import { createMockBulkEditApi } from '../lib/bulkEditApi.mock'
import { createCrmStore } from '../lib/crmStore.mock'

const CHANGE = { field: 'lifecycle_stage', value: 'evangelist' }

function contactTargets(store: ReturnType<typeof createCrmStore>): BulkEditTarget[] {
  return store.list('contacts').map(c => ({ id: c.id, label: `${c.first_name} ${c.last_name}` }))
}

describe('runBulkEdit', () => {
  it('splits targets into batches, numbers them 1-based, and reports progress', async () => {
    const batchOrdinals: number[][] = []
    const progress: number[] = []
    const api: BulkEditApi = {
      async applyBatch(_entity, items) {
        batchOrdinals.push(items.map(i => i.ordinal))
        return items.map(i => ({ id: i.id, label: i.label, ok: true }))
      },
    }
    const targets = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, label: `row ${i}` }))

    const summary = await runBulkEdit(api, 'contacts', targets, CHANGE, {
      batchSize: 2,
      onProgress: p => progress.push(p.processed),
    })

    expect(batchOrdinals).toEqual([[1, 2], [3, 4], [5]])
    expect(progress).toEqual([2, 4, 5])
    expect(summary).toMatchObject({ total: 5, edited: 5, failed: 0, cancelled: false })
  })

  it('applies the change to every record in the store when nothing fails', async () => {
    const store = createCrmStore()
    const api = createMockBulkEditApi({ latencyMsPerBatch: 0, failEveryNth: 0, store })

    const summary = await runBulkEdit(api, 'contacts', contactTargets(store), CHANGE, { batchSize: 3 })

    expect(summary).toMatchObject({ total: 8, edited: 8, failed: 0, cancelled: false })
    expect(store.list('contacts').every(c => c.lifecycle_stage === 'evangelist')).toBe(true)
  })

  it('fails every Nth selected row deterministically and leaves those records unchanged', async () => {
    const store = createCrmStore()
    const api = createMockBulkEditApi({ latencyMsPerBatch: 0, failEveryNth: 3, store })
    const targets = contactTargets(store)

    const summary = await runBulkEdit(api, 'contacts', targets, CHANGE, { batchSize: 4 })

    // 8 targets; ordinals 3 and 6 fail.
    expect(summary.edited).toBe(6)
    expect(summary.failed).toBe(2)
    const failed = summary.results.filter(r => !r.ok)
    expect(failed.map(r => r.id)).toEqual([targets[2].id, targets[5].id])
    for (const failure of failed) {
      expect(failure.error).toContain('simulated contacts edit rejection')
    }
    const byId = new Map(store.list('contacts').map(c => [c.id, c.lifecycle_stage]))
    expect(byId.get(targets[2].id)).toBe('customer')  // seed value untouched
    expect(byId.get(targets[5].id)).toBe('prospect')  // seed value untouched
    expect(byId.get(targets[0].id)).toBe('evangelist')

    // Same selection against a fresh store: identical outcome regardless of batch size.
    const store2 = createCrmStore()
    const again = await runBulkEdit(
      createMockBulkEditApi({ latencyMsPerBatch: 0, failEveryNth: 3, store: store2 }),
      'contacts',
      contactTargets(store2),
      CHANGE,
      { batchSize: 7 },
    )
    expect(again.results.filter(r => !r.ok).map(r => r.id)).toEqual([targets[2].id, targets[5].id])
  })

  it('stops between batches when cancelled and leaves later records unchanged', async () => {
    const store = createCrmStore()
    const api = createMockBulkEditApi({ latencyMsPerBatch: 0, failEveryNth: 0, store })
    const controller = new AbortController()
    const targets = contactTargets(store)

    const summary = await runBulkEdit(api, 'contacts', targets, CHANGE, {
      batchSize: 3,
      signal: controller.signal,
      onProgress: p => { if (p.processed === 3) controller.abort() },
    })

    expect(summary.cancelled).toBe(true)
    expect(summary.results).toHaveLength(3)
    expect(summary.edited).toBe(3)
    expect(summary.total).toBe(8)
    const stages = store.list('contacts').map(c => c.lifecycle_stage)
    expect(stages.slice(0, 3)).toEqual(['evangelist', 'evangelist', 'evangelist'])
    expect(stages.slice(3)).toEqual(['lead', 'lead', 'prospect', 'lead', 'customer'])
  })

  it('treats an abort during mock latency as cancellation', async () => {
    const store = createCrmStore()
    const api = createMockBulkEditApi({ latencyMsPerBatch: 30, failEveryNth: 0, store })
    const controller = new AbortController()
    const pending = runBulkEdit(api, 'contacts', contactTargets(store), CHANGE, {
      batchSize: 4,
      signal: controller.signal,
    })
    controller.abort()
    const summary = await pending

    expect(summary.cancelled).toBe(true)
    expect(summary.results).toHaveLength(0)
    expect(store.list('contacts').every(c => c.lifecycle_stage !== 'evangelist')).toBe(true)
  })

  it('reports unknown ids as per-row failures without stopping the run', async () => {
    const store = createCrmStore()
    const api = createMockBulkEditApi({ latencyMsPerBatch: 0, failEveryNth: 0, store })
    const [first] = contactTargets(store)

    const summary = await runBulkEdit(api, 'contacts', [
      { id: 'con-missing', label: 'Missing Person' },
      first,
    ], CHANGE)

    expect(summary.edited).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.results[0]).toMatchObject({
      id: 'con-missing',
      ok: false,
      error: 'record not found in the demo dataset',
    })
  })

  it('marks a rejected batch as failed rows and continues with later batches', async () => {
    let call = 0
    const api: BulkEditApi = {
      async applyBatch(_entity, items) {
        call += 1
        if (call === 2) throw new Error('boom')
        return items.map(i => ({ id: i.id, label: i.label, ok: true }))
      },
    }
    const targets = Array.from({ length: 6 }, (_, i) => ({ id: `id-${i}`, label: `row ${i}` }))

    const summary = await runBulkEdit(api, 'accounts', targets, { field: 'status', value: 'inactive' }, { batchSize: 2 })

    expect(summary.cancelled).toBe(false)
    expect(summary.edited).toBe(4)
    expect(summary.failed).toBe(2)
    const failed = summary.results.filter(r => !r.ok)
    expect(failed.map(r => r.id)).toEqual(['id-2', 'id-3'])
    expect(failed[0].error).toBe('boom')
  })
})
