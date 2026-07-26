/**
 * Navigation route-integrity guard (QA, 2026-07-23).
 *
 * The app is a hash router: `Root()` in src/main.tsx matches `window.location.hash`
 * against a chain of `hash === '#/...'` / `hash.startsWith('#/...')` conditions and
 * renders the matching page. The root/empty hash (`isHomeHash`) renders `<App />`
 * (Home); every OTHER unmatched hash now renders `<NotFoundPage />` (2026-07-25).
 * That NotFound page exists precisely because an unhandled internal destination
 * used to fall through to Home with no error — the exact "shipped surface that
 * silently does nothing" failure class this guard was written to catch on the nav
 * side. A destination naming a route the router does not handle is still a bug
 * (it now dead-ends on 404 rather than on Home), so this guard still fails it.
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
 *
 * ── v1.21.3 (D-7b): the fourth source, and the reason it took a second pass ──
 *
 * The three lists above are the STRUCTURED destinations. They were never the
 * whole surface: a manual sweep on 2026-07-25 walked every hash literal in the
 * tree by hand and a measurement on 2026-07-26 counted 73 distinct `#/` strings
 * across 39 files that no test read. That sweep found no live dead route, which
 * is exactly why it needed to become a guard instead of a finding — a clean
 * result that nothing enforces decays the moment the next `href` is typed.
 *
 * The sweep also proved why the raw grep is NOT directly usable, and that is the
 * whole design of the scan below. About a quarter of the hash-shaped literals in
 * this tree are not destinations at all and MUST NOT resolve:
 *
 *   - OpenAPI `$ref` JSON Pointers (`#/components/schemas/Widget`), which are
 *     offsets into a spec document and share the fragment syntax by coincidence;
 *   - deliberate negative controls (`#/bogus-typo-route`) that exist precisely to
 *     prove guards like this one are not vacuous — resolve them and every such
 *     proof silently inverts;
 *   - prose placeholders in docstrings (`#/...`).
 *
 * So the scan carries an EXCLUSION list, and the exclusion list carries its own
 * guard: every entry must still match something (an exemption cannot outlive what
 * it exempts, the convention runtimeStatusCopy.test.ts set), and the
 * negative-control entries are scoped to `*.test.ts(x)` so a genuinely dead route
 * in a shipped component can never hide behind a fixture's excuse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
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
 * empty hash) is the Home route, served by the explicit `isHomeHash` guard on
 * purpose, so it counts as resolved; every other href must match an explicit
 * condition rather than land on the NotFound catch-all (landing on NotFound when
 * you meant a real page IS the bug this guard exists to catch).
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

// ─── v1.21.3 (D-7b): the inline destinations, i.e. everything else ───────────

/** A hash-shaped literal, with the file it was found in. */
interface HashLiteral {
  readonly file: string
  /** The literal as written, including any `${...}` interpolation. */
  readonly raw: string
  /** The statically known part: everything before the first `${`. */
  readonly href: string
}

/**
 * An excused class of hash-shaped literal.
 *
 * `scope: 'tests'` means the excuse applies ONLY inside `*.test.ts(x)`. That
 * distinction is the load-bearing part of this list: the negative controls are
 * legitimate in a fixture and are a live bug in a component, and a single flat
 * allowlist would have excused both.
 */
interface HashExclusion {
  readonly label: string
  readonly pattern: RegExp
  readonly scope: 'tests' | 'any'
  readonly why: string
}

const EXCLUSIONS: readonly HashExclusion[] = [
  {
    label: 'openapi-json-pointer',
    pattern: /^#\/(components|paths|definitions|parameters|responses)\//,
    scope: 'any',
    why: 'RFC 6901 JSON Pointers into an OpenAPI document ($ref targets). Same syntax as a hash route by coincidence; they are resolved inside the spec, never navigated to. Live in apiDocs/specModel.ts and its tests.',
  },
  {
    label: 'prose-placeholder',
    pattern: /^#\/\.\.\.$/,
    scope: 'any',
    why: 'Docstring shorthand meaning "any hash route", e.g. in footerLinks.ts. Not a destination anyone can click.',
  },
  {
    label: 'planted-dead-route',
    pattern: /^#\/(bogus-typo-route|definitely-not-a-real-route|foo\/bar)$/,
    scope: 'tests',
    why: 'The planted offenders that prove this guard, the NotFound fallback and the footer guard are not vacuous. They MUST stay unresolvable; resolving one silently inverts the proof it exists for.',
  },
  {
    label: 'near-miss-hash',
    pattern: /^#\/(home|admin|crm|api-doc|api-docsx)(\?|$)/,
    scope: 'tests',
    why: 'Hashes that look like real routes and deliberately are not (#/crm/admin and #/api-docs exist; the bare and near-miss forms do not), used to prove the router and the deep-link parser discriminate rather than prefix-match.',
  },
  {
    label: 'synthetic-query-fixture',
    pattern: /^#\/x\?/,
    scope: 'tests',
    why: 'checkoutTier.test.ts reads ?tier= out of a hash regardless of which route carries it, so its fixture uses a deliberately meaningless route.',
  },
]

const isTestFile = (relPath: string) => /\.test\.tsx?$/.test(relPath)

/** The exclusion excusing this literal, if any. */
function exclusionFor(literal: HashLiteral): HashExclusion | undefined {
  return EXCLUSIONS.find(
    (e) => e.pattern.test(literal.href) && (e.scope === 'any' || isTestFile(literal.file)),
  )
}

