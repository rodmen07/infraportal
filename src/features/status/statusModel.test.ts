import { describe, it, expect } from 'vitest'
import {
  parseAggregate,
  summarize,
  sortUpstreams,
  hostOf,
  overallLabel,
  statusLabel,
  type Aggregate,
} from './statusModel'

// A trimmed but real-shaped payload from GET {gateway}/health/upstreams.
const LIVE_SHAPE = {
  status: 'degraded',
  upstreams: [
    { name: 'accounts', url: 'https://accounts-service-5gcrg4oiza-uc.a.run.app', status: 'ok', code: 200 },
    { name: 'auth', url: 'https://auth-service-5gcrg4oiza-uc.a.run.app', status: 'ok', code: 200 },
    { name: 'events', url: 'https://event-stream-service.fly.dev', status: 'ok', code: 200 },
    { name: 'tasks', url: 'https://backend-service-rodmen07-v2.fly.dev', status: 'unreachable' },
  ],
}

describe('parseAggregate', () => {
  it('parses a live-shaped payload', () => {
    const agg = parseAggregate(LIVE_SHAPE)
    expect(agg).not.toBeNull()
    expect(agg!.status).toBe('degraded')
    expect(agg!.upstreams).toHaveLength(4)
    expect(agg!.upstreams[0]).toEqual({
      name: 'accounts',
      url: 'https://accounts-service-5gcrg4oiza-uc.a.run.app',
      status: 'ok',
      code: 200,
    })
  })

  it('omits code when the upstream reports none (unreachable)', () => {
    const agg = parseAggregate(LIVE_SHAPE)!
    const tasks = agg.upstreams.find((u) => u.name === 'tasks')!
    expect(tasks.status).toBe('unreachable')
    expect(tasks.code).toBeUndefined()
  })

  it('treats an all-ok aggregate as status ok', () => {
    const agg = parseAggregate({
      status: 'ok',
      upstreams: [{ name: 'a', url: 'https://a', status: 'ok', code: 200 }],
    })!
    expect(agg.status).toBe('ok')
  })

  // These are the offline-path guards. A 200 that is not the aggregate (an error
  // page, an HTML body, a shape change) must return null so the page shows the
  // offline banner instead of throwing inside render.
  it.each([
    ['null', null],
    ['a string', 'not json'],
    ['a number', 42],
    ['an object with no upstreams array', { status: 'ok' }],
    ['upstreams not an array', { status: 'ok', upstreams: 'nope' }],
    ['an upstream missing name', { status: 'ok', upstreams: [{ url: 'https://a', status: 'ok' }] }],
    ['an upstream missing url', { status: 'ok', upstreams: [{ name: 'a', status: 'ok' }] }],
    ['an upstream that is not an object', { status: 'ok', upstreams: ['x'] }],
  ])('returns null for %s', (_label, body) => {
    expect(parseAggregate(body)).toBeNull()
  })

  it('coerces an unknown upstream status to unreachable rather than dropping it', () => {
    // A future gateway status must never make a service vanish from the board.
    const agg = parseAggregate({
      status: 'degraded',
      upstreams: [{ name: 'mystery', url: 'https://m', status: 'quantum' }],
    })!
    expect(agg.upstreams).toHaveLength(1)
    expect(agg.upstreams[0].status).toBe('unreachable')
  })
})

describe('summarize', () => {
  it('reports operational only when every upstream is ok', () => {
    const agg: Aggregate = {
      status: 'ok',
      upstreams: [
        { name: 'a', url: 'https://a', status: 'ok', code: 200 },
        { name: 'b', url: 'https://b', status: 'ok', code: 200 },
      ],
    }
    expect(summarize(agg)).toEqual({ overall: 'operational', total: 2, ok: 2, degraded: 0, unreachable: 0 })
  })

  it('reports degraded and exact counts when something is down', () => {
    const summary = summarize(parseAggregate(LIVE_SHAPE)!)
    expect(summary).toEqual({ overall: 'degraded', total: 4, ok: 3, degraded: 0, unreachable: 1 })
  })

  it('counts a mix of degraded and unreachable', () => {
    const agg: Aggregate = {
      status: 'degraded',
      upstreams: [
        { name: 'a', url: 'https://a', status: 'ok', code: 200 },
        { name: 'b', url: 'https://b', status: 'degraded', code: 503 },
        { name: 'c', url: 'https://c', status: 'unreachable' },
      ],
    }
    expect(summarize(agg)).toEqual({ overall: 'degraded', total: 3, ok: 1, degraded: 1, unreachable: 1 })
  })

  it('an empty upstream list is not operational (vacuous truth would mislead)', () => {
    expect(summarize({ status: 'ok', upstreams: [] }).overall).toBe('degraded')
  })
})

describe('sortUpstreams', () => {
  it('orders unhealthy first, then alphabetically, without mutating the input', () => {
    const input = parseAggregate(LIVE_SHAPE)!.upstreams
    const sorted = sortUpstreams(input)
    expect(sorted.map((u) => u.name)).toEqual(['tasks', 'accounts', 'auth', 'events'])
    // input untouched
    expect(input.map((u) => u.name)).toEqual(['accounts', 'auth', 'events', 'tasks'])
  })
})

describe('display helpers', () => {
  it('hostOf extracts the host', () => {
    expect(hostOf('https://event-stream-service.fly.dev/health')).toBe('event-stream-service.fly.dev')
  })

  it('hostOf falls back to the raw string on a non-URL', () => {
    expect(hostOf('not a url')).toBe('not a url')
  })

  it('overallLabel covers every state', () => {
    expect(overallLabel('operational')).toBe('All systems operational')
    expect(overallLabel('degraded')).toBe('Partial outage')
    expect(overallLabel('offline')).toBe('Status unavailable')
  })

  it('statusLabel covers every upstream status', () => {
    expect(statusLabel('ok')).toBe('Operational')
    expect(statusLabel('degraded')).toBe('Degraded')
    expect(statusLabel('unreachable')).toBe('Unreachable')
  })
})
