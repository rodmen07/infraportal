// ---------------------------------------------------------------------------
// Admin bulk CSV import modal.
//
// Transport is injected through the `BulkImportApi` interface; the default
// is the clearly marked mock boundary in `src/lib/bulkImportApi.mock.ts`
// (the backend is decommissioned, so nothing here talks to a live service).
// ---------------------------------------------------------------------------

import { useMemo, useRef, useState } from 'react'
import {
  ENTITY_COLUMNS,
  formatRowError,
  validateCsv,
  type ImportEntity,
} from '../lib/bulkImportCsv'
import { useBulkImport, type BulkImportApi } from '../hooks/useBulkImport'
import { MOCK_BOUNDARY, mockBulkImportApi } from '../lib/bulkImportApi.mock'

const INPUT_CLS = 'w-full rounded-xl border border-zinc-700 bg-surface-control px-3 py-2 text-sm text-text-primary placeholder-zinc-500 outline-none transition hover:border-zinc-600 hover:bg-zinc-800/80 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30'

const PREVIEW_ROW_LIMIT = 5
const ERROR_DISPLAY_LIMIT = 8

const ENTITY_OPTIONS: { id: ImportEntity; label: string }[] = [
  { id: 'contacts', label: 'Contacts' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'opportunities', label: 'Opportunities' },
]

const SAMPLE_CSV: Record<ImportEntity, string> = {
  contacts: `first_name,last_name,email,phone,lifecycle_stage
Ada,Lovelace,ada@example.com,555-0100,lead
Grace,Hopper,grace@example.com,,prospect
Alan,Turing,alan@example.com,555-0102,customer
Katherine,Johnson,katherine@example.com,,lead
Edsger,Dijkstra,edsger@example.com,,lead
Barbara,Liskov,barbara@example.com,555-0105,prospect
Donald,Knuth,donald@example.com,,lead
Radia,Perlman,radia@example.com,,customer`,
  accounts: `name,domain,status
Acme Corp,acme.example,active
Globex,globex.example,active
Initech,initech.example,inactive
Umbrella,umbrella.example,active
Stark Industries,stark.example,active
Wayne Enterprises,wayne.example,active
Hooli,hooli.example,churned
Pied Piper,piedpiper.example,active`,
  opportunities: `name,account_id,stage,amount,close_date
Platform migration,acc-001,proposal,12000,2026-08-01
SOC 2 readiness,acc-002,qualification,8000,2026-09-15
CI/CD overhaul,acc-001,negotiation,"$4,500",2026-08-20
Observability rollout,acc-003,proposal,6500,
Cost review,acc-004,qualification,1500,2026-07-30
Retainer renewal,acc-002,closed-won,24000,2026-07-25
Incident response,acc-005,proposal,3200,
Architecture review,acc-006,qualification,2000,2026-10-01`,
}

interface BulkImportModalProps {
  initialEntity?: ImportEntity
  /** Injected transport. Defaults to the mock boundary (no live backend). */
  api?: BulkImportApi
  onClose: () => void
}

