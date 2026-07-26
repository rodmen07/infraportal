// ---------------------------------------------------------------------------
// Bulk import engine + React hook.
//
// The engine (`runBulkImport`) is pure and fully testable in node: it batches
// records, aggregates per-row results, reports progress, and honors an
// AbortSignal for cancellation. `useBulkImport` is a thin state wrapper.
//
// Transport is injected via the `BulkImportApi` interface. The only
// implementation today is the mock in `src/lib/bulkImportApi.mock.ts`
// (no CRM service URL is configured on the public site). When a backend
// exists, implement `BulkImportApi` over fetch and swap the injection;
// nothing in this file or the UI needs to change.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react'
import type { ImportEntity, ImportRecord } from '../lib/bulkImportCsv'

export interface RowResult {
  /** Spreadsheet-style row number from the source CSV. */
  row: number
  ok: boolean
  error?: string
}

export interface BulkImportApi {
  importBatch(entity: ImportEntity, records: ImportRecord[], signal?: AbortSignal): Promise<RowResult[]>
}

export interface BulkImportProgress {
  processed: number
  total: number
}

export interface BulkImportSummary {
  total: number
  imported: number
  failed: number
  /** True when the run was aborted; unprocessed rows are simply not attempted. */
  cancelled: boolean
  results: RowResult[]
}

export const DEFAULT_BATCH_SIZE = 25

export interface RunBulkImportOptions {
  batchSize?: number
  signal?: AbortSignal
  onProgress?: (progress: BulkImportProgress) => void
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/**
 * Runs the import in batches against the injected api. Never throws:
 * a rejected batch marks every row in that batch as failed and the run
 * continues; an abort ends the run early with `cancelled: true`.
 */
export async function runBulkImport(
  api: BulkImportApi,
  entity: ImportEntity,
  records: ImportRecord[],
  options: RunBulkImportOptions = {},
): Promise<BulkImportSummary> {
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE)
  const results: RowResult[] = []
  let cancelled = false

  for (let i = 0; i < records.length; i += batchSize) {
    if (options.signal?.aborted) { cancelled = true; break }
    const batch = records.slice(i, i + batchSize)
    try {
      const batchResults = await api.importBatch(entity, batch, options.signal)
      results.push(...batchResults)
    } catch (err) {
      if (isAbortError(err) || options.signal?.aborted) { cancelled = true; break }
      const message = err instanceof Error ? err.message : String(err)
      results.push(...batch.map(record => ({ row: record.row, ok: false, error: message })))
    }
    options.onProgress?.({ processed: Math.min(i + batch.length, records.length), total: records.length })
  }

  const imported = results.filter(r => r.ok).length
  return {
    total: records.length,
    imported,
    failed: results.length - imported,
    cancelled,
    results,
  }
}

export type BulkImportStatus = 'idle' | 'running' | 'done' | 'cancelled'

export interface BulkImportState {
  status: BulkImportStatus
  processed: number
  total: number
  summary: BulkImportSummary | null
}

const IDLE_STATE: BulkImportState = { status: 'idle', processed: 0, total: 0, summary: null }

export function useBulkImport(api: BulkImportApi) {
  const [state, setState] = useState<BulkImportState>(IDLE_STATE)
  const controllerRef = useRef<AbortController | null>(null)

  const start = useCallback(async (entity: ImportEntity, records: ImportRecord[]) => {
    if (controllerRef.current) return null // an import is already running
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ status: 'running', processed: 0, total: records.length, summary: null })

    const summary = await runBulkImport(api, entity, records, {
      signal: controller.signal,
      onProgress: p => setState(s => ({ ...s, processed: p.processed, total: p.total })),
    })

    controllerRef.current = null
    setState({
      status: summary.cancelled ? 'cancelled' : 'done',
      processed: summary.imported + summary.failed,
      total: summary.total,
      summary,
    })
    return summary
  }, [api])

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    if (!controllerRef.current) setState(IDLE_STATE)
  }, [])

  return { ...state, start, cancel, reset }
}
