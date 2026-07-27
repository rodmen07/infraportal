/**
 * NotFound catch-all coverage (2026-07-25).
 *
 * The app router (`Root()` in src/main.tsx) is a node-env-hostile React tree,
 * so — matching this repo's established pattern (routeIntegrity.test.ts,
 * tokens.test.ts) — its wiring is asserted by scanning its source rather than
 * by rendering it. These checks prove the BEHAVIOUR DIFFERENCE this increment
 * introduced: the router's terminal fallback is now `<NotFoundPage />`, and
 * `<App />` (Home) is reachable ONLY through the explicit `isHomeHash` root
 * guard. If the old `return <App />` catch-all were restored, either the
 * NotFound fallback assertion or the "App rendered exactly once" assertion
 * fails — the on/off proof (L-001).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NOT_FOUND_RECOVERY_LINKS } from './notFoundLinks'

const ROOT = process.cwd()
const MAIN_SRC = readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf-8')
const PAGE_SRC = readFileSync(path.join(ROOT, 'src/pages/NotFoundPage.tsx'), 'utf-8')

/** The router's exact/prefix route vocabulary, parsed the same way the
 * route-integrity guard parses it. */
function parseVocab(source: string) {
  const exact = new Set<string>()
  for (const m of source.matchAll(/hash === '(#\/[^']*)'/g)) exact.add(m[1])
  const prefixes: string[] = []
  for (const m of source.matchAll(/hash\.startsWith\('(#\/[^']*)'\)/g)) prefixes.push(m[1])
  return { exact, prefixes }
}

function resolvesToRealRoute(href: string): boolean {
  if (href === '#/' || href === '') return true
  const { exact, prefixes } = parseVocab(MAIN_SRC)
  if (exact.has(href)) return true
  return prefixes.some((p) => href.startsWith(p))
}

describe('router wiring: NotFound is the catch-all, Home only via the root guard', () => {
  it('main.tsx imports NotFoundPage and the isHomeHash guard', () => {
    expect(MAIN_SRC).toMatch(/import \{ NotFoundPage \} from '\.\/pages\/NotFoundPage'/)
    expect(MAIN_SRC).toMatch(/import \{ isHomeHash \} from '\.\/features\/layout\/homeRoute'/)
  })

  it('the terminal fallback renders NotFoundPage (not Home)', () => {
    expect(MAIN_SRC).toMatch(/return <NotFoundPage \/>/)
  })

  it('Home is served only through the explicit isHomeHash guard', () => {
    expect(MAIN_SRC).toMatch(/if \(isHomeHash\(hash\)\) return <App \/>/)
    // <App /> must be rendered exactly once — via that guard — so no unguarded
    // `return <App />` fallback swallows unknown routes anymore.
    const appReturns = MAIN_SRC.match(/return <App \/>/g) ?? []
    expect(appReturns).toHaveLength(1)
  })

  it('the NotFound return comes after the Home guard (unknown hashes fall to NotFound)', () => {
    const homeGuardIdx = MAIN_SRC.indexOf('if (isHomeHash(hash)) return <App />')
    const notFoundIdx = MAIN_SRC.indexOf('return <NotFoundPage />')
    expect(homeGuardIdx).toBeGreaterThan(-1)
    expect(notFoundIdx).toBeGreaterThan(homeGuardIdx)
  })
})

describe('NotFoundPage structure and a11y (source scan)', () => {
  it('wraps its content in PageLayout, which provides the <nav>, SkipLink and <main> landmark', () => {
    expect(PAGE_SRC).toMatch(/import \{ PageLayout \}/)
    expect(PAGE_SRC).toMatch(/<PageLayout>/)
  })

  it('fires the registered route_not_found event (recorded externally only once the v1.22.2 sink is wired)', () => {
    expect(PAGE_SRC).toMatch(/trackPortfolioEvent\(PORTFOLIO_EVENTS\.route_not_found/)
  })

  it('renders recovery CTAs through the focus-visible Button primitive', () => {
    expect(PAGE_SRC).toMatch(/import \{ Button \}/)
    expect(PAGE_SRC).toMatch(/<Button\b/)
  })

  it('introduces no raw palette / opacity ghost classes (tokens only)', () => {
    // The v1.18.4 ghost-class failure mode: a raw amber/zinc/emerald opacity
    // class with no light-theme override renders invisible. This page must use
    // only semantic tokens, so it cannot reintroduce that class.
    expect(PAGE_SRC).not.toMatch(/\b(?:text|bg|border)-(?:amber|zinc|emerald|red|green|orange)-\d/)
  })
})

describe('NotFound recovery links resolve to real, public routes', () => {
  it('every recovery href is handled by the router (no dead-end from the 404 page)', () => {
    const broken = NOT_FOUND_RECOVERY_LINKS.map((l) => l.href).filter((h) => !resolvesToRealRoute(h))
    expect(broken, `recovery links point at routes main.tsx does not handle: ${broken.join(', ')}`).toEqual([])
  })

  it('no recovery link points at an auth-gated surface', () => {
    const gated = ['#/crm', '#/admin', '#/portal', '#/search']
    const behindLogin = NOT_FOUND_RECOVERY_LINKS.map((l) => l.href).filter((h) =>
      gated.some((g) => h === g || h.startsWith(`${g}/`)),
    )
    expect(behindLogin).toEqual([])
  })

  it('exactly one primary (accent) recovery action', () => {
    const accents = NOT_FOUND_RECOVERY_LINKS.filter((l) => l.variant === 'accent')
    expect(accents).toHaveLength(1)
    expect(accents[0].href).toBe('#/')
  })
})
