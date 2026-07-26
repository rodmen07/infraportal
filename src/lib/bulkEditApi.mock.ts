// ===========================================================================
// MOCK API BOUNDARY - NOT A LIVE BACKEND
//
// Every bulk edit call in the app goes through the `BulkEditApi` interface,
// and this module is the only implementation. It simulates the transport
// entirely in the browser and applies successful edits to the in-memory
// demo dataset (`crmStore.mock.ts`): no network requests are made anywhere.
// The public site ships with no CRM service URL configured, so there is
// nothing to call.
//
// Behavior, kept deterministic so tests and demos are predictable (same
// discipline as `bulkImportApi.mock.ts`):
//   - Latency: a fixed delay per batch (configurable, default 350 ms).
//   - Failures: every Nth selected record fails with a simulated rejection
//     (configurable via `failEveryNth`, default 7; keyed off the record's
//     1-based position in the selection, so the pattern is stable across
//     batch sizes and repeat runs). Failed records are not modified.
//
// To go live later: implement `BulkEditApi` over fetch against the real
// services and swap the instance injected into `BulkEditModal`. Nothing
// else needs to change.
// ===========================================================================

import type { BulkEditApi, EditRowResult } from '../hooks/useBulkEdit'
import { crmStore, type CrmStore } from './crmStore.mock'

/**
 * Marker note re-exported so call sites can surface (in code review or UI)
 * that they are wired to the mock, not a live backend.
 */
export const MOCK_EDIT_BOUNDARY =
  'bulkEditApi.mock: bulk edits are simulated in the browser against the in-memory demo dataset. No network requests are made.' as const

export interface MockBulkEditOptions {
  /** Simulated latency per batch, in milliseconds. Use 0 in tests. */
  latencyMsPerBatch?: number
  /** Every Nth selected record fails deterministically. 0 disables failures. */
  failEveryNth?: number
  /** Demo dataset that edits are applied to. Defaults to the shared store. */
  store?: CrmStore
}

// Same latency and abort behavior as bulkImportApi.mock (kept module-local
// so each mock boundary stays self-contained).
function abortError(): Error {
  const err = new Error('The edit was cancelled.')
  err.name = 'AbortError'
  return err
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return }
    const onAbort = () => { clearTimeout(timer); reject(abortError()) }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function createMockBulkEditApi(options: MockBulkEditOptions = {}): BulkEditApi {
  const latencyMsPerBatch = options.latencyMsPerBatch ?? 350
  const failEveryNth = options.failEveryNth ?? 7
  const store = options.store ?? crmStore

  return {
    async applyBatch(entity, items, change, signal): Promise<EditRowResult[]> {
      await delay(latencyMsPerBatch, signal)
      return items.map(item => {
        if (failEveryNth > 0 && item.ordinal % failEveryNth === 0) {
          return {
            id: item.id,
            label: item.label,
            ok: false,
            error: `simulated ${entity} edit rejection (mock boundary fails every ${failEveryNth}th selected row)`,
          }
        }
        const updated = store.updateFields(entity, item.id, { [change.field]: change.value })
        if (!updated) {
          return { id: item.id, label: item.label, ok: false, error: 'record not found in the demo dataset' }
        }
        return { id: item.id, label: item.label, ok: true }
      })
    },
  }
}

/** Shared default instance injected by the admin UI; edits `crmStore`. */
export const mockBulkEditApi: BulkEditApi = createMockBulkEditApi()
