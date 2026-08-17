/**
 * The topology status hook's pure half (TOPOLOGY-1). Sibling of
 * useLiveServices.test.ts: same endpoint, same degrade-never-throw contract,
 * except this state keeps the per-upstream detail the diagram overlay needs.
 */
import { describe, expect, it } from 'vitest'
import { topologyStatusFrom } from './useTopologyStatus'

/** Mirrors the live gateway payload shape, as pinned in statusModel.test.ts. */
const REAL_SHAPED = {
  status: 'degraded',
  upstreams: [
    { name: 'accounts', url: 'https://accounts.example/health', status: 'ok', code: 200 },
    { name: 'auth', url: 'https://auth.example/health', status: 'ok', code: 200 },
    { name: 'events', url: 'https://events.example/health', status: 'degraded', code: 503 },
    { name: 'tasks', url: 'https://tasks.example/health', status: 'unreachable' },
  ],
}

describe('topologyStatusFrom', () => {
  it('keeps the per-upstream detail alongside the summary', () => {
    const state = topologyStatusFrom(REAL_SHAPED)
    expect(state.phase).toBe('loaded')
    if (state.phase !== 'loaded') return
    expect(state.upstreams.map((u) => u.name)).toEqual(['accounts', 'auth', 'events', 'tasks'])
    expect(state.upstreams[3].status).toBe('unreachable')
    expect(state.summary).toEqual({
      overall: 'degraded',
      total: 4,
      ok: 2,
      degraded: 1,
      unreachable: 1,
    })
  })

  it.each([
    ['null', null],
    ['a string body', 'service unavailable'],
    ['a shape with no upstreams array', { status: 'ok' }],
    ['an upstream missing its name', { status: 'ok', upstreams: [{ url: 'https://x', status: 'ok' }] }],
  ])('degrades to unavailable on %s, never throwing', (_label, body) => {
    expect(topologyStatusFrom(body)).toEqual({ phase: 'unavailable' })
  })

  it('coerces an unknown upstream status to unreachable rather than dropping the service', () => {
    const state = topologyStatusFrom({
      status: 'ok',
      upstreams: [{ name: 'accounts', url: 'https://x', status: 'on-fire' }],
    })
    expect(state.phase).toBe('loaded')
    if (state.phase !== 'loaded') return
    expect(state.upstreams[0].status).toBe('unreachable')
  })
})
