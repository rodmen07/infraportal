import { useState, useRef } from 'react'
import { PageLayout } from './PageLayout'
import { resolveAdminToken } from '../config'
import { getSearchStateCopy } from '../utils/searchUi'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY  = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'
const SEARCH_URL = (import.meta.env.VITE_SEARCH_API_BASE_URL ?? '').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SearchResult {
  id: string
  entity_type: string
  entity_id: string
  title: string
  snippet: string
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
function SearchEmptyState({
  badge,
  title,
  description,
  actionLabel,
  onAction,
}: {
  badge: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="forge-panel surface-card-strong p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
        <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">{badge}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-100">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{description}</p>
      <div className="mt-5 flex justify-center">
        <button className="btn-accent px-4 py-2 text-sm" onClick={onAction}>{actionLabel}</button>
      </div>
    </div>
  )
}

function SearchErrorState({ message, onRetry, onClear }: { message: string; onRetry: () => void; onClear: () => void }) {
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-3 border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-red-200">Search is temporarily unavailable</p>
        <p className="mt-1 text-sm text-red-100/90">{message}</p>
      </div>
      <div className="flex gap-2">
        <button className="btn-accent px-3 py-2 text-sm" onClick={onRetry}>Retry</button>
        <button className="btn-neutral px-3 py-2 text-sm" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}

const ENTITY_COLORS: Record<string, string> = {
  account:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  contact:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  opportunity: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  activity:    'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

function EntityBadge({ type }: { type: string }) {
  const cls = ENTITY_COLORS[type] ?? 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------
function ResultCard({ result }: { result: SearchResult }) {
  return (
    <div className="forge-panel surface-card-strong space-y-1.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-zinc-100">{result.title}</span>
        <EntityBadge type={result.entity_type} />
      </div>
      {result.snippet && (
        <p className="text-xs leading-relaxed text-zinc-400">{result.snippet}</p>
      )}
      <p className="text-xs text-zinc-600">id: {result.entity_id}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------
function ResultCardSkeleton() {
  return (
    <div className="forge-panel surface-card-strong space-y-1.5 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-2/3 rounded bg-zinc-800" />
        <div className="h-4 w-16 rounded-full bg-zinc-800" /> {/* Mimic EntityBadge */}
      </div>
      <div className="h-3 w-full rounded bg-zinc-800" />
      <div className="h-3 w-1/2 rounded bg-zinc-800" />
    </div>
  )
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Group 1 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 rounded-full bg-zinc-800" /> {/* EntityBadge */}
          <div className="h-3 w-24 rounded bg-zinc-800" /> {/* Count */}
        </div>
        <div className="space-y-2">
          <ResultCardSkeleton />
          <ResultCardSkeleton />
        </div>
      </div>
      {/* Group 2 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 rounded-full bg-zinc-800" /> {/* EntityBadge */}
          <div className="h-3 w-20 rounded bg-zinc-800" /> {/* Count */}
        </div>
        <div className="space-y-2">
          <ResultCardSkeleton />
          <ResultCardSkeleton />
          <ResultCardSkeleton />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search view (grouped by entity_type)
// ---------------------------------------------------------------------------
function SearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchCopy = getSearchStateCopy(query, results.length)
  const sampleQueries = ['acme', 'renewal', 'onboarding']

  const doSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    if (!SEARCH_URL) { setError('VITE_SEARCH_API_BASE_URL is not configured'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${SEARCH_URL}/api/v1/search?q=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${resolveAdminToken()}` },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data: SearchResult[] = await res.json()
      setResults(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleInput = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setQuery('')
    setResults([])
    setError(null)
    setLoading(false)
  }

  // Group results by entity_type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.entity_type] ??= []).push(r)
    return acc
  }, {})
  const groupKeys = Object.keys(grouped).sort()

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder={SEARCH_URL ? 'Search across accounts, contacts, opportunities, activities…' : 'VITE_SEARCH_API_BASE_URL not configured'}
            disabled={!SEARCH_URL}
            className="w-full rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-4 py-3 pr-16 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none disabled:opacity-40"
          />
          {loading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              Clear
            </button>
          ) : null}
        </div>

        {!query && (
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => handleInput(sample)}
                className="fx-chip transition hover:border-amber-400/40 hover:text-zinc-100"
              >
                {sample}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <SearchErrorState
          message={error}
          onRetry={() => { void doSearch(query) }}
          onClear={clearSearch}
        />
      )}
      
      {/* Loading Skeleton */}
      {loading && query && !error && (
        <SearchResultsSkeleton />
      )}

      {!loading && !error && query && results.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">{searchCopy.badge}</p>
            <p className="mt-1 text-sm text-zinc-400">{searchCopy.description}</p>
          </div>
          <button className="btn-neutral px-3 py-2 text-xs" onClick={clearSearch}>Clear search</button>
        </div>
      )}

      {/* Empty States */}
      {!loading && !error && query && results.length === 0 && (
        <SearchEmptyState
          badge={searchCopy.badge}
          title={searchCopy.title}
          description={searchCopy.description}
          actionLabel={searchCopy.actionLabel}
          onAction={clearSearch}
        />
      )}

      {!query && !loading && (
        <SearchEmptyState
          badge={searchCopy.badge}
          title={searchCopy.title}
          description={searchCopy.description}
          actionLabel={searchCopy.actionLabel}
          onAction={() => handleInput(sampleQueries[0])}
        />
      )}

      {!loading && !error && query && results.length > 0 && groupKeys.map(entityType => (
        <div key={entityType} className="space-y-2">
          <div className="flex items-center gap-2">
            <EntityBadge type={entityType} />
            <span className="text-xs text-zinc-500">{grouped[entityType].length} result{grouped[entityType].length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {grouped[entityType].map(r => <ResultCard key={r.id} result={r} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function SearchPage() {
  return (
    <PageLayout title="Search" subtitle="Cross-domain search across all services">
      <AuthGate>
        <SearchView />
      </AuthGate>
    </PageLayout>
  )
}
