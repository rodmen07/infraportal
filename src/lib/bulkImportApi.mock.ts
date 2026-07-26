// ===========================================================================
// MOCK API BOUNDARY - NOT A LIVE BACKEND
//
// Every bulk import call in the app goes through the `BulkImportApi`
// interface, and this module is the only implementation. It simulates the
// transport entirely in the browser: no network requests are made anywhere.
// The public site ships with no CRM service URL configured, so there is
// nothing to call.
//
// Behavior, kept deterministic so tests and demos are predictable:
//   - Latency: a fixed delay per batch (configurable, default 350 ms).
//   - Failures: every Nth spreadsheet row fails with a simulated rejection
//     (configurable via `failEveryNth`, default 7; based on the row number,
//     so the pattern is stable across batch sizes and repeat runs).
//
// Since v1.16.4 PR2 the shared instance also writes each successfully
// imported row into the in-memory demo dataset (`crmStore.mock.ts`), so the
// admin tables pick imported rows up immediately. Rows that hit the
// simulated failure are not inserted, matching the result report.
//
// To go live later: implement `BulkImportApi` over fetch against the real
// service and swap the instance injected into `BulkImportModal` /
// `useBulkImport`. Nothing else needs to change.
// ===========================================================================

import type { BulkImportApi, RowResult } from '../hooks/useBulkImport'
import { crmStore, type CrmStore } from './crmStore.mock'

/**
 * Marker note re-exported so call sites can surface (in code review or UI)
 * that they are wired to the mock, not a live backend.
 */
export const MOCK_BOUNDARY =
  'bulkImportApi.mock: bulk imports are simulated in the browser. No network requests are made.' as const

export interface MockBulkImportOptions {
  /** Simulated latency per batch, in milliseconds. Use 0 in tests. */
  latencyMsPerBatch?: number
  /** Every Nth spreadsheet row fails deterministically. 0 disables failures. */
  failEveryNth?: number
  /**
   * Demo dataset that successful rows are inserted into. Omit for a pure
   * transport (engine-only tests); the shared instance uses `crmStore`.
   */
  store?: CrmStore
}

function abortError(): Error {
  const err = new Error('The import was cancelled.')
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

export function createMockBulkImportApi(options: MockBulkImportOptions = {}): BulkImportApi {
  const latencyMsPerBatch = options.latencyMsPerBatch ?? 350
  const failEveryNth = options.failEveryNth ?? 7
  const store = options.store

  return {
    async importBatch(entity, records, signal): Promise<RowResult[]> {
      await delay(latencyMsPerBatch, signal)
      return records.map(record => {
        if (failEveryNth > 0 && record.row % failEveryNth === 0) {
          return {
            row: record.row,
            ok: false,
            error: `simulated ${entity} rejection (mock boundary fails every ${failEveryNth}th row)`,
          }
        }
        store?.insertFromImport(entity, record.values)
        return { row: record.row, ok: true }
      })
    },
  }
}

/** Shared default instance injected by the admin UI; writes into `crmStore`. */
export const mockBulkImportApi: BulkImportApi = createMockBulkImportApi({ store: crmStore })