export function BulkImportModal({ initialEntity = 'contacts', api = mockBulkImportApi, onClose }: BulkImportModalProps) {
  const [entity, setEntity] = useState<ImportEntity>(initialEntity)
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importer = useBulkImport(api)

  const validation = useMemo(
    () => (csvText.trim() ? validateCsv(entity, csvText) : null),
    [entity, csvText],
  )

  const running = importer.status === 'running'
  const finished = importer.status === 'done' || importer.status === 'cancelled'
  const canImport = !running && !!validation && validation.headerErrors.length === 0 && validation.records.length > 0
  const percent = importer.total > 0 ? Math.round((importer.processed / importer.total) * 100) : 0
  const failedResults = importer.summary?.results.filter(r => !r.ok) ?? []
  const previewFields = ENTITY_COLUMNS[entity].map(spec => spec.field)

  function updateCsv(text: string, name: string | null) {
    setCsvText(text)
    setFileName(name)
    importer.reset()
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    updateCsv(await file.text(), file.name)
  }

  function handleEntityChange(next: ImportEntity) {
    setEntity(next)
    importer.reset()
  }

  function handleStartOver() {
    updateCsv('', null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    if (running) importer.cancel()
    onClose()
  }

  function handleImport() {
    if (!validation) return
    void importer.start(entity, validation.records)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={handleClose} role="presentation">
      <div
        className="forge-panel surface-card-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 shadow-2xl shadow-black/60"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="bulk-import-title" className="text-base font-bold text-white">Bulk CSV import</h3>
            <span
              title={MOCK_BOUNDARY}
              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-scale-xs text-amber-300 ring-1 ring-amber-500/30"
            >
              Demo mode
            </span>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close dialog" className="text-text-subtle transition-colors hover:text-white">✕</button>
        </div>

        <p className="mb-4 text-xs text-text-muted">
          Rows are validated in the browser, then processed by a mocked API boundary. Nothing is sent to a live backend.
        </p>

        <div className="space-y-4">
          {/* Entity + source inputs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="bulk-import-entity" className="mb-1 block text-sm font-medium text-text-muted">Import into</label>
              <select
                id="bulk-import-entity"
                className={INPUT_CLS}
                value={entity}
                disabled={running}
                onChange={e => handleEntityChange(e.target.value as ImportEntity)}
              >
                {ENTITY_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-text-muted">CSV file</span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  disabled={running}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-neutral px-3 py-2 text-xs disabled:opacity-50"
                >
                  Choose file
                </button>
                <span className="truncate text-xs text-text-subtle">{fileName ?? 'No file selected'}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="bulk-import-csv" className="text-sm font-medium text-text-muted">Or paste CSV</label>
              <button
                type="button"
                disabled={running}
                onClick={() => updateCsv(SAMPLE_CSV[entity], null)}
                className="text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300 disabled:opacity-50"
              >
                Load sample CSV
              </button>
            </div>
            <textarea
              id="bulk-import-csv"
              rows={6}
              disabled={running}
              className={`${INPUT_CLS} resize-y font-mono text-xs`}
              placeholder={'first_name,last_name,email\nAda,Lovelace,ada@example.com'}
              value={csvText}
              onChange={e => updateCsv(e.target.value, null)}
            />
          </div>

          {/* Validation report */}
          {validation && validation.headerErrors.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-medium text-danger-text">The file cannot be imported yet</p>
              <ul className="mt-1 space-y-1">
                {validation.headerErrors.map(message => (
                  <li key={message} className="font-mono text-xs text-danger-text">{message}</li>
                ))}
              </ul>
            </div>
          )}

          {validation && validation.headerErrors.length === 0 && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-subtle">
                <span>
                  <span className="text-text-secondary">{validation.records.length}</span> of {validation.totalDataRows} row{validation.totalDataRows !== 1 ? 's' : ''} ready to import
                </span>
                {validation.ignoredColumns.length > 0 && (
                  <span>Ignored columns: {validation.ignoredColumns.join(', ')}</span>
                )}
              </div>

              {validation.rowErrors.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-amber-300">
                    {validation.rowErrors.length} problem{validation.rowErrors.length !== 1 ? 's' : ''} found (these rows will be skipped)
                  </p>
                  <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                    {validation.rowErrors.slice(0, ERROR_DISPLAY_LIMIT).map((error, index) => (
                      <li key={`${error.row}-${index}`} className="font-mono text-xs text-amber-400">{formatRowError(error)}</li>
                    ))}
                  </ul>
                  {validation.rowErrors.length > ERROR_DISPLAY_LIMIT && (
                    <p className="mt-1 text-xs text-amber-400/80">and {validation.rowErrors.length - ERROR_DISPLAY_LIMIT} more</p>
                  )}
                </div>
              )}

              {validation.records.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-text-subtle">Preview (first {Math.min(PREVIEW_ROW_LIMIT, validation.records.length)} rows)</p>
                  <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="border-b border-zinc-700/40 text-left text-text-subtle">
                          <th className="px-3 py-2 font-medium">Row</th>
                          {previewFields.map(field => <th key={field} className="px-3 py-2 font-medium">{field}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {validation.records.slice(0, PREVIEW_ROW_LIMIT).map((record, index) => (
                          <tr key={record.row} className={`border-b border-zinc-700/20 ${index % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                            <td className="px-3 py-2 font-mono text-text-subtle">{record.row}</td>
                            {previewFields.map(field => (
                              <td key={field} className="max-w-[160px] truncate px-3 py-2 text-text-secondary">{record.values[field] ?? ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Progress */}
          {running && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                <span>Importing {importer.processed} of {importer.total} rows</span>
                <span>{percent}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-zinc-800"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Import progress"
              >
                <div className="h-full rounded-full bg-amber-500/80 transition-all duration-200" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}

          {/* Result report */}
          {finished && importer.summary && (
            <div className="space-y-3">
              <div className={`rounded-xl border px-4 py-3 ${importer.summary.failed > 0 || importer.summary.cancelled ? 'border-amber-500/30 bg-amber-500/10' : 'border-green-500/30 bg-green-500/10'}`}>
                <p className={`text-sm font-medium ${importer.summary.failed > 0 || importer.summary.cancelled ? 'text-amber-300' : 'text-success-text'}`}>
                  {importer.status === 'cancelled'
                    ? `Import cancelled: ${importer.summary.imported} of ${importer.summary.total} rows imported before cancelling.`
                    : `Imported ${importer.summary.imported} of ${importer.summary.total} rows${importer.summary.failed > 0 ? `, ${importer.summary.failed} failed` : ''}.`}
                </p>
              </div>
              {failedResults.length > 0 && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-danger-text">Rows that failed</p>
                  <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                    {failedResults.map(result => (
                      <li key={result.row} className="font-mono text-xs text-danger-text">Row {result.row}: {result.error ?? 'unknown error'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            {running ? (
              <button type="button" onClick={importer.cancel} className="btn-neutral px-4 py-2 text-sm">Cancel import</button>
            ) : finished ? (
              <>
                <button type="button" onClick={handleStartOver} className="btn-neutral px-4 py-2 text-sm">Start over</button>
                <button type="button" onClick={handleClose} className="btn-accent px-4 py-2 text-sm">Close</button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleClose} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
                <button type="button" onClick={handleImport} disabled={!canImport} className="btn-accent px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  {validation && canImport ? `Import ${validation.records.length} row${validation.records.length !== 1 ? 's' : ''}` : 'Import'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
