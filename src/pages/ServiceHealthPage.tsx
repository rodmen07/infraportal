import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY       = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'
const ACCOUNTS_URL    = (import.meta.env.VITE_ACCOUNTS_API_BASE_URL     ?? '').replace(/\/$/, '')
const CONTACTS_URL    = (import.meta.env.VITE_CONTACTS_API_BASE_URL     ?? '').replace(/\/$/, '')
const ACTIVITIES_URL  = (import.meta.env.VITE_ACTIVITIES_API_BASE_URL   ?? '').replace(/\/$/, '')
const OPPS_URL        = (import.meta.env.VITE_OPPORTUNITIES_API_BASE_URL ?? '').replace(/\/$/, '')
const AUTOMATION_URL  = (import.meta.env.VITE_AUTOMATION_API_BASE_URL   ?? '').replace(/\/$/, '')
const INTEGRATIONS_URL= (import.meta.env.VITE_INTEGRATIONS_API_BASE_URL ?? '').replace(/\/$/, '')
const REPORTING_URL   = (import.meta.env.VITE_REPORTING_API_BASE_URL    ?? '').replace(/\/$/, '')
const SEARCH_URL      = (import.meta.env.VITE_SEARCH_API_BASE_URL       ?? '').replace(/\/$/, '')
const AUDIT_URL       = (import.meta.env.VITE_AUDIT_API_BASE_URL        ?? '').replace(/\/$/, '')
const OBSERVABOARD    = (import.meta.env.VITE_OBSERVABOARD_URL           ?? '').replace(/\/$/, '')
const STREAM_URL      = (import.meta.env.VITE_EVENT_STREAM_URL           ?? '').replace(/\/$/, '')

const REFRESH_MS = 30_000

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------
interface ServiceDef {
  name: string
  group: 'CRM' | 'Platform' | 'External'
  baseUrl: string
  healthPath: string
}

