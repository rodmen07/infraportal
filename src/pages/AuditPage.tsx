import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'
import { resolveAdminToken } from '../config'
import { countActiveAuditFilters, getAuditEmptyState } from '../utils/auditUi'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'
const AUDIT_URL = (import.meta.env.VITE_AUDIT_API_BASE_URL ?? '').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuditEvent {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string
  entity_label?: string
  payload?: string
  created_at: string
}

interface AuditEventsResponse {
  data: AuditEvent[]
  total: number
  limit: number
  offset: number
}

const ENTITY_TYPES = ['', 'account', 'contact', 'opportunity', 'activity']
const ACTIONS      = ['', 'created', 'updated', 'deleted']
const PAGE_SIZE    = 50

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolveAdminToken()}`,
      ...opts.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

function AuditTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-700/40 bg-zinc-900/55">
      <div className="grid grid-cols-2 gap-3 border-b border-zinc-700/40 px-4 py-3 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-3 animate-pulse rounded bg-zinc-800/80" />
        ))}
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((__, col) => (
              <div
                key={`${row}-${col}`}
                className={`animate-pulse rounded bg-zinc-800/70 ${col === 1 ? 'h-6 w-20 rounded-full' : 'h-4 w-full'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-3 border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-red-200">Unable to load audit events</p>
        <p className="mt-1 text-sm text-red-100/90">{message}</p>
      </div>
      <button className="btn-accent px-3 py-2 text-sm" onClick={onRetry}>Retry</button>
    </div>
  )
}

function EmptyState({
  badge,
  title,
  message,
  actionLabel,
  onAction,
}: {
  badge: string
  title: string
  message: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="forge-panel surface-card-strong p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M8 11h8M8 15h5" />
        </svg>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">{badge}</p>
      <h3 className="mt-2 text-xl font-semibold text-zinc-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-400">{message}</p>
      <div className="mt-5 flex justify-center">
        <button className="btn-accent px-4 py-2 text-sm" onClick={onAction}>{actionLabel}</button>
      </div>
    </div>
  )
}

const SELECT = 'rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400/50 focus:outline-none'
const INPUT  = `${SELECT} w-full placeholder-zinc-500`

function actionBadge(action: string) {
  if (action === 'created') return 'text-emerald-400'
  if (action === 'deleted') return 'text-red-400'
  return 'text-amber-300'
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------
interface Filters {
  entity_type: string
  action: string
  actor_id: string
  created_after: string
  created_before: string
}

function FilterBar({
  filters,
  onChange,
  onReset,
  activeFilterCount,
}: {
  filters: Filters
  onChange: (k: keyof Filters, v: string) => void
  onReset: () => void
  activeFilterCount: number
}) {
  return (
    <div className="forge-panel surface-card-strong p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Entity type</span>
          <select className={SELECT} value={filters.entity_type} onChange={e => onChange('entity_type', e.target.value)}>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t || 'All types'}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Action</span>
          <select className={SELECT} value={filters.action} onChange={e => onChange('action', e.target.value)}>
            {ACTIONS.map(a => <option key={a} value={a}>{a || 'All actions'}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Actor ID</span>
          <input
            className={INPUT}
            value={filters.actor_id}
            onChange={e => onChange('actor_id', e.target.value)}
            placeholder="user UUID"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">After (UTC)</span>
          <input
            type="datetime-local"
            className={INPUT}
            value={filters.created_after}
            onChange={e => onChange('created_after', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-400">Before (UTC)</span>
          <input
            type="datetime-local"
            className={INPUT}
            value={filters.created_before}
            onChange={e => onChange('created_before', e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active` : 'Showing all audit events'}
        </p>
        <button className="btn-neutral px-3 py-2 text-xs" onClick={onReset} disabled={activeFilterCount === 0}>
          Clear filters
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit view
// ---------------------------------------------------------------------------
const EMPTY_FILTERS: Filters = {
  entity_type: '',
  action: '',
  actor_id: '',
  created_after: '',
  created_before: '',
}

function AuditView() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage]       = useState(0)
  const [result, setResult]   = useState<AuditEventsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const activeFilterCount     = countActiveAuditFilters(filters)
  const emptyState            = getAuditEmptyState(filters)

  const load = useCallback(async () => {
    if (!AUDIT_URL) { setError('VITE_AUDIT_API_BASE_URL is not configured'); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      if (filters.entity_type) params.set('entity_type', filters.entity_type)
      if (filters.action)      params.set('action', filters.action)
      if (filters.actor_id.trim()) params.set('actor_id', filters.actor_id.trim())
      if (filters.created_after)  params.set('created_after',  filters.created_after.replace('T', ' ') + ':00Z')
      if (filters.created_before) params.set('created_before', filters.created_before.replace('T', ' ') + ':00Z')
      const data = await api<AuditEventsResponse>(`${AUDIT_URL}/api/v1/audit-events?${params}`)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { load() }, [load])

  const changeFilter = (k: keyof Filters, v: string) => {
    setPage(0)
    setFilters(f => ({ ...f, [k]: v }))
  }

  const resetFilters = () => { setPage(0); setFilters(EMPTY_FILTERS) }

  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 0

  return (
    <div className="space-y-6">
      <FilterBar
        filters={filters}
        onChange={changeFilter}
        onReset={resetFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Summary row */}
      {result && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>
              {result.total} event{result.total !== 1 ? 's' : ''} total
              {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
            </span>
            {activeFilterCount > 0 && <span className="fx-chip">{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</span>}
          </div>
          <div className="flex gap-2">
            <button
              className="btn-neutral text-xs"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >Prev</button>
            <button
              className="btn-neutral text-xs"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1 || loading}
            >Next</button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={load} />}

      {/* Table */}
      {loading ? (
        <AuditTableSkeleton />
      ) : result?.data.length === 0 ? (
        <EmptyState
          badge={emptyState.badge}
          title={emptyState.title}
          message={emptyState.description}
          actionLabel={emptyState.actionLabel}
          onAction={activeFilterCount > 0 ? resetFilters : load}
        />
      ) : result ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/40 bg-zinc-800/40 text-left text-xs text-zinc-400">
                <th className="px-4 py-2.5 font-medium">Timestamp</th>
                <th className="px-4 py-2.5 font-medium">Entity</th>
                <th className="px-4 py-2.5 font-medium">ID</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Label</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map(ev => (
                <tr key={ev.id} className="border-b border-zinc-700/20 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{ev.created_at}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-600/40 bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-300">
                      {ev.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400 max-w-[140px] truncate" title={ev.entity_id}>
                    {ev.entity_id.slice(0, 8)}…
                  </td>
                  <td className={`px-4 py-3 text-xs font-semibold ${actionBadge(ev.action)}`}>
                    {ev.action}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400 max-w-[140px] truncate" title={ev.actor_id}>
                    {ev.actor_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-300">{ev.entity_label ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function AuditPage() {
  return (
    <PageLayout title="Audit Log" subtitle="Immutable record of CRM mutations">
      <AuthGate>
        <AuditView />
      </AuthGate>
    </PageLayout>
  )
}
