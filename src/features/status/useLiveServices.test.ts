/**
 * The pure half of the home-page live-services read (v1.20.1).
 *
 * The hook itself is a thin fetch shell; everything that can be wrong about
 * INTERPRETING a response lives in `liveServicesFrom`, so it is tested here
 * without a DOM or a network. The property that matters: any body that is not a
 * well-formed aggregate must degrade to `unavailable`, because the alternative
 * (guessing) is exactly the defect this feature exists to remove.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { liveServicesFrom } from './useLiveServices'
import { GATEWAY_URL, UPSTREAMS_URL } from './gateway'

const aggregate = {
  status: 'degraded',
  upstreams: [
    { name: 'accounts', url: 'https://accounts-service.example', status: 'ok', code: 200 },
    { name: 'search', url: 'https://search-service.example', status: 'ok', code: 200 },
    { name: 'tasks', url: 'https://backend-service.example', status: 'unreachable' },
  ],
}

describe('liveServicesFrom', () => {
  it('summarises a well-formed aggregate', () => {
    const state = liveServicesFrom(aggregate)
    expect(state.phase).toBe('loaded')
    if (state.phase !== 'loaded') return
    expect(state.summary).toEqual({
      overall: 'degraded',
      total: 3,
      ok: 2,
      degraded: 0,
      unreachable: 1,
    })
  })

  it('reports operational only when every upstream is ok', () => {
    const allOk = { status: 'ok', upstreams: aggregate.upstreams.slice(0, 2) }
    const state = liveServicesFrom(allOk)
    expect(state.phase === 'loaded' && state.summary.overall).toBe('operational')
  })

  it.each([
    ['null (a body that failed to parse as JSON)', null],
    ['a string', 'service unavailable'],
    ['an error page object', { error: 'bad gateway' }],
    ['an aggregate whose upstreams are not an array', { status: 'ok', upstreams: 'many' }],
    ['an entry missing its name', { status: 'ok', upstreams: [{ url: 'https://x.example', status: 'ok' }] }],
  ])('degrades to unavailable for %s', (_label, body) => {
    expect(liveServicesFrom(body).phase).toBe('unavailable')
  })

  it('counts an unknown upstream status pessimistically rather than dropping it', () => {
    const state = liveServicesFrom({
      status: 'ok',
      upstreams: [{ name: 'mystery', url: 'https://x.example', status: 'brand-new' }],
    })
    expect(state.phase === 'loaded' && state.summary.total).toBe(1)
    expect(state.phase === 'loaded' && state.summary.unreachable).toBe(1)
  })
})

describe('the gateway URL is defined once', () => {
  it('has no trailing slash and points the aggregate at the health path', () => {
    expect(GATEWAY_URL).not.toMatch(/\/$/)
    expect(UPSTREAMS_URL).toBe(`${GATEWAY_URL}/health/upstreams`)
  })

  it('is the same constant the status board uses (reads BOTH sources)', () => {
    // L-003: the board and the proof tile must read one endpoint. If either
    // re-derives its own URL, they can be pointed at different gateways and
    // disagree in front of the visitor.
    const board = readFileSync(path.join(process.cwd(), 'src/pages/StatusPage.tsx'), 'utf-8')
    expect(board, 'StatusPage must import the shared gateway constant').toMatch(
      /import \{[^}]*UPSTREAMS_URL[^}]*\} from '\.\.\/features\/status\/gateway'/,
    )
    expect(board, 'StatusPage must not re-derive the gateway URL').not.toContain(
      'import.meta.env.VITE_GATEWAY_URL',
    )
  })
})