const SERVICES: ServiceDef[] = [
  { name: 'Accounts',      group: 'CRM',      baseUrl: ACCOUNTS_URL,     healthPath: '/health' },
  { name: 'Contacts',      group: 'CRM',      baseUrl: CONTACTS_URL,     healthPath: '/health' },
  { name: 'Activities',    group: 'CRM',      baseUrl: ACTIVITIES_URL,   healthPath: '/health' },
  { name: 'Opportunities', group: 'CRM',      baseUrl: OPPS_URL,         healthPath: '/health' },
  { name: 'Automation',    group: 'Platform', baseUrl: AUTOMATION_URL,   healthPath: '/health' },
  { name: 'Integrations',  group: 'Platform', baseUrl: INTEGRATIONS_URL, healthPath: '/health' },
  { name: 'Reporting',     group: 'Platform', baseUrl: REPORTING_URL,    healthPath: '/health' },
  { name: 'Search',        group: 'Platform', baseUrl: SEARCH_URL,       healthPath: '/health' },
  { name: 'Audit',         group: 'Platform', baseUrl: AUDIT_URL,        healthPath: '/health' },
  { name: 'Event Stream',  group: 'Platform', baseUrl: STREAM_URL,       healthPath: '/health' },
  { name: 'Observaboard',  group: 'External', baseUrl: OBSERVABOARD,     healthPath: '/api/health/' },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type HealthStatus = 'checking' | 'ok' | 'degraded' | 'error' | 'unconfigured'

interface ServiceHealth {
  name: string
  group: ServiceDef['group']
  baseUrl: string
  status: HealthStatus
  detail: string
  latencyMs: number | null
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function ServiceHealthCardSkeleton() {
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-3 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="h-4 w-32 rounded bg-zinc-800" />
          <div className="h-3 w-20 rounded bg-zinc-800 mt-2" />
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-800 flex-shrink-0 mt-1" />
      </div>

      <div className="border-t border-zinc-700/30 pt-2 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-12 rounded bg-zinc-800" />
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-24 rounded bg-zinc-800" />
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-16 rounded bg-zinc-800" />
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-28 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function SummaryBarSkeleton() {
  return (
    <div className="forge-panel surface-card-strong flex flex-wrap items-center gap-4 p-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="inline-block h-3 w-3 rounded-full bg-zinc-800" />
        <div className="h-4 w-48 rounded bg-zinc-800" />
      </div>
      <div className="ml-auto flex gap-4 text-xs">
        <div className="h-3 w-24 rounded bg-zinc-800" />
        <div className="h-3 w-24 rounded bg-zinc-800" />
      </div>
    </div>
  )
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
// Health polling
// ---------------------------------------------------------------------------
async function checkService(svc: ServiceDef): Promise<ServiceHealth> {
  const base: Omit<ServiceHealth, 'status' | 'detail' | 'latencyMs'> = {
    name: svc.name,
    group: svc.group,
    baseUrl: svc.baseUrl,
  }

  if (!svc.baseUrl) {
    return { ...base, status: 'unconfigured', detail: 'URL not configured', latencyMs: null }
  }

  const start = performance.now()
  try {
    const res = await fetch(`${svc.baseUrl}${svc.healthPath}`, {
      signal: AbortSignal.timeout(8_000),
    })
    const latencyMs = Math.round(performance.now() - start)

    if (!res.ok) {
      return { ...base, status: 'error', detail: `HTTP ${res.status}`, latencyMs }
    }

    const body = await res.json().catch(() => ({}))
    const status: string = body?.status ?? 'ok'

    if (status === 'ok') {
      return { ...base, status: 'ok', detail: 'ok', latencyMs }
    }
    if (status === 'degraded') {
      const checks = Object.entries(body as Record<string, string>)
        .filter(([k, v]) => k !== 'status' && v !== 'ok')
        .map(([k]) => k)
        .join(', ')
      return { ...base, status: 'degraded', detail: `degraded: ${checks || 'unknown'}`, latencyMs }
    }
    return { ...base, status: 'error', detail: status, latencyMs }
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start)
    const msg = e instanceof Error ? e.message : 'fetch error'
    return { ...base, status: 'error', detail: msg.includes('timeout') ? 'timeout' : 'unreachable', latencyMs }
  }
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------
function statusDot(s: HealthStatus) {
  if (s === 'ok')           return 'bg-emerald-400'
  if (s === 'degraded')     return 'bg-amber-400'
  if (s === 'error')        return 'bg-red-400'
  if (s === 'checking')     return 'bg-zinc-500 animate-pulse'
  return 'bg-zinc-600'
}

function statusText(s: HealthStatus) {
  if (s === 'ok')           return 'text-emerald-400'
  if (s === 'degraded')     return 'text-amber-400'
  if (s === 'error')        return 'text-red-400'
  if (s === 'checking')     return 'text-zinc-400'
  return 'text-zinc-500'
}

function statusLabel(s: HealthStatus) {
  if (s === 'ok')           return 'ok'
  if (s === 'degraded')     return 'degraded'
  if (s === 'error')        return 'error'
  if (s === 'checking')     return 'checking…'
  return 'not configured'
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------
function SummaryBar({ results }: { results: ServiceHealth[] }) {
  const configured = results.filter(r => r.status !== 'unconfigured')
  const ok       = configured.filter(r => r.status === 'ok').length
  const degraded = configured.filter(r => r.status === 'degraded').length
  const errors   = configured.filter(r => r.status === 'error').length
  const checking = configured.filter(r => r.status === 'checking').length

  const overall: HealthStatus =
    checking > 0       ? 'checking'
    : errors > 0       ? 'error'
    : degraded > 0     ? 'degraded'
    : ok === configured.length ? 'ok'
    : 'unconfigured'

  return (
    <div className="forge-panel surface-card-strong flex flex-wrap items-center gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-3 w-3 rounded-full ${statusDot(overall)}`} />
        <span className={`text-sm font-semibold ${statusText(overall)}`}>
          {overall === 'ok' ? 'All systems operational' : statusLabel(overall)}
        </span>
      </div>
      <div className="ml-auto flex gap-4 text-xs text-zinc-500">
        {ok > 0       && <span><span className="text-emerald-400 font-medium">{ok}</span> ok</span>}
        {degraded > 0 && <span><span className="text-amber-400 font-medium">{degraded}</span> degraded</span>}
        {errors > 0   && <span><span className="text-red-400 font-medium">{errors}</span> error</span>}
        <span>{configured.length} services</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Service card
// ---------------------------------------------------------------------------
function ServiceCard({ svc }: { svc: ServiceHealth }) {
  if (svc.status === 'checking') {
    return <ServiceHealthCardSkeleton />
  }

  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{svc.name}</p>
          <span className="inline-block rounded-full border border-zinc-700/40 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-500 mt-1">
            {svc.group}
          </span>
        </div>
        <span className={`inline-block h-2.5 w-2.5 rounded-full mt-1 flex-shrink-0 ${statusDot(svc.status)}`} />
      </div>

      <div className="border-t border-zinc-700/30 pt-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Status</span>
          <span className={`font-medium ${statusText(svc.status)}`}>{statusLabel(svc.status)}</span>
        </div>
        {svc.status !== 'unconfigured' && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Detail</span>
            <span className="text-zinc-400 max-w-[160px] truncate text-right" title={svc.detail}>{svc.detail}</span>
          </div>
        )}
        {svc.latencyMs !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Latency</span>
            <span className="text-zinc-400">{svc.latencyMs} ms</span>
          </div>
        )}
        {svc.baseUrl && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">URL</span>
            <span className="text-zinc-600 max-w-[180px] truncate text-right font-mono text-[10px]" title={svc.baseUrl}>
              {svc.baseUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Health dashboard
// ---------------------------------------------------------------------------
function HealthView() {
  const initialResults = (): ServiceHealth[] =>
    SERVICES.map(s => ({
      name: s.name,
      group: s.group,
      baseUrl: s.baseUrl,
      status: 'checking' as HealthStatus,
      detail: '',
      latencyMs: null,
    }))

  const [results, setResults]     = useState<ServiceHealth[]>(initialResults)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [refreshing, setRefreshing]   = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setResults(initialResults())
    const checks = await Promise.allSettled(SERVICES.map(checkService))
    setResults(checks.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { name: SERVICES[i].name, group: SERVICES[i].group, baseUrl: SERVICES[i].baseUrl, status: 'error' as HealthStatus, detail: 'unexpected error', latencyMs: null }
    ))
    setLastChecked(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    // Schedule the initial refresh to happen asynchronously after the current render cycle.
    // This prevents the linter error regarding synchronous setState calls within the effect.
    const initialRefreshTimer = setTimeout(() => {
      void refresh()
    }, 0)

    const intervalId = setInterval(refresh, REFRESH_MS)

    return () => {
      clearTimeout(initialRefreshTimer)
      clearInterval(intervalId)
    }
  }, [refresh])

  const groups: ServiceDef['group'][] = ['CRM', 'Platform', 'External']
  const allServicesChecking = results.every(r => r.status === 'checking')

  return (
    <div className="space-y-6">
      {allServicesChecking || refreshing ? <SummaryBarSkeleton /> : <SummaryBar results={results} />}

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {lastChecked
            ? `Last checked ${lastChecked.toLocaleTimeString()} · auto-refreshes every 30 s`
            : <span className="inline-block h-3 w-48 rounded bg-zinc-800 animate-pulse" /> // Skeleton for 'Checking...'
          }
        </p>
        <button
          className="btn-neutral text-xs"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      {/* Service grid by group */}
      {groups.map(group => {
        const groupSvcs = results.filter(r => r.group === group)
        if (groupSvcs.length === 0) return null
        return (
          <section key={group}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">{group}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groupSvcs.map(svc => <ServiceCard key={svc.name} svc={svc} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------
export function ServiceHealthPage() {
  return (
    <PageLayout title="Service Health" subtitle="Real-time status of all InfraPortal services">
      <AuthGate>
        <HealthView />
      </AuthGate>
    </PageLayout>
  )
}
