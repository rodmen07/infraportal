import { describe, expect, it } from 'vitest'
import { createCrmStore } from './crmStore.mock'
import { createMockBulkImportApi } from './bulkImportApi.mock'
import { createMockBulkEditApi } from './bulkEditApi.mock'
import { runBulkImport } from '../hooks/useBulkImport'
import { runBulkEdit } from '../hooks/useBulkEdit'
import { validateCsv } from './bulkImportCsv'

const FIXED_NOW = '2026-07-19T12:00:00Z'

describe('crmStore seed', () => {
  it('is seeded with the demo dataset for all three entities', () => {
    const store = createCrmStore()
    const contacts = store.list('contacts')
    const accounts = store.list('accounts')
    const opportunities = store.list('opportunities')

    expect(contacts).toHaveLength(8)
    expect(accounts).toHaveLength(8)
    expect(opportunities).toHaveLength(8)

    expect(contacts[0]).toMatchObject({
      id: 'con-001', first_name: 'Ada', last_name: 'Lovelace',
      email: 'ada@example.com', lifecycle_stage: 'lead',
    })
    expect(accounts[0]).toMatchObject({ id: 'acc-001', name: 'Acme Corp', domain: 'acme.example', status: 'active' })
    expect(opportunities[0]).toMatchObject({
      id: 'opp-001', name: 'Platform migration', account_id: 'acc-001', stage: 'proposal', amount: 12000,
    })
    // Opportunity account ids resolve to seeded accounts.
    const accountIds = new Set(accounts.map(a => a.id))
    for (const opp of opportunities) expect(accountIds.has(opp.account_id)).toBe(true)
  })

  it('returns list snapshots that do not expose internal state', () => {
    const store = createCrmStore()
    store.list('contacts').pop()
    expect(store.list('contacts')).toHaveLength(8)
  })
})

describe('crmStore mutations', () => {
  it('insertFromImport applies optional-field and enum defaults', () => {
    const store = createCrmStore({ now: () => FIXED_NOW })
    const record = store.insertFromImport('contacts', { first_name: 'Annie', last_name: 'Easley', email: '' })

    expect(record).toMatchObject({
      first_name: 'Annie', last_name: 'Easley',
      lifecycle_stage: 'lead',
      created_at: FIXED_NOW, updated_at: FIXED_NOW,
    })
    expect('email' in record && record.email).toBeFalsy()
    expect(store.list('contacts')).toHaveLength(9)
  })

  it('updateFields merges defined fields, skips undefined, and bumps updated_at', () => {
    const store = createCrmStore({ now: () => FIXED_NOW })
    const updated = store.updateFields('accounts', 'acc-001', { status: 'churned', domain: undefined })

    expect(updated).toMatchObject({ id: 'acc-001', name: 'Acme Corp', domain: 'acme.example', status: 'churned' })
    expect(updated?.updated_at).toBe(FIXED_NOW)
    expect(updated?.created_at).not.toBe(FIXED_NOW)
    expect(store.updateFields('accounts', 'acc-nope', { status: 'active' })).toBeNull()
  })

  it('remove deletes by id and reset restores the seed', () => {
    const store = createCrmStore()
    expect(store.remove('opportunities', 'opp-001')).toBe(true)
    expect(store.remove('opportunities', 'opp-001')).toBe(false)
    expect(store.list('opportunities')).toHaveLength(7)

    store.reset()
    expect(store.list('opportunities')).toHaveLength(8)
    expect(store.list('opportunities')[0].id).toBe('opp-001')
  })

  it('notifies subscribers on every mutation and honors unsubscribe', () => {
    const store = createCrmStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => { calls += 1 })

    store.insertFromImport('accounts', { name: 'New Co' })
    store.updateFields('accounts', 'acc-001', { status: 'inactive' })
    store.remove('accounts', 'acc-002')
    expect(calls).toBe(3)

    unsubscribe()
    store.reset()
    expect(calls).toBe(3)
  })
})

describe('store integration: bulk import writes, tables read, bulk edit mutates', () => {
  it('inserts only the rows the mock import accepts', async () => {
    const store = createCrmStore()
    const api = createMockBulkImportApi({ latencyMsPerBatch: 0, failEveryNth: 3, store })
    const csv = [
      'first_name,last_name,email',
      'Annie,Easley,annie@example.com',    // row 2: ok
      'Mary,Jackson,mary@example.com',     // row 3: simulated failure
      'Dorothy,Vaughan,dorothy@example.com', // row 4: ok
      'Margaret,Hamilton,margaret@example.com', // row 5: ok
      'Frances,Spence,frances@example.com', // row 6: simulated failure
    ].join('\n')
    const { records, headerErrors } = validateCsv('contacts', csv)
    expect(headerErrors).toHaveLength(0)

    const summary = await runBulkImport(api, 'contacts', records, { batchSize: 2 })

    expect(summary).toMatchObject({ total: 5, imported: 3, failed: 2 })
    const names = store.list('contacts').map(c => c.first_name)
    expect(names).toHaveLength(11) // 8 seeded + 3 imported
    expect(names).toEqual(expect.arrayContaining(['Annie', 'Dorothy', 'Margaret']))
    expect(names).not.toContain('Mary')
    expect(names).not.toContain('Frances')
  })

  it('supports the full cycle: import into the store, then bulk edit the imported rows', async () => {
    const store = createCrmStore({ now: () => FIXED_NOW })
    const importApi = createMockBulkImportApi({ latencyMsPerBatch: 0, failEveryNth: 0, store })
    const csv = 'name,domain,status\nNew Co,newco.example,active\nOther Co,other.example,active'
    const { records } = validateCsv('accounts', csv)
    await runBulkImport(importApi, 'accounts', records)

    const imported = store.list('accounts').filter(a => a.created_at === FIXED_NOW)
    expect(imported).toHaveLength(2)

    const editApi = createMockBulkEditApi({ latencyMsPerBatch: 0, failEveryNth: 0, store })
    const summary = await runBulkEdit(
      editApi,
      'accounts',
      imported.map(a => ({ id: a.id, label: a.name })),
      { field: 'status', value: 'churned' },
    )

    expect(summary).toMatchObject({ total: 2, edited: 2, failed: 0 })
    const after = store.list('accounts')
    for (const target of imported) {
      expect(after.find(a => a.id === target.id)?.status).toBe('churned')
    }
    // Seeded rows untouched.
    expect(after.find(a => a.id === 'acc-001')?.status).toBe('active')
  })
})
