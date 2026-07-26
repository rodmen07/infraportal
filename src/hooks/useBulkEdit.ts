// ---------------------------------------------------------------------------
// Bulk edit engine + React hook, mirroring the bulk import pattern.
//
// The engine (`runBulkEdit`) is pure and fully testable in node: it batches
// the selected records, aggregates per-row results, reports progress, and
// honors an AbortSignal for cancellation. `useBulkEdit` is a thin state
// wrapper.
//
// Transport is injected via the `BulkEditApi` interface. The only
// implementation today is the mock in `src/lib/bulkEditApi.mock.ts`, which
// mutates the in-memory demo dataset (no CRM service URL is configured on
// the public site). When a real backend is wired, implement `BulkEditApi` over
// fetch and swap the injection; nothing in this file or the UI changes.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react'
import {
  ACCOUNT_STATUSES,
  CONTACT_STAGES,
  OPPORTUNITY_STAGES,
  type ImportEntity,
} from '../lib/bulkImportCsv'

// ---------------------------------------------------------------------------
// Editable fields per entity. Each demo model has exactly one bulk-editable
// enum field (stage/status). None of the models has an owner field; when one
// exists, add its spec here and the modal picks it up.
// ---------------------------------------------------------------------------

export interface BulkEditFieldSpec {
  field: string
  label: string
  options: string[]
}

export const BULK_EDIT_FIELDS: Record<ImportEntity, BulkEditFieldSpec> = {
  contacts: { field: 'lifecycle_stage', label: 'Lifecycle stage', options: CONTACT_STAGES },
  accounts: { field: 'status', label: 'Status', options: ACCOUNT_STATUSES },
  opportunities: { field: 'stage', label: 'Stage', options: OPPORTUNITY_STAGES },
}

// ---------------------------------------------------------------------------
// Engine types
// ---------------------------------------------------------------------------

export interface BulkEditTarget {
  id: string
  /** Human-readable name shown in per-row results (e.g. "Ada Lovelace"). */
  label: string
}

export interface BulkEditItem extends BulkEditTarget {
  /**
   * 1-based position of the record in the overall selection. The mock keys
   * its deterministic failure pattern off this, so outcomes are stable
   * regardless of batch size.
   */
  ordinal: number
}

export interface BulkEditChange {
  field: string
  value: string
}

export interface EditRowResult {
  id: string
  label: string
  ok: boolean
  error?: string
}

export interface BulkEditApi {
  applyBatch(entity: ImportEntity, items: BulkEditItem[], change: BulkEditChange, signal?: AbortSignal): Promise<EditRowResult[]>
}

export interface BulkEditProgress {
  processed: number
  total: number
}

export interface BulkEditSummary {
  total: number
  edited: number
  failed: number
  /** True when the run was aborted; unprocessed rows are simply not attempted. */
  cancelled: boolean
  results: EditRowResult[]
}

export const DEFAULT_EDIT_BATCH_SIZE = 25

export interface RunBulkEditOptions {
  batchSize?: number
  signal?: AbortSignal
  onProgress?: (progress: BulkEditProgress) => void
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/**
 * Applies one change to all targets in batches against the injected api.
 * Never throws: a rejected batch marks every row in that batch as failed and
 * the run continues; an abort ends the run early with `cancelled: true`.
 */
export async function runBulkEdit(
  api: BulkEditApi,
  entity: ImportEntity,
  targets: BulkEditTarget[],
  change: BulkEditChange,
  options: RunBulkEditOptions = {},
): Promise<BulkEditSummary> {
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_EDIT_BATCH_SIZE)
  const items: BulkEditItem[] = targets.map((target, index) => ({ ...target, ordinal: index + 1 }))
  const results: EditRowResult[] = []
  let cancelled = false

  for (let i = 0; i < items.length; i += batchSize) {
    if (options.signal?.aborted) { cancelled = true; break }
    const batch = items.slice(i, i + batchSize)
    try {
      const batchResults = await api.applyBatch(entity, batch, change, options.signal)
      results.push(...batchResults)
    } catch (err) {
      if (isAbortError(err) || options.signal?.aborted) { cancelled = true; break }
      const message = err instanceof Error ? err.message : String(err)
      results.push(...batch.map(item => ({ id: item.id, label: item.label, ok: false, error: message })))
    }
    options.onProgress?.({ processed: Math.min(i + batch.length, items.length), total: items.length })
  }

  const edited = results.filter(r => r.ok).length
  return {
    total: items.length,
    edited,
    failed: results.length - edited,
    cancelled,
    results,
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export type BulkEditStatus = 'idle' | 'running' | 'done' | 'cancelled'

export interface BulkEditState {
  status: BulkEditStatus
  processed: number
  total: number
  summary: BulkEditSummary | null
}

const IDLE_STATE: BulkEditState = { status: 'idle', processed: 0, total: 0, summary: null }

export function useBulkEdit(api: BulkEditApi) {
  const [state, setState] = useState<BulkEditState>(IDLE_STATE)
  const controllerRef = useRef<AbortController | null>(null)

  const start = useCallback(async (entity: ImportEntity, targets: BulkEditTarget[], change: BulkEditChange) => {
    if (controllerRef.current) return null // an edit is already running
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ status: 'running', processed: 0, total: targets.length, summary: null })

    const summary = await runBulkEdit(api, entity, targets, change, {
      signal: controller.signal,
      onProgress: p => setState(s => ({ ...s, processed: p.processed, total: p.total })),
    })

    controllerRef.current = null
    setState({
      status: summary.cancelled ? 'cancelled' : 'done',
      processed: summary.edited + summary.failed,
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
