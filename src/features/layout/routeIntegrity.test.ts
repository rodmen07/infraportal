/**
 * Navigation route-integrity guard (QA, 2026-07-23).
 *
 * The app is a hash router: `Root()` in src/main.tsx matches `window.location.hash`
 * against a chain of `hash === '#/...'` / `hash.startsWith('#/...')` conditions and
 * renders the matching page. Anything it does NOT match falls through to `<App />`
 * — the Home page — with no error. So a hardcoded internal destination that points
 * at a route the router does not handle does not 404: it silently drops the visitor
 * on Home. That is the exact "shipped surface that silently does nothing" failure
 * class, and nothing tested it.
 *
 * Three data-driven navigation sources feed users those internal destinations:
 *   - NAV_ITEMS       (features/layout/navItems.ts) — the site nav, the oldest of
 *                      the three and never route-tested until now.
 *   - COMMANDS        (features/commandPalette/commands.ts) — the Cmd/Ctrl-K palette
 *                      (NF-3, shipped PR #66). Its own test only asserts hrefs START
 *                      with `#/`, never that they resolve.
 *   - TOUR            (features/tour/tourSteps.ts) — the guided tour (NF-2, PR #68).
 *                      Same gap: `tour.test.ts` checks the `#/` prefix and guards the
 *                      one known-bad `#/portal`, but not that each step resolves.
 *
 * This is a DRIFT GUARD that reads BOTH sides of the contract — the router source
 * (the route vocabulary) and every destination list — and fails if a destination
 * ever names a route the router does not handle, whether from a typo in a new
 * command or a route renamed/removed in main.tsx. Source-scan assertions, matching
 * this repo's established pattern (tokens.test.ts, typeScaleFloor.test.ts,
 * socialMeta.test.ts): the router is a node-env-hostile React tree, so its route
 * vocabulary is read as text rather than by rendering it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NAV_ITEMS } from './navItems'
import { COMMANDS } from '../commandPalette/commands'
import { TOUR } from '../tour/tourSteps'

const ROOT = process.cwd()
const ROUTER_SOURCE = 'src/main.tsx'

interface RouteVocabulary {
  /** Routes matched by an exact `hash === '#/...'` comparison. */
  exact: Set<string>
  /** Route prefixes matched by `hash.startsWith('#/...')`. */
  prefixes: string[]
}

/** Read the router's route vocabulary out of its source, not by rendering it. */
function parseRouteVocabulary(source: string): RouteVocabulary {
  const exact = new Set<string>()
  for (const m of source.matchAll(/hash === '(#\/[^']*)'/g)) exact.add(m[1])
  const prefixes: string[] = []
  for (const m of source.matchAll(/hash\.startsWith\('(#\/[^']*)'\)/g)) prefixes.push(m[1])
  return { exact, prefixes }
}

/**
 * True when `href` is handled by an EXPLICIT route in the router. `#/` (and the
 * empty hash) is the Home route, served by the `<App />` fallback on purpose, so it
 * counts as resolved; every other href must match an explicit condition rather than
 * merely fall through to that same fallback (falling through when you meant a real
 * page IS the bug this guard exists to catch).
 */
function makeResolver(vocab: RouteVocabulary): (href: string) => boolean {
  return (href) => {
    if (href === '#/' || href === '') return true
    if (vocab.exact.has(href)) return true
    return vocab.prefixes.some((p) => href.startsWith(p))
  }
}

/** The internal (hash-route) destinations of a source, ignoring external URLs. */
function internalHrefs(hrefs: readonly (string | undefined)[]): string[] {
  return hrefs.filter((h): h is string => typeof h === 'string' && h.startsWith('#/'))
}

const VOCAB = parseRouteVocabulary(readFileSync(path.join(ROOT, ROUTER_SOURCE), 'utf-8'))
const resolves = makeResolver(VOCAB)

describe('router route vocabulary (scan sanity / negative control)', () => {
  it('the scan actually found the router routes (would fire if main.tsx were restructured beyond this regex)', () => {
    // Guards against a scrape that silently matches nothing and lets every
    // destination "resolve" against an empty vocabulary — the preflight
    // negative-control philosophy applied to a source scan.
    expect(VOCAB.exact.size).toBeGreaterThan(15)
    // Sentinels that must always be explicit routes.
    expect(VOCAB.exact.has('#/status')).toBe(true)
    expect(VOCAB.exact.has('#/contact')).toBe(true)
    expect(VOCAB.exact.has('#/api-docs')).toBe(true)
    expect(VOCAB.prefixes).toContain('#/case-studies/')
  })

  it('the resolver discriminates a real route from a made-up one', () => {
    expect(resolves('#/status')).toBe(true)
    expect(resolves('#/')).toBe(true)
    expect(resolves('#/definitely-not-a-real-route')).toBe(false)
    expect(resolves('#/foo/bar')).toBe(false)
    // The router's `hash.startsWith('#/case-studies/')` arm is a deliberate
    // catch-all: any `#/case-studies/<x>` renders the case-studies index rather
    // than a 404, so anything under that prefix legitimately resolves.
    expect(resolves('#/case-studies/anything')).toBe(true)
  })

  it('the guard flags a planted broken destination (proves it is not vacuous)', () => {
    // The on/off proof (L-001): the same check that returns [] for the real
    // lists returns the offender for a list containing a dead route.
    const planted = ['#/status', '#/bogus-typo-route']
    const broken = internalHrefs(planted).filter((h) => !resolves(h))
    expect(broken).toEqual(['#/bogus-typo-route'])
  })
})

describe('every navigation destination resolves to a real route', () => {
  it('site nav (NAV_ITEMS) — oldest navigation surface, first route coverage', () => {
    const broken = internalHrefs(NAV_ITEMS.map((i) => i.href)).filter((h) => !resolves(h))
    expect(broken, `NAV_ITEMS point at routes main.tsx does not handle: ${broken.join(', ')}`).toEqual([])
  })

  it('command palette (COMMANDS, NF-3) — internal destinations only', () => {
    const internal = internalHrefs(COMMANDS.filter((c) => !c.external).map((c) => c.href))
    const broken = internal.filter((h) => !resolves(h))
    expect(broken, `COMMANDS point at routes main.tsx does not handle: ${broken.join(', ')}`).toEqual([])
  })

  it('guided tour (TOUR, NF-2) — every step that navigates lands on a real route', () => {
    const broken = internalHrefs(TOUR.map((s) => s.href)).filter((h) => !resolves(h))
    expect(broken, `TOUR steps point at routes main.tsx does not handle: ${broken.join(', ')}`).toEqual([])
  })
})
