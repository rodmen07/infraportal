import { useState } from 'react'
import {
  CHIP_HEIGHT,
  CHIP_WIDTH,
  CLUSTER_BOX,
  CLUSTER_ID,
  DOMAIN_SERVICE_IDS,
  NODE_BOXES,
  TOPOLOGY_EDGES,
  TOPOLOGY_NODES,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  chipBox,
  edgeGeometry,
  statusByUpstreamName,
} from './topologyModel'
import type { EdgeKind } from './topologyModel'
import { statusLabel, type UpstreamStatus } from '../status/statusModel'
import { useTopologyStatus } from './useTopologyStatus'
import { usePrefersReducedMotion } from '../layout/usePrefersReducedMotion'

// The platform architecture, drawn from the committed topology model with a
// measured health overlay (TOPOLOGY-1).
//
// Rendering rules this file follows on purpose:
// - Every colour is a CSS custom property from src/styles/tokens.css, applied
//   via inline style, so the drawing resolves correctly in both themes with
//   zero [data-theme="light"] overrides (the MedallionDemo histogram's raw
//   hexes are the counter-example this avoids).
// - Health dots reuse the exact StatusPage token mapping (ok → success,
//   degraded → warning, unreachable → danger) and always sit beside a text
//   label — colour never carries the meaning alone.
// - No number or verdict is stated unless the aggregate was actually read
//   (the PROOF-COST-1 rule); with no measurement the diagram simply shows
//   structure and says the overlay is unavailable.
// - The only animation is a 200ms opacity transition on hover, dropped when
//   the visitor prefers reduced motion.

const EDGE_DASH: Record<EdgeKind, string | undefined> = {
  http: undefined,
  sse: '8 5',
  async: '4 4',
  queue: '1.5 5',
  sql: '13 4',
  external: '10 4 2 4',
}

const EDGE_KIND_LABEL: Record<EdgeKind, string> = {
  http: 'HTTP',
  sse: 'SSE push',
  async: 'async event',
  queue: 'queue',
  sql: 'SQL',
  external: 'external API',
}

/** Same token roles the status board's dots use (StatusPage DOT map). */
const STATUS_DOT_VAR: Record<UpstreamStatus, string> = {
  ok: 'var(--success)',
  degraded: 'var(--warning)',
  unreachable: 'var(--danger)',
}

const LEGEND_KINDS: readonly EdgeKind[] = ['http', 'sse', 'async', 'queue', 'sql', 'external']

const NO_STATUS: ReadonlyMap<string, UpstreamStatus> = new Map()

