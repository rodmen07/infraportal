/**
 * Home-page proof tiles (PROOF-COST-1 / v1.20.1).
 *
 * The tile these tests exist for used to hard-code "$0" beside a recurring-cost
 * label, a standing statement about the present in a static bundle that cannot
 * observe the present. It was true when it was written and false from
 * 2026-07-21, when the Cloud Run half of the platform was revived, and a
 * visitor was one click from `#/status` showing eleven services up.
 *
 * So the interesting property is not "the tile says 11". It is that the tile
 * NEVER states a number it did not measure, in any phase, and always offers the
 * board where the claim can be checked.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { BUILT_PROOF_STATS, STATUS_BOARD_HASH, liveServicesStat, proofStats } from './proofStats'
import type { LiveServicesState } from '../status/useLiveServices'
import type { Summary } from '../status/statusModel'

const ROOT = process.cwd()
const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), 'utf-8')

const summary = (ok: number, total: number): Summary => ({
  overall: ok === total ? 'operational' : 'degraded',
  total,
  ok,
  degraded: 0,
  unreachable: total - ok,
})

const LOADED: LiveServicesState = { phase: 'loaded', summary: summary(11, 12) }
const LOADING: LiveServicesState = { phase: 'loading' }
const UNAVAILABLE: LiveServicesState = { phase: 'unavailable' }

describe('the live services tile', () => {
  it('reports the measured counts when the aggregate was read', () => {
    expect(liveServicesStat(LOADED)).toEqual({
      value: '11/12',
      label: 'Services live now',
      href: STATUS_BOARD_HASH,
    })
    expect(liveServicesStat({ phase: 'loaded', summary: summary(12, 12) }).value).toBe('12/12')
  })

  it.each([
    ['loading', LOADING],
    ['unavailable', UNAVAILABLE],
  ])('states no count and no verdict while %s', (_phase, state) => {
    const stat = liveServicesStat(state as LiveServicesState)
    expect(stat.value, 'an unmeasured tile must not show a number').not.toMatch(/\d/)
    expect(
      `${stat.value} ${stat.label}`.toLowerCase(),
      'an unmeasured tile must not assert a verdict either',
    ).not.toMatch(/\b(live|up|down|operational|offline)\b/)
  })

  it('always offers the board where the claim can be checked', () => {
    for (const state of [LOADED, LOADING, UNAVAILABLE]) {
      expect(liveServicesStat(state).href).toBe(STATUS_BOARD_HASH)
    }
  })
})

describe('the proof strip stats', () => {
  it('are the two built-work facts plus the measured tile, in that order', () => {
    const stats = proofStats(LOADED)
    expect(stats).toHaveLength(3)
    expect(stats.slice(0, 2)).toEqual(BUILT_PROOF_STATS)
    expect(stats[2]).toEqual(liveServicesStat(LOADED))
  })

  it('keeps the built-work facts free of runtime claims (they never link out)', () => {
    for (const stat of BUILT_PROOF_STATS) {
      expect(stat.href).toBeUndefined()
    }
  })
})

describe('the component is actually wired to the measured model', () => {
  // L-001: this is the assertion that reddens if someone reverts the tile to a
  // hard-coded value. A pure model nothing renders would pass every test above
  // while the home page kept lying.
  const source = read('src/features/site/ProofStrip.tsx')

  it('ProofStrip reads the live aggregate and renders the derived stats', () => {
    expect(source).toContain('useLiveServices()')
    expect(source).toContain('proofStats(')
  })

  it('ProofStrip hard-codes no tile value of its own', () => {
    // Deliberately broader than "no cost literal": ANY hand-typed tile value in
    // the component is a claim nothing can verify, which is how the retired
    // cost tile got there. The literal it used to carry is quoted as a negative
    // control in runtimeStatusCopy.test.ts, the one file exempt from that scan.
    expect(source, 'tile values must come from the model, never from a literal').not.toMatch(
      /value: '[^']*'/,
    )
  })

  it('renders linked tiles as anchors with a visible focus state', () => {
    expect(source).toContain('href={stat.href}')
    expect(source).toMatch(/focus-visible:ring/)
  })
})

describe('the tile links to a route the router actually handles', () => {
  // The L-003 drift half: read BOTH sources, so renaming the status route
  // reddens here instead of shipping a proof tile that lands on the 404 page.
  it('main.tsx has an explicit route for the status board hash', () => {
    const routes = new Set<string>()
    for (const m of read('src/main.tsx').matchAll(/hash === '(#\/[^']*)'/g)) routes.add(m[1])
    expect(routes.size, 'the router vocabulary scan found nothing, so this check is vacuous').toBeGreaterThan(15)
    expect(
      routes.has(STATUS_BOARD_HASH),
      `the proof tile links to ${STATUS_BOARD_HASH} but src/main.tsx no longer handles it`,
    ).toBe(true)
  })
})
