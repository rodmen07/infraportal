import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'
import { resolveAdminToken } from '../config'

// ---------------------------------------------------------------------------\
// Config
// ---------------------------------------------------------------------------\
const ADMIN_KEY     = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'
const REPORTING_URL = (import.meta.env.VITE_REPORTING_API_BASE_URL ?? '').replace(/\/?$/, '')

// ---------------------------------------------------------------------------\
// Types
// ---------------------------------------------------------------------------\
interface SavedReport {
  id: string
  name: string
  description?: string
  metric: string
  dimension?: string
  created_at: string
  updated_at: string
}

interface DashboardSummary {
  active_reports: number
  core_metrics: string[]
}

type ModalMode =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; record: SavedReport }
  | { mode: 'delete'; id: string; label: string }
  | { mode: 'export' }

// ---------------------------------------------------------------------------\
// Auth gate
// ---------------------------------------------------------------------------\
function AuthGate({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(() => sessionStorage.getItem('admin_key') ?? '')
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  if (key === ADMIN_KEY) return <>{children}</>

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input === ADMIN_KEY) {
      sessionStorage.setItem('admin_key', input)
      setKey(input)
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={submit} className="forge-panel surface-card-strong w-full max-w-sm space-y-4 p-6">
        <h2 className="text-base font-semibold text-zinc-100">Admin access required</h2>
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false) }}
          placeholder="Admin key"
          className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
        />
        {error && <p className="text-xs text-red-400">Invalid key</p>}
        <button type="submit" className="btn-accent w-full">Unlock</button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------\
