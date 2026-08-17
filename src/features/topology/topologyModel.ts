import type { Upstream, UpstreamStatus } from '../status/statusModel'

// The platform topology, as committed data (TOPOLOGY-1).
//
// WHY A COMMITTED MODEL AND NOT services.yaml. The umbrella repo's
// services.yaml is crowned authoritative by README.md and ARCHITECTURE.md, but
// it cannot be this diagram's source: it lives outside this repo (absent from
// the standalone CI checkout, the same reason api-specs are synced snapshots),
// its svccat `depends_on` edges are untyped and DAG-enforced (the real
// CRM<->search write-through/fan-out pair is a cycle, which `svccat check`
// rejects), and data-tier nodes (Cloud SQL, Pub/Sub) have no repo directory to
// declare. So the STRUCTURE is committed here — nodes, typed edges, layout —
// and cross-checked against src/api-specs/manifest.json (itself drift-guarded
// against the microservices repo) by topologyModel.test.ts.
//
// WHAT IS DELIBERATELY NOT HERE: deployment status. PROOF-COST-1 established
// that a static bundle must never assert a runtime fact; liveness is measured
// by useTopologyStatus from the gateway health aggregate and overlaid at
// render time, or omitted when the measurement is unavailable.

/** Which horizontal band of the diagram a node renders in. */
export type TopologyTier = 'edge' | 'gateway' | 'application' | 'data'

/** How two nodes talk. Drawn as distinct line styles, named in the legend. */
export type EdgeKind = 'http' | 'sse' | 'async' | 'queue' | 'sql' | 'external'

export interface TopologyNode {
  readonly id: string
  readonly label: string
  /** Second line inside the box: language / framework / platform. */
  readonly sublabel: string
  readonly tier: TopologyTier
  /** Longer text surfaced as the node's SVG `<title>` tooltip. */
  readonly detail: string
  /**
   * The `name` this node reports under in the gateway `/health/upstreams`
   * aggregate, when it is an upstream there. Absent for nodes the gateway
   * does not health-check (the UI itself, external APIs, managed data stores).
   */
  readonly upstreamName?: string
  /** True for systems outside the platform boundary (drawn dashed). */
  readonly external?: boolean
}

export interface TopologyEdge {
  /** A node id, or CLUSTER_ID for the domain-services band. */
  readonly from: string
  readonly to: string
  readonly kind: EdgeKind
  /** Short annotation drawn at the midpoint (keep to one or two words). */
  readonly label?: string
}

/** Pseudo-node id for the 11-service Rust domain band. */
export const CLUSTER_ID = 'domain-cluster'

/**
 * The 11 Rust domain services, by api-spec id. topologyModel.test.ts asserts
 * this list equals src/api-specs/manifest.json exactly, so a service added to
 * (or removed from) the microservices workspace reddens the diagram's model
 * on the next spec sync instead of silently drifting.
 *
 * Ids double as upstream names in the gateway health aggregate for the nine
 * services the gateway proxies. audit and spend are internal-only — the
 * gateway has no route or upstream for them (go-gateway cmd/gateway/main.go
 * route table) — so their chips can never carry a measured health dot, which
 * is the honest rendering: no measurement, no dot.
 */
export const DOMAIN_SERVICE_IDS: readonly string[] = [
  'accounts',
  'activities',
  'audit',
  'automation',
  'contacts',
  'integrations',
  'opportunities',
  'projects',
  'reporting',
  'search',
  'spend',
]

