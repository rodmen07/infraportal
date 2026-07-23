// Pure model for the public Platform Status board (#/status).
//
// The board reads ONE endpoint: the go-gateway upstream health aggregate
// (`GET {gateway}/health/upstreams`), which fans out to every platform service
// and returns a single CORS-enabled JSON document. Keeping all parsing and
// summarising here (not in the React page) means the interesting logic is
// unit-testable without a DOM, matching this repo's node-environment vitest
// setup, and the page stays a thin render shell.
//
// The gateway shipped the browser-consumable aggregate in go-gateway PR #11
// (2026-07-23): it answers HTTP 200 even when an upstream is unhealthy (the
// verdict lives in the body), and sends Access-Control-Allow-Origin for this
// site's origin. This model mirrors that contract and is defensive about drift.

/** Per-upstream status as reported by the gateway aggregate. */
export type UpstreamStatus = 'ok' | 'degraded' | 'unreachable'

/** One upstream entry from the aggregate's `upstreams` array. */
export interface Upstream {
  name: string
  url: string
  status: UpstreamStatus
  /** HTTP status code from the upstream's /health, absent when unreachable. */
  code?: number
}

/** The shape of `GET {gateway}/health/upstreams`. */
export interface Aggregate {
  status: 'ok' | 'degraded'
  upstreams: Upstream[]
}

/**
 * Board-level verdict.
 * - `operational`: every upstream is ok.
 * - `degraded`: the gateway answered, but at least one upstream is down.
 * - `offline`: the board could not read the gateway at all (network, CORS, or a
 *   malformed body). This is a page-level state, never reported by the gateway.
 */
export type OverallState = 'operational' | 'degraded' | 'offline'

/** Counts plus the derived verdict for a successfully-read aggregate. */
export interface Summary {
  overall: Exclude<OverallState, 'offline'>
  total: number
  ok: number
  degraded: number
  unreachable: number
}

const UPSTREAM_STATUSES: readonly UpstreamStatus[] = ['ok', 'degraded', 'unreachable']

function isUpstreamStatus(value: unknown): value is UpstreamStatus {
  return typeof value === 'string' && (UPSTREAM_STATUSES as readonly string[]).includes(value)
}

/**
 * Parse an unknown JSON body into an {@link Aggregate}, or return `null` when it
 * does not match the contract. Defensive on purpose: a shape change or an error
 * page returned with a 200 must degrade to the offline path, never throw inside
 * render. Unknown upstream `status` values are coerced to `unreachable` (the
 * safe pessimistic reading) rather than dropped, so a new gateway status can
 * never silently vanish a service from the board.
 */
export function parseAggregate(body: unknown): Aggregate | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = body as Record<string, unknown>
  if (!Array.isArray(raw.upstreams)) return null

  const overall = raw.status === 'ok' ? 'ok' : 'degraded'

  const upstreams: Upstream[] = []
  for (const entry of raw.upstreams) {
    if (typeof entry !== 'object' || entry === null) return null
    const e = entry as Record<string, unknown>
    if (typeof e.name !== 'string' || typeof e.url !== 'string') return null
    const status = isUpstreamStatus(e.status) ? e.status : 'unreachable'
    const upstream: Upstream = { name: e.name, url: e.url, status }
    if (typeof e.code === 'number') upstream.code = e.code
    upstreams.push(upstream)
  }

  return { status: overall, upstreams }
}

/** Count upstreams by status and derive the board verdict. */
export function summarize(aggregate: Aggregate): Summary {
  let ok = 0
  let degraded = 0
  let unreachable = 0
  for (const u of aggregate.upstreams) {
    if (u.status === 'ok') ok += 1
    else if (u.status === 'degraded') degraded += 1
    else unreachable += 1
  }
  const total = aggregate.upstreams.length
  // Derive from the upstreams rather than trusting only the aggregate's own
  // `status`, so the tile counts and the banner can never disagree.
  const overall: Summary['overall'] = ok === total && total > 0 ? 'operational' : 'degraded'
  return { overall, total, ok, degraded, unreachable }
}

/** Upstreams sorted for stable, readable display: unhealthy first, then by name. */
export function sortUpstreams(upstreams: readonly Upstream[]): Upstream[] {
  const rank: Record<UpstreamStatus, number> = { unreachable: 0, degraded: 1, ok: 2 }
  return [...upstreams].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name))
}

/** The host of an upstream URL, for compact display. Falls back to the raw string. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** A human label for a board verdict. */
export function overallLabel(overall: OverallState): string {
  switch (overall) {
    case 'operational':
      return 'All systems operational'
    case 'degraded':
      return 'Partial outage'
    case 'offline':
      return 'Status unavailable'
  }
}

/** A short, title-cased label for one upstream status. */
export function statusLabel(status: UpstreamStatus): string {
  switch (status) {
    case 'ok':
      return 'Operational'
    case 'degraded':
      return 'Degraded'
    case 'unreachable':
      return 'Unreachable'
  }
}
