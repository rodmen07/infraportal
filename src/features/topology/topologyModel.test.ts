/**
 * The topology diagram's committed model (TOPOLOGY-1).
 *
 * Three families of guard here, in the repo's established styles:
 *
 * 1. INTEGRITY: the node/edge data is internally consistent, and the domain
 *    band equals src/api-specs/manifest.json exactly. The manifest is itself
 *    drift-guarded against the microservices repo (scripts/check-spec-drift),
 *    so this transitively pins the diagram to the real service workspace: a
 *    service added or removed upstream reddens here on the next spec sync
 *    instead of silently missing from the picture.
 *
 * 2. GEOMETRY: layout is data, so layout bugs are testable. Every box sits
 *    inside the viewBox, no two boxes overlap, and every edge path is sampled
 *    against every box it does not connect — the class of defect where a line
 *    silently crosses a service box cannot ship green.
 *
 * 3. WIRING (L-001): the "16 microservices" figure used to be hand-typed in
 *    THREE files with nothing keeping them in agreement. All three surfaces
 *    must now derive from SHIPPED_MICROSERVICE_COUNT, and none may carry a
 *    literal of its own again.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import manifest from '../../api-specs/manifest.json'
import {
  CLUSTER_BOX,
  CLUSTER_ID,
  DOMAIN_SERVICE_IDS,
  NODE_BOXES,
  SHIPPED_MICROSERVICES,
  SHIPPED_MICROSERVICE_COUNT,
  TOPOLOGY_EDGES,
  TOPOLOGY_NODES,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  chipBox,
  edgeGeometry,
  statusByUpstreamName,
  type Box,
} from './topologyModel'

const ROOT = process.cwd()
const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), 'utf-8')

const nodeIds = TOPOLOGY_NODES.map((n) => n.id)
const validEndpoints = new Set([...nodeIds, CLUSTER_ID])

describe('model integrity', () => {
  it('has unique node ids, none colliding with the cluster pseudo-id', () => {
    expect(new Set(nodeIds).size).toBe(nodeIds.length)
    expect(nodeIds).not.toContain(CLUSTER_ID)
  })

  it('every edge connects two distinct, known endpoints, with no duplicates', () => {
    expect(TOPOLOGY_EDGES.length, 'the edge list is empty; every check below would be vacuous').toBeGreaterThan(5)
    const seen = new Set<string>()
    for (const edge of TOPOLOGY_EDGES) {
      expect(validEndpoints, `unknown edge endpoint: ${edge.from}`).toContain(edge.from)
      expect(validEndpoints, `unknown edge endpoint: ${edge.to}`).toContain(edge.to)
      expect(edge.from, 'self-edges cannot be drawn').not.toBe(edge.to)
      const key = `${edge.from}->${edge.to}`
      expect(seen.has(key), `duplicate edge: ${key}`).toBe(false)
      seen.add(key)
    }
  })

  it('the domain band equals the api-specs manifest exactly, both directions', () => {
    const manifestIds = manifest.services.map((s) => s.id).sort()
    expect(manifestIds.length, 'the manifest parsed empty; the comparison would be vacuous').toBeGreaterThan(5)
    expect([...DOMAIN_SERVICE_IDS].sort()).toEqual(manifestIds)
  })

  it('upstream names are unique and never shadow a domain-service id', () => {
    const upstreamNames = TOPOLOGY_NODES.flatMap((n) => (n.upstreamName ? [n.upstreamName] : []))
    expect(upstreamNames.length, 'no node maps to a health upstream; the overlay would be dead').toBeGreaterThan(0)
    expect(new Set(upstreamNames).size).toBe(upstreamNames.length)
    // Domain chips claim their own ids as upstream names; a box node reusing
    // one would paint two dots from a single measurement.
    for (const name of upstreamNames) {
      expect(DOMAIN_SERVICE_IDS, `box-node upstream name shadows a domain id: ${name}`).not.toContain(name)
    }
  })
})

describe('the shipped-microservices count', () => {
  it('is the domain band plus the five backend singletons — the recorded composition of the marketing figure', () => {
    expect([...SHIPPED_MICROSERVICES].sort()).toEqual(
      [
        ...DOMAIN_SERVICE_IDS,
        'go-gateway',
        'task-api',
        'ai-orchestrator',
        'auth-service',
        'event-stream',
      ].sort(),
    )
    expect(SHIPPED_MICROSERVICE_COUNT).toBe(16)
  })

  it('counts only real topology entries, and deliberately not the frontend or externals', () => {
    for (const id of SHIPPED_MICROSERVICES) {
      expect(validEndpoints.has(id) || DOMAIN_SERVICE_IDS.includes(id), `not a topology entry: ${id}`).toBe(true)
    }
    expect(SHIPPED_MICROSERVICES).not.toContain('infraportal')
    expect(SHIPPED_MICROSERVICES).not.toContain('llm-apis')
    expect(SHIPPED_MICROSERVICES).not.toContain('cloud-sql')
    expect(SHIPPED_MICROSERVICES).not.toContain('pubsub')
  })
})

describe('the status overlay mapping', () => {
  it('indexes a real-shaped aggregate by name and preserves each status', () => {
    const byName = statusByUpstreamName([
      { name: 'accounts', url: 'https://accounts.example/health', status: 'ok' },
      { name: 'tasks', url: 'https://tasks.example/health', status: 'degraded' },
      { name: 'auth', url: 'https://auth.example/health', status: 'unreachable' },
    ])
    expect(byName.get('accounts')).toBe('ok')
    expect(byName.get('tasks')).toBe('degraded')
    expect(byName.get('auth')).toBe('unreachable')
    expect(byName.get('never-reported')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Geometry.
// ---------------------------------------------------------------------------

const inset = (b: Box, by: number): Box => ({ x: b.x + by, y: b.y + by, w: b.w - 2 * by, h: b.h - 2 * by })

const contains = (b: Box, x: number, y: number) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('layout geometry', () => {
  const allBoxes: Array<[string, Box]> = [
    ...Object.entries(NODE_BOXES),
    [CLUSTER_ID, CLUSTER_BOX],
  ]

  it('lays out a box for every node, and no strays', () => {
    expect(Object.keys(NODE_BOXES).sort()).toEqual([...nodeIds].sort())
  })

  it('keeps every box inside the viewBox', () => {
    for (const [id, b] of allBoxes) {
      expect(b.x, id).toBeGreaterThanOrEqual(0)
      expect(b.y, id).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w, id).toBeLessThanOrEqual(VIEWBOX_WIDTH)
      expect(b.y + b.h, id).toBeLessThanOrEqual(VIEWBOX_HEIGHT)
    }
  })

  it('never overlaps two boxes', () => {
    for (let i = 0; i < allBoxes.length; i += 1) {
      for (let j = i + 1; j < allBoxes.length; j += 1) {
        const [idA, a] = allBoxes[i]
        const [idB, b] = allBoxes[j]
        expect(overlaps(a, b), `${idA} overlaps ${idB}`).toBe(false)
      }
    }
  })

  it('keeps every domain chip inside the cluster band, below its title row, with no chip overlaps', () => {
    const chips = DOMAIN_SERVICE_IDS.map((id, i) => [id, chipBox(i)] as const)
    for (const [id, chip] of chips) {
      expect(chip.x, id).toBeGreaterThanOrEqual(CLUSTER_BOX.x)
      expect(chip.x + chip.w, id).toBeLessThanOrEqual(CLUSTER_BOX.x + CLUSTER_BOX.w)
      expect(chip.y, `${id} collides with the cluster title row`).toBeGreaterThanOrEqual(CLUSTER_BOX.y + 32)
      expect(chip.y + chip.h, id).toBeLessThanOrEqual(CLUSTER_BOX.y + CLUSTER_BOX.h)
    }
    for (let i = 0; i < chips.length; i += 1) {
      for (let j = i + 1; j < chips.length; j += 1) {
        expect(overlaps(chips[i][1], chips[j][1]), `${chips[i][0]} overlaps ${chips[j][0]}`).toBe(false)
      }
    }
  })

  it('routes every edge clear of every box it does not connect', () => {
    // The defect class this exists for: a hand-tuned bezier that looks fine in
    // the numbers and crosses a service box on screen. Sample the real curve
    // the component draws; endpoints' own boxes are exempt (paths anchor on
    // their edges), everything else must never be entered. The 2px inset
    // tolerates anchor points that sit exactly on a box border.
    let sampleCount = 0
    for (const edge of TOPOLOGY_EDGES) {
      const { samples } = edgeGeometry(edge)
      sampleCount += samples.length
      for (const [id, box] of allBoxes) {
        if (id === edge.from || id === edge.to) continue
        const shrunk = inset(box, 2)
        for (const p of samples) {
          expect(
            contains(shrunk, p.x, p.y),
            `edge ${edge.from}->${edge.to} crosses ${id} at (${Math.round(p.x)}, ${Math.round(p.y)})`,
          ).toBe(false)
        }
      }
      for (const p of samples) {
        expect(p.x, 'sample outside viewBox').toBeGreaterThanOrEqual(0)
        expect(p.x, 'sample outside viewBox').toBeLessThanOrEqual(VIEWBOX_WIDTH)
        expect(p.y, 'sample outside viewBox').toBeGreaterThanOrEqual(0)
        expect(p.y, 'sample outside viewBox').toBeLessThanOrEqual(VIEWBOX_HEIGHT)
      }
    }
    expect(sampleCount, 'the sampler produced nothing; the sweep above was vacuous').toBeGreaterThan(200)
  })

  it('keeps every edge label clear of every box', () => {
    for (const edge of TOPOLOGY_EDGES.filter((e) => e.label)) {
      const { labelAt } = edgeGeometry(edge)
      // Approximate glyph run: labels are one short word at 12px.
      const labelBox: Box = { x: labelAt.x, y: labelAt.y - 10, w: (edge.label as string).length * 7.5, h: 12 }
      for (const [id, box] of allBoxes) {
        expect(
          overlaps(labelBox, inset(box, 2)),
          `label "${edge.label}" of ${edge.from}->${edge.to} overlaps ${id}`,
        ).toBe(false)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Wiring (L-001): the surfaces that show this model actually read it.
// ---------------------------------------------------------------------------

describe('the count is derived everywhere it is shown', () => {
  const CONSUMERS = [
    'src/features/site/proofStats.ts',
    'src/pages/CaseStudiesPage.tsx',
    'src/features/consulting/PricingTrustStrip.tsx',
  ]

  it.each(CONSUMERS)('%s derives the figure from the model', (file) => {
    const source = read(file)
    expect(source).toContain('SHIPPED_MICROSERVICE_COUNT')
    expect(
      source.includes("value: '16'") || source.includes('value: "16"'),
      `${file} re-introduced a hand-typed service count; derive it from the topology model`,
    ).toBe(false)
  })
})

describe('the diagram is actually rendered and reads the gateway, not the env', () => {
  it('CaseStudiesPage renders PlatformTopology', () => {
    const source = read('src/pages/CaseStudiesPage.tsx')
    expect(source).toContain('<PlatformTopology')
  })

  it('the status hook reads UPSTREAMS_URL from the gateway module (L-003)', () => {
    const source = read('src/features/topology/useTopologyStatus.ts')
    expect(source).toContain("from '../status/gateway'")
    expect(source).toContain('UPSTREAMS_URL')
    expect(
      source.includes('VITE_GATEWAY_URL'),
      'the hook must not re-derive the gateway origin from the env',
    ).toBe(false)
  })

  it('the component colours exclusively through theme tokens, never raw hexes', () => {
    // The MedallionDemo histogram's inline-style hexes are the recorded
    // counter-example: scanners parse class strings, not style attributes, so
    // a hex here would silently render wrong in light mode forever.
    const source = read('src/features/topology/PlatformTopology.tsx')
    expect(source).toMatch(/var\(--/)
    expect(source, 'use var(--token) styles, not hex colours').not.toMatch(/#[0-9a-fA-F]{6}\b/)
    // Status dots must reuse the StatusPage token mapping, label alongside.
    for (const token of ['var(--success)', 'var(--warning)', 'var(--danger)']) {
      expect(source).toContain(token)
    }
    expect(source).toContain('statusLabel')
  })
})
