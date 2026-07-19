// ===========================================================================
// MOCK DATA BOUNDARY - NOT A LIVE BACKEND
//
// This module is the single in-memory dataset behind the CRM admin demo.
// The platform backend (Cloud SQL + Cloud Run + Fly) was decommissioned to
// zero on 2026-06-04, so there is nothing to call: records here live only in
// the browser tab and are never persisted or sent over the network.
//
// Who talks to it:
//   - The admin CRM tables (contacts, accounts, opportunities) read from it
//     when their VITE_*_API_BASE_URL env var is unset.
//   - The mock bulk-import API (`bulkImportApi.mock.ts`) inserts successful
//     rows into it.
//   - The mock bulk-edit API (`bulkEditApi.mock.ts`) mutates records in it.
//
// The seed mirrors the PR1 sample CSVs in `BulkImportModal.tsx`, so the demo
// tables show the same rows the import samples produce.
//
// To go live later: the store is only reached through the mock API modules
// and the demo-mode branches in `CrmAdminPage.tsx`. Reimplement those over
// fetch against the real services and delete this module; nothing else
// depends on it.
// ===========================================================================

import type { ImportEntity } from './bulkImportCsv'

/**
 * Marker note re-exported so call sites can surface (in code review or UI)
 * that they render the in-memory demo dataset, not a live backend.
 */
export const CRM_STORE_BOUNDARY =
  'crmStore.mock: CRM records shown here live in an in-memory demo dataset in the browser. The platform backend was decommissioned on 2026-06-04; nothing is persisted or sent over the network.' as const

// Record shapes mirror the service DTOs rendered by the admin tables.
export interface CrmContact {
  id: string; account_id?: string; first_name: string; last_name: string
  email?: string; phone?: string; lifecycle_stage: string
  created_at: string; updated_at: string
}
export interface CrmAccount {
  id: string; name: string; domain?: string; status: string
  created_at: string; updated_at: string
}
export interface CrmOpportunity {
  id: string; account_id: string; name: string; stage: string
  amount: number; close_date?: string; created_at: string; updated_at: string
}

export interface CrmEntityRecordMap {
  contacts: CrmContact
  accounts: CrmAccount
  opportunities: CrmOpportunity
}
export type CrmRecord = CrmEntityRecordMap[ImportEntity]

export interface CrmStore {
  /** Snapshot of the current records for an entity (insertion order). */
  list<E extends ImportEntity>(entity: E): CrmEntityRecordMap[E][]
  /**
   * Inserts a record built from bulk-import string values (the same shape
   * `validateCsv` produces). Empty strings become undefined for optional
   * fields; enum defaults match the CSV validator's defaults.
   */
  insertFromImport(entity: ImportEntity, values: Record<string, string>): CrmRecord
  /**
   * Shallow-merges the given fields into a record and bumps `updated_at`.
   * Undefined values are skipped (PATCH semantics). Returns the updated
   * record, or null when the id is unknown.
   */
  updateFields(entity: ImportEntity, id: string, changes: Record<string, string | number | undefined>): CrmRecord | null
  /** Removes a record. Returns false when the id is unknown. */
  remove(entity: ImportEntity, id: string): boolean
  /** Notifies after every mutation (insert, update, remove, reset). */
  subscribe(listener: () => void): () => void
  /** Restores the seed dataset. */
  reset(): void
}

export interface CrmStoreOptions {
  /** Timestamp source for created_at / updated_at. Inject in tests. */
  now?: () => string
}

// ---------------------------------------------------------------------------
// Seed data: structured versions of the PR1 sample CSVs. Opportunity
// account_id values point at the seeded accounts (acc-001 = Acme Corp, ...).
// ---------------------------------------------------------------------------

const stamp = (date: string) => `${date}T09:00:00Z`

function seedContacts(): CrmContact[] {
  const rows: [string, string, string, string, string, string][] = [
    ['con-001', 'Ada', 'Lovelace', 'ada@example.com', '555-0100', 'lead'],
    ['con-002', 'Grace', 'Hopper', 'grace@example.com', '', 'prospect'],
    ['con-003', 'Alan', 'Turing', 'alan@example.com', '555-0102', 'customer'],
    ['con-004', 'Katherine', 'Johnson', 'katherine@example.com', '', 'lead'],
    ['con-005', 'Edsger', 'Dijkstra', 'edsger@example.com', '', 'lead'],
    ['con-006', 'Barbara', 'Liskov', 'barbara@example.com', '555-0105', 'prospect'],
    ['con-007', 'Donald', 'Knuth', 'donald@example.com', '', 'lead'],
    ['con-008', 'Radia', 'Perlman', 'radia@example.com', '', 'customer'],
  ]
  return rows.map(([id, first_name, last_name, email, phone, lifecycle_stage], i) => ({
    id, first_name, last_name, email,
    phone: phone || undefined,
    lifecycle_stage,
    created_at: stamp(`2026-06-${20 + i}`), updated_at: stamp(`2026-06-${20 + i}`),
  }))
}