export const TOPOLOGY_NODES: readonly TopologyNode[] = [
  {
    id: 'infraportal',
    label: 'infraportal',
    sublabel: 'React 19 · GitHub Pages',
    tier: 'edge',
    detail: 'This site. React 19 + Vite SPA on GitHub Pages; the only always-on component, served as static files at zero standing cost.',
  },
  {
    id: 'event-stream',
    label: 'event-stream-service',
    sublabel: 'Go · SSE hub',
    tier: 'gateway',
    detail: 'Go SSE hub with ring-buffer replay. Pushes platform events to the browser notification bell over Server-Sent Events.',
  },
  {
    id: 'go-gateway',
    label: 'go-gateway',
    sublabel: 'Go · Cloud Run',
    tier: 'gateway',
    detail: 'API gateway: reverse proxy for the platform’s public routes, RS256 JWT verification (public key from deploy config; auth-service publishes the matching JWKS), per-IP rate limiting with an optional Redis-backed mode (fail-open), and the /health/upstreams aggregate this diagram reads.',
  },
  {
    id: 'auth-service',
    label: 'auth-service',
    sublabel: 'Python · JWT + OAuth',
    tier: 'gateway',
    detail: 'FastAPI auth service: JWT issuing, GitHub + Google OAuth, and a JWKS endpoint publishing the RS256 public key. Stores its users in SQLite.',
    upstreamName: 'auth',
  },
  {
    id: 'llm-apis',
    label: 'LLM APIs',
    sublabel: 'Claude + Gemini',
    tier: 'application',
    detail: 'External model providers called by the AI orchestrator.',
    external: true,
  },
  {
    id: 'ai-orchestrator',
    label: 'ai-orchestrator',
    sublabel: 'Python · FastAPI',
    tier: 'application',
    detail: 'LLM-backed planner orchestrating Claude and Gemini behind one API.',
  },
  {
    id: 'task-api',
    label: 'task-api',
    sublabel: 'Rust · Axum',
    tier: 'application',
    detail: 'Task service and AI-planner proxy (repo: backend-service). Shares the platform Cloud SQL instance.',
    upstreamName: 'tasks',
  },
  {
    id: 'observaboard',
    label: 'observaboard',
    sublabel: 'Django 5 · Cloud Tasks',
    tier: 'application',
    detail: 'Webhook ingestion with PostgreSQL full-text search. Receives async CRM mutation events from the gateway — it is the aggregate’s “events” upstream — and forwards them to the event stream. Shares the platform Cloud SQL instance.',
    upstreamName: 'events',
  },
  {
    id: 'cloud-sql',
    label: 'Cloud SQL',
    sublabel: 'PostgreSQL 16 + read replica',
    tier: 'data',
    detail: 'One managed Postgres instance, one database and role per service; reporting and search read from a cross-region replica. Also used by task-api and observaboard.',
  },
  {
    id: 'pubsub',
    label: 'Pub/Sub',
    sublabel: 'CRM events → BigQuery',
    tier: 'data',
    detail: 'Gateway publishes CRM mutations to Pub/Sub with a BigQuery sink for analytics.',
  },
]

export const TOPOLOGY_EDGES: readonly TopologyEdge[] = [
  { from: 'infraportal', to: 'go-gateway', kind: 'http', label: 'HTTPS' },
  { from: 'event-stream', to: 'infraportal', kind: 'sse', label: 'SSE' },
  { from: 'go-gateway', to: 'auth-service', kind: 'http', label: 'auth' },
  { from: 'go-gateway', to: 'task-api', kind: 'http' },
  // Deliberately uncounted: the gateway proxies nine of the eleven domain
  // services (audit and spend are internal-only), so a count here would be
  // wrong in one direction or the other. The band's own title carries the
  // derived size of the whole tier.
  { from: 'go-gateway', to: CLUSTER_ID, kind: 'http', label: 'proxy' },
  { from: 'go-gateway', to: 'observaboard', kind: 'async', label: 'ingest' },
  { from: 'go-gateway', to: 'pubsub', kind: 'queue', label: 'queue' },
  { from: 'task-api', to: 'ai-orchestrator', kind: 'http' },
  { from: 'ai-orchestrator', to: 'llm-apis', kind: 'external' },
  { from: 'observaboard', to: 'event-stream', kind: 'async' },
  { from: CLUSTER_ID, to: 'cloud-sql', kind: 'sql', label: 'SQL' },
]

/**
 * The platform services this portfolio counts as "microservices shipped":
 * the 11 Rust domain services plus the five backend singletons. This is the
 * single source of the figure that used to be hand-typed in three places
 * (proofStats.ts, CaseStudiesPage.tsx, PricingTrustStrip.tsx) with no guard
 * keeping them in agreement.
 *
 * The frontend is excluded (it is a site, not a service), and so are the
 * external APIs and managed data stores. observaboard is excluded so the
 * derived figure stays at the historical 16 — that figure shipped bare, with
 * no recorded composition, so THIS list is the documented composition from
 * now on. Counting observaboard is a copy decision, and making it means
 * flipping one entry here, not editing three pages.
 */
export const SHIPPED_MICROSERVICES: readonly string[] = [
  ...DOMAIN_SERVICE_IDS,
  'go-gateway',
  'task-api',
  'ai-orchestrator',
  'auth-service',
  'event-stream',
]

export const SHIPPED_MICROSERVICE_COUNT = SHIPPED_MICROSERVICES.length

/**
 * Index a loaded aggregate by upstream name so the diagram can overlay a
 * measured status dot on exactly the nodes the gateway reports on. Upstreams
 * with no matching node are ignored (they simply have no box to decorate);
 * nodes with no matching upstream get no dot — absence of measurement is
 * rendered as nothing, never as a verdict.
 */