// Shared helpers
// ---------------------------------------------------------------------------\
async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolveAdminToken()}`,
      ...opts.headers,
    },
  })
  if (res.status === 204) return null as T
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

function EmptyReportsState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <svg className="h-8 w-8 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75M6.75 3H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25A2.25 2.25 0 0018.75 3H6.75z" />
      </svg>
      <p className="text-sm font-medium text-zinc-400">No saved reports yet</p>
      <p className="text-xs text-zinc-600">Create new reports to see them listed here.</p>
    </div>
  )
}

function SaveError({ message }: { message: string }) {
  return <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{message}</p>
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

const INPUT = 'w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none'

// ---------------------------------------------------------------------------\
// Skeleton components
// ---------------------------------------------------------------------------\
function DashboardCardSkeleton() {
  return (
    <div className="forge-panel surface-card-strong p-5 animate-pulse">
      <div className="flex items-center gap-6">
        <div className="text-center space-y-1">
          <div className="h-8 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-24 rounded bg-zinc-800" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-20 rounded-full bg-zinc-800" />
          <div className="h-6 w-24 rounded-full bg-zinc-800" />
          <div className="h-6 w-16 rounded-full bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function ReportTableRowSkeleton() {
  return (
    <tr className="border-b border-zinc-700/20">
      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-zinc-800" /></td>
      <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-zinc-800" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-zinc-800" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-zinc-800" /></td>
      <td className="px-4 py-3">
        <div className="flex gap-2 justify-end">
          <div className="h-4 w-8 rounded bg-zinc-800" />
          <div className="h-4 w-10 rounded bg-zinc-800" />
        </div>
      </td>
    </tr>
  )
}

function ReportTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-700/40 animate-pulse">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700/40 bg-zinc-800/40 text-left text-xs text-zinc-400">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Metric</th>
            <th className="px-4 py-2.5 font-medium">Dimension</th>
            <th className="px-4 py-2.5 font-medium">Created</th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          <ReportTableRowSkeleton />
          <ReportTableRowSkeleton />
          <ReportTableRowSkeleton />
          <ReportTableRowSkeleton />
        </tbody>
      </table>
    </div>
  )
}

function ReportsViewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <DashboardCardSkeleton />

      {/* Table header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-zinc-800" /> {/* For "Saved Reports" title */}
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-lg bg-zinc-800" /> {/* For "Export" button */}
          <div className="h-7 w-28 rounded-lg bg-zinc-800" /> {/* For "+ New Report" button */}
        </div>
      </div>

      <ReportTableSkeleton />
    </div>
  )
}

// ---------------------------------------------------------------------------\
// Modal
// ---------------------------------------------------------------------------\
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="forge-panel surface-card-strong w-full max-w-md space-y-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------\
// Report form (create / edit)
// ---------------------------------------------------------------------------\
interface ReportFormData { name: string; metric: string; dimension: string; description: string }

function ReportForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SavedReport
  onSave: (data: ReportFormData) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<ReportFormData>({
    name:        initial?.name        ?? '',
    metric:      initial?.metric      ?? '',
    dimension:   initial?.dimension   ?? '',
    description: initial?.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof ReportFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.metric.trim()) { setErr('Name and metric are required'); return }
    setSaving(true); setErr(null)
    try { await onSave(form) } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Save failed') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FormField label="Name *">
        <input className={INPUT} value={form.name} onChange={set('name')} placeholder="Weekly pipeline report" />
      </FormField>
      <FormField label="Metric *">
        <input className={INPUT} value={form.metric} onChange={set('metric')} placeholder="opportunities_by_stage" />
      </FormField>
      <FormField label="Dimension">
        <input className={INPUT} value={form.dimension} onChange={set('dimension')} placeholder="account" />
      </FormField>
      <FormField label="Description">
        <textarea className={`${INPUT} resize-none`} rows={2} value={form.description} onChange={set('description')} placeholder="Optional description" />
      </FormField>
      {err && <SaveError message={err} />}
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-accent flex-1" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-neutral flex-1" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------\
// Export form
// ---------------------------------------------------------------------------\
function ExportForm({ onClose, metrics }: { onClose: () => void; metrics: string[] }) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [metric, setMetric] = useState('')
  const [exporting, setExporting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true); setErr(null)
    try {
      const params = new URLSearchParams({ format })
      if (metric) params.set('metric', metric)
      const res = await fetch(`${REPORTING_URL}/api/v1/reports/export?${params}`, {
        headers: { Authorization: `Bearer ${resolveAdminToken()}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `${res.status} ${res.statusText}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reports-export.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-3">
      <FormField label="Format">
        <div className="flex gap-2">
          {(['csv', 'json'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                format === f
                  ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                  : 'border-zinc-600/50 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </FormField>
      <FormField label="Filter by metric (optional)">
        <select
          className={INPUT}
          value={metric}
          onChange={e => setMetric(e.target.value)}
        >
          <option value="">All metrics</option>
          {metrics.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </FormField>
      {err && <SaveError message={err} />}
      <div className="flex gap-2 pt-1">
        <button className="btn-accent flex-1" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Download'}
        </button>
        <button className="btn-neutral flex-1" onClick={onClose} disabled={exporting}>Cancel</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------\
// Dashboard summary card
// ---------------------------------------------------------------------------\
function DashboardCard({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="forge-panel surface-card-strong p-5">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-amber-300">{summary.active_reports}</div>
          <div className="mt-0.5 text-xs text-zinc-500">active reports</div>
        </div>
        {summary.core_metrics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {summary.core_metrics.map(m => (
              <span key={m} className="rounded-full border border-zinc-600/40 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300">{m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------\
// Reports view
// ---------------------------------------------------------------------------\
function ReportsView() {
  const [summary, setSummary]   = useState<DashboardSummary | null>(null)
  const [reports, setReports]   = useState<SavedReport[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [modal, setModal]       = useState<ModalMode>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!REPORTING_URL) { setError('VITE_REPORTING_API_BASE_URL is not configured'); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const [s, r] = await Promise.all([
        api<DashboardSummary>(`${REPORTING_URL}/api/v1/reports/dashboard`),
        api<SavedReport[]>(`${REPORTING_URL}/api/v1/reports`),
      ])
      setSummary(s)
      setReports(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (form: ReportFormData) => {
    const body = {
      name: form.name,
      metric: form.metric,
      ...(form.dimension.trim() && { dimension: form.dimension }),
      ...(form.description.trim() && { description: form.description }),
    }
    if (modal?.mode === 'edit') {
      await api(`${REPORTING_URL}/api/v1/reports/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    } else {
      await api(`${REPORTING_URL}/api/v1/reports`, { method: 'POST', body: JSON.stringify(body) })
    }
    setModal(null)
    load()
  }

  const handleDelete = async () => {
    if (modal?.mode !== 'delete') return
    setDeleting(true)
    try {
      await api(`${REPORTING_URL}/api/v1/reports/${modal.id}`, { method: 'DELETE' })
      setModal(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <ReportsViewSkeleton />
  if (error) return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {error} <button className="ml-2 underline" onClick={load}>Retry</button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Dashboard summary */}
      {summary && <DashboardCard summary={summary} />}

      {/* Table header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Saved Reports</h2>
        <div className="flex gap-2">
          <button className="btn-neutral text-xs" onClick={() => setModal({ mode: 'export' })}>Export</button>
          <button className="btn-accent text-xs" onClick={() => setModal({ mode: 'create' })}>+ New Report</button>
        </div>
      </div>

      {/* Reports table */}
      {reports.length === 0 ? (
        <EmptyReportsState />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/40 bg-zinc-800/40 text-left text-xs text-zinc-400">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Metric</th>
                <th className="px-4 py-2.5 font-medium">Dimension</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-b border-zinc-700/20 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 font-medium text-zinc-100">{r.name}</td>
                  <td className="px-4 py-3 text-zinc-300">{r.metric}</td>
                  <td className="px-4 py-3 text-zinc-400">{r.dimension ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{r.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        className="text-xs text-zinc-400 hover:text-zinc-100 transition"
                        onClick={() => setModal({ mode: 'edit', record: r })}
                      >Edit</button>
                      <button
                        className="text-xs text-red-400 hover:text-red-300 transition"
                        onClick={() => setModal({ mode: 'delete', id: r.id, label: r.name })}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal?.mode === 'create' && (
        <Modal title="New Report" onClose={() => setModal(null)}>
          <ReportForm onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Edit Report" onClose={() => setModal(null)}>
          <ReportForm initial={modal.record} onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'export' && (
        <Modal title="Export Reports" onClose={() => setModal(null)}>
          <ExportForm onClose={() => setModal(null)} metrics={summary?.core_metrics ?? []} />
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <Modal title="Delete Report" onClose={() => setModal(null)}>
          <p className="text-sm text-zinc-300">Delete <strong className="text-zinc-100">{modal.label}</strong>? This cannot be undone.</p>
          <div className="flex gap-2 pt-1">
            <button className="btn-accent flex-1 !bg-red-500/20 !border-red-500/40 !text-red-300 hover:!bg-red-500/30" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button className="btn-neutral flex-1" onClick={() => setModal(null)} disabled={deleting}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------\
// Page
// ---------------------------------------------------------------------------\
export function ReportsPage() {
  return (
    <PageLayout title="Reports" subtitle="Saved reports and dashboard metrics">
      <AuthGate>
        <ReportsView />
      </AuthGate>
    </PageLayout>
  )
}
