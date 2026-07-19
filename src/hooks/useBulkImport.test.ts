import { describe, expect, it } from 'vitest'
import { runBulkImport, type BulkImportApi } from './useBulkImport'
import type { ImportRecord } from '../lib/bulkImportCsv'
import { createMockBulkImportApi } from '../lib/bulkImportApi.mock'

/** Builds n records with spreadsheet rows 2..n+1 (row 1 is the header). */
function makeRecords(n: number): ImportRecord[] {
  return Array.from({ length: n }, (_, i) => ({ row: i + 2, values: { name: `record-${i + 2}` } }))
}

describe('runBulkImport', () => {
  it('splits records into batches and reports progress after each batch', async () => {
    const batchSizes: number[] = []
    const progress: number[] = []
    const api: BulkImportApi = {
      async importBatch(_entity, records) {
        batchSizes.push(records.length)
        return records.map(r => ({ row: r.row, ok: true }))
      },
    }

    const summary = await runBulkImport(api, 'contacts', makeRecords(5), {
      batchSize: 2,
      onProgress: p => progress.push(p.processed),
    })

    expect(batchSizes).toEqual([2, 2, 1])
    expect(progress).toEqual([2, 4, 5])
    expect(summary).toMatchObject({ total: 5, imported: 5, failed: 0, cancelled: false })
    expect(summary.results).toHaveLength(5)
  })

  it('aggregates per-row failures from the mock deterministically', async () => {
    const api = createMockBulkImportApi({ latencyMsPerBatch: 0, failEveryNth: 3 })
    // Rows 2..11; rows divisible by 3 fail: 3, 6, 9.
    const summary = await runBulkImport(api, 'contacts', makeRecords(10), { batchSize: 4 })

    expect(summary.imported).toBe(7)
    expect(summary.failed).toBe(3)
    const failedRows = summary.results.filter(r => !r.ok).map(r => r.row)
    expect(failedRows).toEqual([3, 6, 9])
    for (const failure of summary.results.filter(r => !r.ok)) {
      expect(failure.error).toContain('simulated contacts rejection')
    }

    // Same input, fresh api instance: identical outcome.
    const again = await runBulkImport(
      createMockBulkImportApi({ latencyMsPerBatch: 0, failEveryNth: 3 }),
      'contacts',
      makeRecords(10),
      { batchSize: 7 },
    )
    expect(again.results.filter(r => !r.ok).map(r => r.row)).toEqual([3, 6, 9])
  })

  it('stops between batches when cancelled and reports a partial summary', async () => {
    const controller = new AbortController()
    const api: BulkImportApi = {
      async importBatch(_entity, records) {
        return records.map(r => ({ row: r.row, ok: true }))
      },
    }

    const summary = await runBulkImport(api, 'accounts', makeRecords(6), {
      batchSize: 2,
      signal: controller.signal,
      onProgress: p => { if (p.processed === 2) controller.abort() },
    })

    expect(summary.cancelled).toBe(true)
    expect(summary.results).toHaveLength(2)
    expect(summary.imported).toBe(2)
    expect(summary.total).toBe(6)
  })

  it('treats an abort during mock latency as cancellation', async () => {
    const api = createMockBulkImportApi({ latencyMsPerBatch: 30, failEveryNth: 0 })
    const controller = new AbortController()
    const pending = runBulkImport(api, 'contacts', makeRecords(4), {
      batchSize: 2,
      signal: controller.signal,
    })
    controller.abort()
    const summary = await pending

    expect(summary.cancelled).toBe(true)
    expect(summary.results).toHaveLength(0)
    expect(summary.imported).toBe(0)
  })

  it('marks a rejected batch as failed rows and continues with later batches', async () => {
    let call = 0
    const api: BulkImportApi = {
      async importBatch(_entity, records) {
        call += 1
        if (call === 2) throw new Error('boom')
        return records.map(r => ({ row: r.row, ok: true }))
      },
    }

    const summary = await runBulkImport(api, 'opportunities', makeRecords(6), { batchSize: 2 })

    expect(summary.cancelled).toBe(false)
    expect(summary.imported).toBe(4)
    expect(summary.failed).toBe(2)
    const failed = summary.results.filter(r => !r.ok)
    expect(failed.map(r => r.row)).toEqual([4, 5])
    expect(failed[0].error).toBe('boom')
  })
})