export function statusByUpstreamName(
  upstreams: readonly Upstream[],
): ReadonlyMap<string, UpstreamStatus> {
  const byName = new Map<string, UpstreamStatus>()
  for (const upstream of upstreams) byName.set(upstream.name, upstream.status)
  return byName
}

// --------------------------------------------------------------------------
// Layout. Hand-tuned coordinates in a fixed viewBox, exported as data so the
// geometry is testable: topologyModel.test.ts samples every edge path and
// asserts it never crosses a box it does not connect. The component scales
// the whole drawing with width: 100% inside a horizontal-scroll container.
// --------------------------------------------------------------------------

export const VIEWBOX_WIDTH = 920
export const VIEWBOX_HEIGHT = 656

export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Positioned boxes for every node, keyed by node id. */
export const NODE_BOXES: Readonly<Record<string, Box>> = {
  infraportal: { x: 340, y: 24, w: 240, h: 56 },
  'auth-service': { x: 60, y: 140, w: 200, h: 56 },
  'go-gateway': { x: 340, y: 140, w: 240, h: 56 },
  'event-stream': { x: 640, y: 140, w: 200, h: 56 },
  'llm-apis': { x: 60, y: 256, w: 150, h: 56 },
  'ai-orchestrator': { x: 240, y: 256, w: 200, h: 56 },
  'task-api': { x: 470, y: 256, w: 170, h: 56 },
  observaboard: { x: 670, y: 256, w: 190, h: 56 },
  'cloud-sql': { x: 480, y: 580, w: 300, h: 52 },
  pubsub: { x: 120, y: 580, w: 200, h: 52 },
}

/** The domain-services band the 11 chips render inside. */
export const CLUSTER_BOX: Box = { x: 100, y: 372, w: 720, h: 164 }

const CHIP_COLUMNS = 4
export const CHIP_WIDTH = 166
export const CHIP_HEIGHT = 28
const CHIP_GAP = 8
const CHIP_ORIGIN_X = CLUSTER_BOX.x + 16
const CHIP_ORIGIN_Y = CLUSTER_BOX.y + 40

/** Grid position for the i-th domain-service chip inside the cluster band. */
export function chipBox(index: number): Box {
  const col = index % CHIP_COLUMNS
  const row = Math.floor(index / CHIP_COLUMNS)
  return {
    x: CHIP_ORIGIN_X + col * (CHIP_WIDTH + CHIP_GAP),
    y: CHIP_ORIGIN_Y + row * (CHIP_HEIGHT + CHIP_GAP),
    w: CHIP_WIDTH,
    h: CHIP_HEIGHT,
  }
}

export function boxFor(id: string): Box {
  if (id === CLUSTER_ID) return CLUSTER_BOX
  const box = NODE_BOXES[id]
  if (!box) throw new Error(`no layout box for topology node: ${id}`)
  return box
}

const centerX = (b: Box) => b.x + b.w / 2
const centerY = (b: Box) => b.y + b.h / 2

interface Point {
  readonly x: number
  readonly y: number
}

/** One cubic-bezier segment; a path is one or more of these joined. */
interface Cubic {
  readonly p0: Point
  readonly p1: Point
  readonly p2: Point
  readonly p3: Point
}

export interface EdgeGeometry {
  /** SVG `d` attribute for the edge line. */
  readonly d: string
  /** Where the edge's short label sits, when it has one. */
  readonly labelAt: Point
  /** Sampled points along the path, for the no-crossing layout test. */
  readonly samples: readonly Point[]
}

const cubicAt = (c: Cubic, t: number): Point => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const cc = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * c.p0.x + b * c.p1.x + cc * c.p2.x + d * c.p3.x,
    y: a * c.p0.y + b * c.p1.y + cc * c.p2.y + d * c.p3.y,
  }
}

const SAMPLES_PER_SEGMENT = 24

function geometryFrom(segments: readonly Cubic[], labelAt?: Point): EdgeGeometry {
  const start = segments[0].p0
  let d = `M ${start.x} ${start.y}`
  const samples: Point[] = []
  for (const seg of segments) {
    d += ` C ${seg.p1.x} ${seg.p1.y}, ${seg.p2.x} ${seg.p2.y}, ${seg.p3.x} ${seg.p3.y}`
    for (let i = 0; i <= SAMPLES_PER_SEGMENT; i += 1) {
      samples.push(cubicAt(seg, i / SAMPLES_PER_SEGMENT))
    }
  }
  const mid = samples[Math.floor(samples.length / 2)]
  return { d, labelAt: labelAt ?? { x: mid.x + 8, y: mid.y - 6 }, samples }
}