function seedAccounts(): CrmAccount[] {
  const rows: [string, string, string, string][] = [
    ['acc-001', 'Acme Corp', 'acme.example', 'active'],
    ['acc-002', 'Globex', 'globex.example', 'active'],
    ['acc-003', 'Initech', 'initech.example', 'inactive'],
    ['acc-004', 'Umbrella', 'umbrella.example', 'active'],
    ['acc-005', 'Stark Industries', 'stark.example', 'active'],
    ['acc-006', 'Wayne Enterprises', 'wayne.example', 'active'],
    ['acc-007', 'Hooli', 'hooli.example', 'churned'],
    ['acc-008', 'Pied Piper', 'piedpiper.example', 'active'],
  ]
  return rows.map(([id, name, domain, status], i) => ({
    id, name, domain, status,
    created_at: stamp(`2026-06-${10 + i}`), updated_at: stamp(`2026-06-${10 + i}`),
  }))
}

function seedOpportunities(): CrmOpportunity[] {
  const rows: [string, string, string, string, number, string][] = [
    ['opp-001', 'Platform migration', 'acc-001', 'proposal', 12000, '2026-08-01'],
    ['opp-002', 'SOC 2 readiness', 'acc-002', 'qualification', 8000, '2026-09-15'],
    ['opp-003', 'CI/CD overhaul', 'acc-001', 'negotiation', 4500, '2026-08-20'],
    ['opp-004', 'Observability rollout', 'acc-003', 'proposal', 6500, ''],
    ['opp-005', 'Cost review', 'acc-004', 'qualification', 1500, '2026-07-30'],
    ['opp-006', 'Retainer renewal', 'acc-002', 'closed-won', 24000, '2026-07-25'],
    ['opp-007', 'Incident response', 'acc-005', 'proposal', 3200, ''],
    ['opp-008', 'Architecture review', 'acc-006', 'qualification', 2000, '2026-10-01'],
  ]
  return rows.map(([id, name, account_id, stage, amount, close_date], i) => ({
    id, name, account_id, stage, amount,
    close_date: close_date || undefined,
    created_at: stamp(`2026-07-0${1 + i}`), updated_at: stamp(`2026-07-0${1 + i}`),
  }))
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

const ID_PREFIX: Record<ImportEntity, string> = {
  contacts: 'con',
  accounts: 'acc',
  opportunities: 'opp',
}

export function createCrmStore(options: CrmStoreOptions = {}): CrmStore {
  const now = options.now ?? (() => new Date().toISOString())
  const data: Record<ImportEntity, CrmRecord[]> = {
    contacts: seedContacts(),
    accounts: seedAccounts(),
    opportunities: seedOpportunities(),
  }
  const listeners = new Set<() => void>()
  // Starts above the seed range so ids stay unique across resets.
  let idCounter = 1000

  const notify = () => { listeners.forEach(listener => listener()) }
  const makeId = (entity: ImportEntity) => `${ID_PREFIX[entity]}-${idCounter++}`

  function buildFromImport(entity: ImportEntity, values: Record<string, string>): CrmRecord {
    const timestamp = now()
    const base = { id: makeId(entity), created_at: timestamp, updated_at: timestamp }
    if (entity === 'contacts') {
      return {
        ...base,
        first_name: values.first_name ?? '',
        last_name: values.last_name ?? '',
        email: values.email || undefined,
        phone: values.phone || undefined,
        lifecycle_stage: values.lifecycle_stage || 'lead',
        account_id: values.account_id || undefined,
      }
    }
    if (entity === 'accounts') {
      return {
        ...base,
        name: values.name ?? '',
        domain: values.domain || undefined,
        status: values.status || 'active',
      }
    }
    const amount = Number(values.amount)
    return {
      ...base,
      name: values.name ?? '',
      account_id: values.account_id ?? '',
      stage: values.stage || 'qualification',
      amount: Number.isFinite(amount) ? amount : 0,
      close_date: values.close_date || undefined,
    }
  }

  return {
    list<E extends ImportEntity>(entity: E): CrmEntityRecordMap[E][] {
      return [...data[entity]] as CrmEntityRecordMap[E][]
    },

    insertFromImport(entity, values) {
      const record = buildFromImport(entity, values)
      data[entity].push(record)
      notify()
      return record
    },

    updateFields(entity, id, changes) {
      const records = data[entity]
      const index = records.findIndex(record => record.id === id)
      if (index === -1) return null
      const updated = { ...records[index] } as Record<string, unknown>
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) updated[key] = value
      }
      updated.updated_at = now()
      records[index] = updated as unknown as CrmRecord
      notify()
      return records[index]
    },

    remove(entity, id) {
      const records = data[entity]
      const index = records.findIndex(record => record.id === id)
      if (index === -1) return false
      records.splice(index, 1)
      notify()
      return true
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    reset() {
      data.contacts = seedContacts()
      data.accounts = seedAccounts()
      data.opportunities = seedOpportunities()
      notify()
    },
  }
}

/** Shared demo dataset used by the admin UI and the mock API boundaries. */
export const crmStore: CrmStore = createCrmStore()
