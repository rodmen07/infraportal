import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'
const ADMIN_JWT = import.meta.env.VITE_ADMIN_JWT ?? ''
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
      Authorization: `Bearer ${ADMIN_JWT}`,
      ...opts.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-12 text-center text-sm text-zinc-500">{message}</p>
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
}: {
  filters: Filters
  onChange: (k: keyof Filters, v: string) => void
  onReset: () => void
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
      <div className="mt-3 flex justify-end">
        <button className="btn-neutral text-xs" onClick={onReset}>Clear filters</button>
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
      <FilterBar filters={filters} onChange={changeFilter} onReset={resetFilters} />

      {/* Summary row */}
      {result && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {result.total} event{result.total !== 1 ? 's' : ''} total
            {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
          </p>
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
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error} <button className="ml-2 underline" onClick={load}>Retry</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <Spinner />
      ) : result?.data.length === 0 ? (
        <EmptyState message="No audit events match the current filters." />
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