export function PlatformTopology() {
  const status = useTopologyStatus()
  const reducedMotion = usePrefersReducedMotion()
  const [hovered, setHovered] = useState<string | null>(null)

  const statusFor = status.phase === 'loaded' ? statusByUpstreamName(status.upstreams) : NO_STATUS

  const touches = (edgeFrom: string, edgeTo: string) =>
    hovered !== null && (edgeFrom === hovered || edgeTo === hovered)
  const edgeTransition = reducedMotion ? undefined : 'transition-opacity duration-200'

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="w-full min-w-[920px]"
          role="img"
          aria-labelledby="ptopo-title ptopo-desc"
        >
          <title id="ptopo-title">InfraPortal platform architecture</title>
          <desc id="ptopo-desc">
            {`Request flow from the React frontend through the Go API gateway to the Rust, Python,
            and Go services, the ${DOMAIN_SERVICE_IDS.length}-service Rust domain band, and the data tier. Line style
            shows how each pair communicates; when live health is available, a dot on a service
            shows its measured status.`}
          </desc>
          <defs>
            <marker id="ptopo-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" style={{ fill: 'var(--diagram-ink)' }} />
            </marker>
            <marker id="ptopo-arrow-accent" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" style={{ fill: 'var(--accent)' }} />
            </marker>
          </defs>

          {/* Edges first, so boxes paint over the line ends. */}
          {TOPOLOGY_EDGES.map((edge) => {
            const geometry = edgeGeometry(edge)
            const active = touches(edge.from, edge.to)
            const dimmed = hovered !== null && !active
            return (
              <g
                key={`${edge.from}->${edge.to}`}
                className={edgeTransition}
                style={{ opacity: dimmed ? 0.2 : 1 }}
              >
                <path
                  d={geometry.d}
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray={EDGE_DASH[edge.kind]}
                  strokeLinecap={edge.kind === 'queue' ? 'round' : undefined}
                  markerEnd={active ? 'url(#ptopo-arrow-accent)' : 'url(#ptopo-arrow)'}
                  style={{ stroke: active ? 'var(--accent)' : 'var(--diagram-ink)' }}
                />
                {edge.label && (
                  <text
                    x={geometry.labelAt.x}
                    y={geometry.labelAt.y}
                    fontSize={12}
                    style={{ fill: active ? 'var(--accent-text)' : 'var(--text-muted)' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Domain-services band. */}
          <g
            onMouseEnter={() => setHovered(CLUSTER_ID)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>
              {`${DOMAIN_SERVICE_IDS.length} Rust/Axum domain services on Cloud Run, one PostgreSQL database and role
              each. contacts and activities validate foreign keys against accounts over sync
              HTTP (fail-open); CRM writes index through to search, and search fans queries
              back out across the domain. spend polls the GCP, Fly.io, GitHub, and AWS billing
              APIs. audit and spend are internal-only — the gateway does not proxy them, so
              they never carry a health dot.`}
            </title>
            <rect
              x={CLUSTER_BOX.x}
              y={CLUSTER_BOX.y}
              width={CLUSTER_BOX.w}
              height={CLUSTER_BOX.h}
              rx={12}
              style={{
                fill: 'var(--neutral-bg)',
                stroke: hovered === CLUSTER_ID ? 'var(--accent-line)' : 'var(--border-soft)',
              }}
            />
            <text
              x={CLUSTER_BOX.x + 16}
              y={CLUSTER_BOX.y + 26}
              fontSize={13}
              fontWeight={600}
              style={{ fill: 'var(--text-primary)' }}
            >
              Rust domain services · Axum · Cloud Run
            </text>
            <text
              x={CLUSTER_BOX.x + CLUSTER_BOX.w - 16}
              y={CLUSTER_BOX.y + 26}
              fontSize={12}
              textAnchor="end"
              style={{ fill: 'var(--text-muted)' }}
            >
              {DOMAIN_SERVICE_IDS.length} services
            </text>
            {DOMAIN_SERVICE_IDS.map((id, index) => {
              const chip = chipBox(index)
              const upstreamStatus = statusFor.get(id)
              const textX = upstreamStatus ? chip.x + 24 : chip.x + 12
              return (
                <g key={id}>
                  <title>
                    {`${id}-service${upstreamStatus ? ` — ${statusLabel(upstreamStatus)} (measured now)` : ''}`}
                  </title>
                  <rect
                    x={chip.x}
                    y={chip.y}
                    width={CHIP_WIDTH}
                    height={CHIP_HEIGHT}
                    rx={CHIP_HEIGHT / 2}
                    style={{ fill: 'var(--chip-bg)', stroke: 'var(--chip-border)' }}
                  />
                  {upstreamStatus && (
                    <circle
                      cx={chip.x + 14}
                      cy={chip.y + CHIP_HEIGHT / 2}
                      r={4.5}
                      style={{ fill: STATUS_DOT_VAR[upstreamStatus] }}
                    />
                  )}
                  <text
                    x={textX}
                    y={chip.y + CHIP_HEIGHT / 2 + 4}
                    fontSize={12}
                    style={{ fill: 'var(--text-secondary)' }}
                  >
                    {id}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Service boxes. */}
          {TOPOLOGY_NODES.map((node) => {
            const box = NODE_BOXES[node.id]
            const upstreamStatus = node.upstreamName ? statusFor.get(node.upstreamName) : undefined
            const isHovered = hovered === node.id
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>
                  {`${node.detail}${upstreamStatus ? ` Status: ${statusLabel(upstreamStatus)} (measured now).` : ''}`}
                </title>
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  rx={10}
                  strokeDasharray={node.external ? '5 4' : undefined}
                  style={{
                    fill: node.external ? 'transparent' : 'var(--control-bg)',
                    stroke: isHovered ? 'var(--accent-line)' : 'var(--border-strong)',
                  }}
                />
                <text
                  x={box.x + 14}
                  y={box.y + 24}
                  fontSize={13}
                  fontWeight={600}
                  style={{ fill: 'var(--text-primary)' }}
                >
                  {node.label}
                </text>
                <text
                  x={box.x + 14}
                  y={box.y + 42}
                  fontSize={12}
                  style={{ fill: 'var(--text-muted)' }}
                >
                  {node.sublabel}
                </text>
                {upstreamStatus && (
                  <circle
                    cx={box.x + box.w - 14}
                    cy={box.y + 14}
                    r={4.5}
                    style={{ fill: STATUS_DOT_VAR[upstreamStatus] }}
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-scale-xs text-text-muted">
        {LEGEND_KINDS.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <svg width="26" height="8" aria-hidden="true">
              <path
                d="M 1 4 H 25"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray={EDGE_DASH[kind]}
                strokeLinecap={kind === 'queue' ? 'round' : undefined}
                style={{ stroke: 'var(--diagram-ink)' }}
              />
            </svg>
            {EDGE_KIND_LABEL[kind]}
          </span>
        ))}
        {status.phase === 'loaded' &&
          (['ok', 'degraded', 'unreachable'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <svg width="10" height="10" aria-hidden="true">
                <circle cx="5" cy="5" r="4.5" style={{ fill: STATUS_DOT_VAR[s] }} />
              </svg>
              {statusLabel(s)}
            </span>
          ))}
      </div>

      <p className="mt-2 text-scale-xs text-text-muted">
        {status.phase === 'loaded' && (
          <>
            Live health overlay: {status.summary.ok}/{status.summary.total} upstreams healthy,
            measured from the gateway aggregate just now.{' '}
          </>
        )}
        {status.phase === 'loading' && <>Checking live service health… </>}
        {status.phase === 'unavailable' && (
          <>
            The live health overlay could not be read just now, so the diagram shows the
            committed platform structure without measured status.{' '}
          </>
        )}
        Full per-service detail on the{' '}
        <a
          href="#/status"
          className="rounded text-accent-text underline underline-offset-4 transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          platform status board
        </a>
        . task-api and observaboard share the Cloud SQL instance; the gateway rate-limits
        per-IP, with an optional Memorystore Redis mode that fails open.
      </p>
    </div>
  )
}
