import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'
import { resolveAdminToken } from '../config'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY      = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'
const OBSERVABOARD   = (import.meta.env.VITE_OBSERVABOARD_URL ?? '').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Types  (Django REST Framework paginated list + event model)
// ---------------------------------------------------------------------------
interface ObservaEvent {
  id: number
  source: string
  event_type: string
  category: string
  severity: string
  summary: string
  raw_payload: Record<string, unknown>
  classified: boolean
  created_at: string
}

interface DRFPage {
  count: number
  next: string | null
  previous: string | null
  results: ObservaEvent[]
}

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
// Shared helpers
// ---------------------------------------------------------------------------
async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${resolveAdminToken()}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-12 text-center text-sm text-zinc-500">{message}</p>
}

const SEVERITY_COLORS: Record<string, string> = {
  low:      'bg-zinc-700/40 text-zinc-300 border-zinc-600/30',
  medium:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  high:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const CATEGORY_COLORS: Record<string, string> = {
  deployment: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  security:   'bg-red-500/20 text-red-300 border-red-500/30',
  alert:      'bg-amber-500/20 text-amber-300 border-amber-500/30',
  metric:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  info:       'bg-zinc-700/40 text-zinc-300 border-zinc-600/30',
}

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Event detail row (expandable)
// ---------------------------------------------------------------------------
function EventRow({ event }: { event: ObservaEvent }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        className="border-b border-zinc-700/20 hover:bg-zinc-800/30 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3 text-xs text-zinc-500">{event.created_at.slice(0, 19).replace('T', ' ')}</td>
        <td className="px-4 py-3 text-sm text-zinc-300">{event.source}</td>
        <td className="px-4 py-3 text-sm text-zinc-300">{event.event_type}</td>
        <td className="px-4 py-3"><Badge value={event.category} colorMap={CATEGORY_COLORS} /></td>
        <td className="px-4 py-3"><Badge value={event.severity} colorMap={SEVERITY_COLORS} /></td>
        <td className="px-4 py-3 text-xs text-zinc-400 max-w-xs truncate">{event.summary}</td>
        <td className="px-4 py-3 text-xs text-zinc-500">{event.classified ? '✓' : '—'}</td>
      </tr>
      {open && (
        <tr className="bg-zinc-900/60">
          <td colSpan={7} className="px-4 pb-3 pt-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-400">Summary</p>
              <p className="text-xs text-zinc-300">{event.summary || '—'}</p>
              <p className="mt-2 text-xs font-medium text-zinc-400">Raw payload</p>
              <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-800/60 p-3 text-xs text-zinc-300">
                {JSON.stringify(event.raw_payload, null, 2)}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Observaboard Table Skeleton
// ---------------------------------------------------------------------------
function ObservaboardTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-700/40 animate-pulse">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700/40 bg-zinc-800/40 text-left text-xs text-zinc-400">
            <th className="px-4 py-2.5 font-medium"><div className="h-3 w-16 rounded bg-zinc-800" /></th>
            <th className="px-4 py-2.5 font-medium"><div className="h-3 w-20 rounded bg-zinc-800" /></th>
            <th className="px-4 py-2.5 font-medium"><div className="h-3 w-16 rounded bg-zinc-800" /></th>
            <th className="px-4 py-2.5 font-medium"><div className="h-3 w-24 rounded bg-zinc-800" /></th>
            <th className="px-4 py-2.5 font-medium"><div className="h-3 w-20 rounded bg-zinc-800" /></th>
            <th className="px-4 py-2.5 font-medium"><div className="h-3 w-32 rounded bg-zinc-800" /></th>
            <th className="px-4 py-2.5 font-medium"><div className="h-3 w-20 rounded bg-zinc-800" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b border-zinc-700/20">
              <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-zinc-800" /></td>
              <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-zinc-800" /></td>
              <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-zinc-800" /></td>
              <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-zinc-800" /></td>
              <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-zinc-800" /></td>
              <td className="px-4 py-3"><div className="h-3 w-48 rounded bg-zinc-800" /></td>
              <td className="px-4 py-3"><div className="h-3 w-8 rounded bg-zinc-800" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between text-xs text-zinc-500 py-3 px-4">
        <div className="h-3 w-24 rounded bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-lg bg-zinc-800" />
          <div className="h-7 w-20 rounded-lg bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Observaboard view
// ---------------------------------------------------------------------------
function ObservaboardView() {
  const [page, setPage]         = useState<DRFPage | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [, setCurrentUrl] = useState<string | null>(null)

  // Filters
  const [search, setSearch]     = useState('')
  const [source, setSource]     = useState('')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')

  const buildUrl = useCallback((base?: string) => {
    if (!OBSERVABOARD) return null
    const url = new URL(base ?? `${OBSERVABOARD}/api/events/`)
    if (search.trim())   url.searchParams.set('search', search.trim())
    if (source.trim())   url.searchParams.set('source', source.trim())
    if (category)        url.searchParams.set('category', category)
    if (severity)        url.searchParams.set('severity', severity)
    return url.toString()
  }, [search, source, category, severity])

  const loadUrl = useCallback(async (url: string | null) => {
    if (!url) { setError('VITE_OBSERVABOARD_URL is not configured'); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<DRFPage>(url)
      setPage(data)
      setCurrentUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
    finally {
      setLoading(false)
    }
  }, [])

  // Re-load when filters change (reset to first page)
  useEffect(() => {
    const t = setTimeout(() => loadUrl(buildUrl()), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search, source, category, severity, buildUrl, loadUrl])

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search events…"
          className="flex-1 min-w-[160px] rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
        />
        <input
          type="text"
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="Source"
          className="w-32 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400/50 focus:outline-none"
        >
          <option value="">All categories</option>
          {['deployment','security','alert','metric','info'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400/50 focus:outline-none"
        >
          <option value="">All severities</option>
          {['low','medium','high','critical'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? <ObservaboardTableSkeleton /> : !page || page.results.length === 0 ? (
        <EmptyState message="No events found." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/40 bg-zinc-800/40 text-left text-xs text-zinc-400">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                  <th className="px-4 py-2.5 font-medium">Summary</th>
                  <th className="px-4 py-2.5 font-medium">Classified</th>
                </tr>
              </thead>
              <tbody>
                {page.results.map(e => <EventRow key={e.id} event={e} />)}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{page.count} total events</span>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-zinc-600/40 bg-zinc-800/60 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-40"
                disabled={!page.previous}
                onClick={() => page.previous && loadUrl(page.previous)}
              >
                ← Previous
              </button>
              <button
                className="rounded-lg border border-zinc-600/40 bg-zinc-800/60 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-40"
                disabled={!page.next}
                onClick={() => page.next && loadUrl(page.next)}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function ObservaboardPage() {
  return (
    <PageLayout title="Observaboard" subtitle="Webhook event ingestion and classification">
      <AuthGate>
        <ObservaboardView />
      </AuthGate>
    </PageLayout>
  )
}