/** A straight-ish vertical connector, bowing gently between the two centers. */
function verticalSegment(fromBox: Box, toBox: Box, fromX?: number, toX?: number): Cubic {
  const downward = toBox.y >= fromBox.y + fromBox.h
  const x0 = fromX ?? centerX(fromBox)
  const x1 = toX ?? centerX(toBox)
  const y0 = downward ? fromBox.y + fromBox.h : fromBox.y
  const y1 = downward ? toBox.y : toBox.y + toBox.h
  const midY = (y0 + y1) / 2
  return {
    p0: { x: x0, y: y0 },
    p1: { x: x0, y: midY },
    p2: { x: x1, y: midY },
    p3: { x: x1, y: y1 },
  }
}

/** A horizontal connector between two boxes in the same band. */
function sideSegment(fromBox: Box, toBox: Box): Cubic {
  const leftToRight = centerX(fromBox) < centerX(toBox)
  const y0 = centerY(fromBox)
  const y1 = centerY(toBox)
  const x0 = leftToRight ? fromBox.x + fromBox.w : fromBox.x
  const x1 = leftToRight ? toBox.x : toBox.x + toBox.w
  const midX = (x0 + x1) / 2
  return {
    p0: { x: x0, y: y0 },
    p1: { x: midX, y: y0 },
    p2: { x: midX, y: y1 },
    p3: { x: x1, y: y1 },
  }
}

/**
 * Path geometry for one edge. Most connectors are generic vertical or side
 * segments; the two long-haul edges (gateway→Pub/Sub around the left margin,
 * observaboard→event-stream over the application band) carry hand-tuned
 * control points, and the layout test keeps all of them honest.
 */
export function edgeGeometry(edge: TopologyEdge): EdgeGeometry {
  const from = boxFor(edge.from)
  const to = boxFor(edge.to)
  const key = `${edge.from}->${edge.to}`

  switch (key) {
    case 'go-gateway->pubsub': {
      // Around the left margin: below the auth-service box, outside the
      // domain band, into the top-left of Pub/Sub.
      const start: Point = { x: from.x + 10, y: from.y + from.h }
      const kneeTop: Point = { x: 35, y: 340 }
      const kneeBottom: Point = { x: 35, y: 520 }
      const end: Point = { x: to.x + 20, y: to.y }
      return geometryFrom(
        [
          { p0: start, p1: { x: 100, y: 205 }, p2: { x: 35, y: 225 }, p3: kneeTop },
          { p0: kneeTop, p1: { x: 35, y: 400 }, p2: { x: 35, y: 460 }, p3: kneeBottom },
          { p0: kneeBottom, p1: { x: 35, y: 560 }, p2: { x: 90, y: 580 }, p3: end },
        ],
        { x: 44, y: 434 },
      )
    }
    case 'event-stream->infraportal': {
      const start: Point = { x: centerX(from), y: from.y }
      const end: Point = { x: to.x + to.w - 20, y: to.y + to.h }
      return geometryFrom([
        { p0: start, p1: { x: centerX(from), y: 104 }, p2: { x: end.x, y: 112 }, p3: end },
      ])
    }
    case 'go-gateway->domain-cluster':
      // Down the left flank, between the pub/sub arc and the ai-orchestrator
      // box; the label sits left of the line, clear of every box. The layout
      // test samples this curve against the ai and llm boxes.
      return geometryFrom(
        [
          {
            p0: { x: 360, y: from.y + from.h },
            p1: { x: 200, y: 240 },
            p2: { x: 210, y: 310 },
            p3: { x: 225, y: to.y },
          },
        ],
        { x: 168, y: 352 },
      )
    case 'go-gateway->observaboard':
      // Ends left of the observaboard->event-stream departure point so the
      // two async edges never share an anchor and cannot read as one line.
      return geometryFrom([verticalSegment(from, to, from.x + from.w - 20, to.x + 50)])
    case 'go-gateway->task-api':
      return geometryFrom([verticalSegment(from, to, centerX(from) + 40)])
    default: {
      const sameBand = Math.abs(centerY(from) - centerY(to)) < Math.min(from.h, to.h)
      if (sameBand) {
        const seg = sideSegment(from, to)
        // Label above the line, pulled toward the source so it cannot run
        // into the destination box.
        return geometryFrom([seg], { x: seg.p1.x - 17, y: seg.p0.y - 8 })
      }
      return geometryFrom([verticalSegment(from, to)])
    }
  }
}
