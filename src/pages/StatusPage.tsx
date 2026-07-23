import { useCallback, useEffect, useRef, useState } from 'react'
import { PageLayout } from './PageLayout'
import {
  parseAggregate,
  summarize,
  sortUpstreams,
  hostOf,
  overallLabel,
  statusLabel,
  type Summary,
  type Upstream,
  type UpstreamStatus,
  type OverallState,
} from '../features/status/statusModel'

// The public Platform Status board. Reads the single CORS-enabled go-gateway
// aggregate (see src/features/status/statusModel.ts) and renders it as a live
// board a first-time visitor can watch. All parsing/summarising lives in the
// tested model; this file is the render + polling shell.

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL ?? 'https://go-gateway-5gcrg4oiza-uc.a.run.app').replace(
  /\/$/,
  '',
)
const REFRESH_MS = 30_000
const FETCH_TIMEOUT_MS = 15_000

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded'; upstreams: Upstream[]; summary: Summary; fetchedAt: Date; latencyMs: number }
  | { phase: 'offline'; fetchedAt: Date }

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// Token-based status colours (no bare amber/red, so this page does not deepen
// the v1.19 D12 status-token debt).
const DOT: Record<UpstreamStatus, string> = {
  ok: 'bg-success',
  degraded: 'bg-warning',
  unreachable: 'bg-danger',
}
const TEXT: Record<UpstreamStatus, string> = {
  ok: 'text-success-text',
  degraded: 'text-warning-text',
  unreachable: 'text-danger-text',
}
const BANNER: Record<OverallState, { dot: string; text: string }> = {
  operational: { dot: 'bg-success', text: 'text-success-text' },
  degraded: { dot: 'bg-warning', text: 'text-warning-text' },
  offline: { dot: 'bg-danger', text: 'text-danger-text' },
}

export function StatusPage() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    const start = performance.now()
    try {
      const res = await fetch(`${GATEWAY_URL}/health/upstreams`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      })
      const latencyMs = Math.round(performance.now() - start)
      const body = await res.json().catch(() => null)
      const aggregate = parseAggregate(body)
      if (!aggregate) {
        setState({ phase: 'offline', fetchedAt: new Date() })
        return
      }
      setState({
        phase: 'loaded',
        upstreams: sortUpstreams(aggregate.upstreams),
        summary: summarize(aggregate),
        fetchedAt: new Date(),
        latencyMs,
      })
    } catch {
      setState({ phase: 'offline', fetchedAt: new Date() })
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Poll on mount and every REFRESH_MS. A chained setTimeout (rather than
  // setInterval) avoids overlapping requests when a fetch runs long.
  useEffect(() => {
    let active = true
    const tick = async () => {
      await load()
      if (active) timer.current = setTimeout(tick, REFRESH_MS)
    }
    void tick()
    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [load])

  const overall: OverallState = state.phase === 'loaded' ? state.summary.overall : state.phase === 'offline' ? 'offline' : 'degraded'

  return (
    <PageLayout
      title="Platform status"
      subtitle="Live health of the InfraPortal microservices platform, straight from the API gateway."
    >
      {/* Banner */}
      <section
        aria-live="polite"
        className="forge-panel surface-card-strong flex flex-wrap items-center gap-x-4 gap-y-2 p-5"
      >
        <span
          className={`inline-block h-3 w-3 flex-shrink-0 rounded-full ${
            state.phase === 'loading' ? `bg-text-subtle ${reducedMotion ? '' : 'animate-pulse'}` : BANNER[overall].dot
          }`}
        />
        <span
          className={`text-base font-semibold ${
            state.phase === 'loading' ? 'text-text-muted' : BANNER[overall].text
          }`}
        >
          {state.phase === 'loading' ? 'Checking platform status…' : overallLabel(overall)}
        </span>

        {state.phase === 'loaded' && (
          <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-subtle">
            {state.summary.ok > 0 && (
              <span>
                <span className="font-medium text-success-text">{state.summary.ok}</span> operational
              </span>
            )}
            {state.summary.degraded > 0 && (
              <span>
                <span className="font-medium text-warning-text">{state.summary.degraded}</span> degraded
              </span>
            )}
            {state.summary.unreachable > 0 && (
              <span>
                <span className="font-medium text-danger-text">{state.summary.unreachable}</span> down
              </span>
            )}
            <span>{state.summary.total} services</span>
          </span>
        )}
      </section>

      {/* Body */}
      {state.phase === 'loading' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`forge-panel surface-card h-24 ${reducedMotion ? '' : 'animate-pulse'}`}
              aria-hidden
            />
          ))}
        </div>
      )}

      {state.phase === 'offline' && (
        <section className="forge-panel surface-card-strong flex flex-col items-start gap-3 p-6">
          <h2 className="text-sm font-semibold text-danger-text">The status feed is unreachable right now</h2>
          <p className="max-w-prose text-sm text-text-secondary">
            The board could not read the platform gateway. This usually means the gateway is briefly unavailable or a
            network hiccup interrupted the request; the platform services themselves may still be up. The board retries
            automatically every 30 seconds.
          </p>
          <RefreshButton onClick={load} refreshing={refreshing} reducedMotion={reducedMotion} />
        </section>
      )}

      {state.phase === 'loaded' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.upstreams.map((u) => (
            <ServiceTile key={u.name} upstream={u} />
          ))}
        </div>
      )}

      {/* Footer meta */}
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-subtle">
        {state.phase !== 'loading' && (
          <span>
            Last checked {state.fetchedAt.toLocaleTimeString()}
            {state.phase === 'loaded' && <> · gateway responded in {state.latencyMs} ms</>}
          </span>
        )}
        {state.phase === 'loaded' && (
          <RefreshButton onClick={load} refreshing={refreshing} reducedMotion={reducedMotion} />
        )}
        <span className="ml-auto">Auto-refreshes every 30s</span>
      </section>
    </PageLayout>
  )
}

function ServiceTile({ upstream }: { upstream: Upstream }) {
  return (
    <div className="forge-panel surface-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold capitalize text-text-primary">{upstream.name}</p>
          <p className="truncate text-xs text-text-subtle">{hostOf(upstream.url)}</p>
        </div>
        <span
          className={`mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${DOT[upstream.status]}`}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between border-t border-border-soft pt-2 text-xs">
        <span className={`font-medium ${TEXT[upstream.status]}`}>{statusLabel(upstream.status)}</span>
        <span className="text-text-subtle">{upstream.code != null ? `HTTP ${upstream.code}` : 'no response'}</span>
      </div>
    </div>
  )
}

function RefreshButton({
  onClick,
  refreshing,
  reducedMotion,
}: {
  onClick: () => void
  refreshing: boolean
  reducedMotion: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-surface-control px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-60"
    >
      <span
        className={`inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent ${
          refreshing && !reducedMotion ? 'animate-spin' : ''
        } ${refreshing ? '' : 'hidden'}`}
        aria-hidden
      />
      {refreshing ? 'Refreshing…' : 'Refresh now'}
    </button>
  )
}