/** Every .ts/.tsx file under src/, relative to the repo root, sorted. */
function allSourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allSourceFiles(relPath))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) found.push(relPath)
  }
  return found.sort()
}

/**
 * Hash-shaped string literals in a source file, in any quote style.
 *
 * A template literal is truncated at its first `${`: `` `#/case-studies/${slug}` ``
 * contributes `#/case-studies/`, which is exactly what the router's
 * `startsWith('#/case-studies/')` arm answers. Checking the static prefix is the
 * most this scan can honestly claim about a computed destination.
 */
function hashLiteralsIn(file: string, text: string): HashLiteral[] {
  const found: HashLiteral[] = []
  for (const m of text.matchAll(/[`'"](#\/[^`'"\s]*)[`'"]/g)) {
    const raw = m[1]
    const interpolation = raw.indexOf('${')
    found.push({ file, raw, href: interpolation === -1 ? raw : raw.slice(0, interpolation) })
  }
  return found
}

const SOURCE_FILES = allSourceFiles()
const HASH_LITERALS = SOURCE_FILES.flatMap((f) =>
  hashLiteralsIn(f, readFileSync(path.join(ROOT, f), 'utf-8')),
)
const CHECKED_LITERALS = HASH_LITERALS.filter((l) => !exclusionFor(l))

describe('inline hash-destination scan (sanity / negative control)', () => {
  it('the walk found the tree and the literals (a scan over nothing would pass vacuously)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(150)
    expect(SOURCE_FILES).toContain(ROUTER_SOURCE)
    // Measured 2026-07-26: 287 literals across the tree, 77 distinct. The floors
    // are deliberately loose — this asserts the scan still SEES the surface, and
    // the resolution test below is what asserts the surface is correct.
    expect(HASH_LITERALS.length).toBeGreaterThan(200)
    expect(new Set(HASH_LITERALS.map((l) => l.href)).size).toBeGreaterThan(50)
    // It must reach past the structured lists into ordinary components.
    expect(HASH_LITERALS.map((l) => l.file)).toContain('src/features/site/ProofStrip.tsx')
  })

  it('a dead route in a shipped component is NOT excused by a test-scoped exclusion', () => {
    // The clause that makes the exclusion list safe (L-001 on/off proof, baked
    // in): the same href is excused in a fixture and caught in a component.
    const inFixture = { file: 'src/pages/NotFoundPage.test.ts', raw: '#/bogus-typo-route', href: '#/bogus-typo-route' }
    const inComponent = { file: 'src/pages/SomePage.tsx', raw: '#/bogus-typo-route', href: '#/bogus-typo-route' }
    expect(exclusionFor(inFixture)?.label).toBe('planted-dead-route')
    expect(exclusionFor(inComponent)).toBeUndefined()
  })

  it('classifies the non-destination literals this tree really contains', () => {
    const label = (file: string, href: string) => exclusionFor({ file, raw: href, href })?.label
    expect(label('src/features/apiDocs/specModel.ts', '#/components/schemas/Widget')).toBe('openapi-json-pointer')
    expect(label('src/features/apiDocs/specModel.test.ts', '#/paths/~1health/get')).toBe('openapi-json-pointer')
    expect(label('src/features/layout/footerLinks.ts', '#/...')).toBe('prose-placeholder')
    expect(label('src/features/consulting/checkoutTier.test.ts', '#/x?tier=b')).toBe('synthetic-query-fixture')
    // A real destination is never excused, in a test file or anywhere else.
    expect(label('src/features/site/ProofStrip.tsx', '#/status')).toBeUndefined()
    expect(label('src/features/layout/siteFooter.test.ts', '#/contact')).toBeUndefined()
  })

  it('a template-literal destination is checked by its static prefix', () => {
    const [literal] = hashLiteralsIn('src/x.tsx', 'href={`#/case-studies/${slug}`}')
    expect(literal.href).toBe('#/case-studies/')
    expect(resolves(literal.href)).toBe(true)
  })
})

describe('every inline hash destination in src resolves to a real route', () => {
  it('no shipped or test source names a route main.tsx does not handle', () => {
    const broken = CHECKED_LITERALS.filter((l) => !resolves(l.href))
    const detail = broken.map((b) => `${b.file}: ${b.raw}`).join('\n  ')
    expect(
      broken.map((b) => b.href),
      `these hash literals name routes main.tsx does not handle, so they dead-end on the ` +
        `NotFound page instead of the page they meant:\n  ${detail}\n` +
        'Fix the destination, or — if it is deliberately not a route (a JSON Pointer, a ' +
        'planted negative control) — add an EXCLUSIONS entry with a reason and the narrowest ' +
        'scope that covers it.',
    ).toEqual([])
  })
})

describe('the exclusion list cannot outlive what it exempts', () => {
  it.each(EXCLUSIONS)('$label still matches something in the tree', ({ label, pattern, scope, why }) => {
    const matched = HASH_LITERALS.filter(
      (l) => pattern.test(l.href) && (scope === 'any' || isTestFile(l.file)),
    )
    expect(
      matched.length,
      `EXCLUSIONS entry "${label}" (${String(pattern)}, scope ${scope}) no longer matches any ` +
        `literal in src/, so its reason ("${why}") is stale. Delete the entry — an exclusion ` +
        'list that keeps entries nothing needs is how a real dead route eventually hides in it.',
    ).toBeGreaterThan(0)
  })
})
