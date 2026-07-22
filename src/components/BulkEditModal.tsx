// ---------------------------------------------------------------------------
// Admin bulk edit modal: applies one field change to all selected rows.
//
// Flow: choose a value, confirm a summary ("N rows: field X to value Y"),
// watch progress, then review per-row results (same report pattern as the
// bulk import modal). Transport is injected through the `BulkEditApi`
// interface; the default is the clearly marked mock boundary in
// `src/lib/bulkEditApi.mock.ts`, which mutates the in-memory demo dataset
// (the backend is decommissioned, so nothing here talks to a live service).
// ---------------------------------------------------------------------------

import { useState } from 'react'
import type { ImportEntity } from '../lib/bulkImportCsv'
import {
  BULK_EDIT_FIELDS,
  useBulkEdit,
  type BulkEditApi,
  type BulkEditTarget,
} from '../hooks/useBulkEdit'
import { MOCK_EDIT_BOUNDARY, mockBulkEditApi } from '../lib/bulkEditApi.mock'

const INPUT_CLS = 'w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-text-primary placeholder-zinc-500 outline-none transition hover:border-zinc-600 hover:bg-zinc-800/80 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30'

interface BulkEditModalProps {
  entity: ImportEntity
  /** Selected rows in display order. Snapshotted when the modal opens. */
  targets: BulkEditTarget[]
  /** Injected transport. Defaults to the mock boundary (no live backend). */
  api?: BulkEditApi
  /** Called on close after a completed run, so the caller can clear the selection. */
  onApplied?: () => void
  onClose: () => void
}

export function BulkEditModal({ entity, targets: initialTargets, api = mockBulkEditApi, onApplied, onClose }: BulkEditModalProps) {
  // Snapshot the selection at open time so mid-run list refreshes (the demo
  // store notifies on every mutation) cannot change the operation's subject.
  const [targets] = useState(initialTargets)
  const spec = BULK_EDIT_FIELDS[entity]
  const [value, setValue] = useState('')
  const [step, setStep] = useState<'choose' | 'confirm'>('choose')
  const editor = useBulkEdit(api)

  const running = editor.status === 'running'
  const finished = editor.status === 'done' || editor.status === 'cancelled'
  const percent = editor.total > 0 ? Math.round((editor.processed / editor.total) * 100) : 0
  const failedResults = editor.summary?.results.filter(r => !r.ok) ?? []
  const rowsWord = `row${targets.length !== 1 ? 's' : ''}`

  function handleClose() {
    if (running) editor.cancel()
    if (editor.status === 'done') onApplied?.()
    onClose()
  }

  function handleApply() {
    if (!value) return
    void editor.start(entity, targets, { field: spec.field, value })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={handleClose} role="presentation">
      <div
        className="forge-panel surface-card-strong max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 shadow-2xl shadow-black/60"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-edit-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="bulk-edit-title" className="text-base font-bold text-white">Bulk edit</h3>
            <span
              title={MOCK_EDIT_BOUNDARY}
              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-scale-xs text-amber-300 ring-1 ring-amber-500/30"
            >
              Demo mode
            </span>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close dialog" className="text-text-subtle transition-colors hover:text-white">✕</button>
        </div>

        <p className="mb-4 text-xs text-text-muted">
          Applies one change to every selected row through a mocked API boundary. Nothing is sent to a live backend.
        </p>

        <div className="space-y-4">
          {/* Step 1: choose the value */}
          {!running && !finished && step === 'choose' && (
            <>
              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-white">{targets.length}</span> {rowsWord} selected.
              </p>
              <div>
                <span className="mb-1 block text-sm font-medium text-text-muted">Field</span>
                <p className="text-sm text-zinc-200">{spec.label} <span className="font-mono text-xs text-text-subtle">({spec.field})</span></p>
              </div>
              <div>
                <label htmlFor="bulk-edit-value" className="mb-1 block text-sm font-medium text-text-muted">New value</label>
                <select
                  id="bulk-edit-value"
                  className={INPUT_CLS}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                >
                  <option value="" disabled>Choose a value</option>
                  {spec.options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Step 2: confirm */}
          {!running && !finished && step === 'confirm' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-300">
                <span className="font-semibold">{targets.length} {rowsWord}</span>: set{' '}
                <span className="font-mono text-xs">{spec.field}</span> to{' '}
                <span className="font-semibold">{value}</span>
              </p>
              <p className="mt-1 text-xs text-amber-400/80">This updates every selected row. Review before applying.</p>
            </div>
          )}

          {/* Progress */}
          {running && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                <span>Updating {editor.processed} of {editor.total} rows</span>
                <span>{percent}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-zinc-800"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Bulk edit progress"
              >
                <div className="h-full rounded-full bg-amber-500/80 transition-all duration-200" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}

          {/* Result report */}
          {finished && editor.summary && (
            <div className="space-y-3">
              <div className={`rounded-xl border px-4 py-3 ${editor.summary.failed > 0 || editor.summary.cancelled ? 'border-amber-500/30 bg-amber-500/10' : 'border-green-500/30 bg-green-500/10'}`}>
                <p className={`text-sm font-medium ${editor.summary.failed > 0 || editor.summary.cancelled ? 'text-amber-300' : 'text-green-300'}`}>
                  {editor.status === 'cancelled'
                    ? `Edit cancelled: ${editor.summary.edited} of ${editor.summary.total} rows updated before cancelling.`
                    : `Updated ${editor.summary.edited} of ${editor.summary.total} rows${editor.summary.failed > 0 ? `, ${editor.summary.failed} failed` : ''}.`}
                </p>
              </div>
              {failedResults.length > 0 && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-red-300">Rows that failed</p>
                  <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                    {failedResults.map(result => (
                      <li key={result.id} className="font-mono text-xs text-red-400">{result.label}: {result.error ?? 'unknown error'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            {running ? (
              <button type="button" onClick={editor.cancel} className="btn-neutral px-4 py-2 text-sm">Cancel edit</button>
            ) : finished ? (
              <button type="button" onClick={handleClose} className="btn-accent px-4 py-2 text-sm">Close</button>
            ) : step === 'choose' ? (
              <>
                <button type="button" onClick={handleClose} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  disabled={!value || targets.length === 0}
                  className="btn-accent px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Review change
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep('choose')} className="btn-neutral px-4 py-2 text-sm">Back</button>
                <button type="button" onClick={handleApply} className="btn-accent px-4 py-2 text-sm">
                  Apply to {targets.length} {rowsWord}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
