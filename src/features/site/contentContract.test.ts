/**
 * Committed-content contract guard (QA 2026-07-26, first coverage for the
 * content pipeline; files CONTENT-DEAD-1 and CONTENT-ORPHAN-1).
 *
 * WHY THIS EXISTS. Five hooks (usePricingContent, useServicesContent,
 * useCaseStudiesContent, useSiteContent, useHomeSectionsContent) fetch JSON
 * from `public/content/` at runtime, blind-cast the payload with `as`, and on
 * ANY failure silently keep a default whose arrays are empty. The committed
 * JSON is hand-edited marketing content with no schema, no validator and, until
 * this file, no test reading it at all (the hooks shipped 2026-05-01 and were
 * never referenced by a test). Two silent failure modes follow:
 *
 *   1. A malformed edit (trailing comma) makes `res.json()` throw, the catch
 *      swallows it, and the PRICING page renders with zero tiers under a fully
 *      green CI. The monetization surface empties itself with no error.
 *   2. A mis-shaped edit (a tier missing `features`) passes the blind cast and
 *      CRASHES at render: `PricingCard` calls `features.map`, React unmounts
 *      the tree, and the visitor gets a blank page.
 *
 * Every assertion reads BOTH sources it compares (L-003): the committed JSON in
 * `public/content/` on one side, and the render contract (what the components
 * actually dereference) or the router vocabulary in `src/main.tsx` or the hook
 * fetch targets in `src/` on the other.
 *
 *   A  parseable        every runtime content file parses as JSON
 *   B  render contract  every field a component dereferences is present and
 *                       well-typed in the committed data
 *   C  routes resolve   every `#/...` string inside content resolves against
 *                       the router vocabulary; case-study detail links must hit
 *                       an EXACT route arm, because the `#/case-studies/`
 *                       prefix catch-all would otherwise bless a typo'd slug
 *                       and land the visitor on the index silently
 *   D  coupling         the set of files this guard validates equals the set of
 *                       `content/*.json` fetch targets in non-test `src/`
 *   E  no strays        every file in `public/content/` is either guarded (a
 *                       runtime fetch target) or on a named allowlist with a
 *                       reason; allowlist entries fail when their premise dies
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, 'public', 'content')
const ROUTER_SOURCE = 'src/main.tsx'

/** The runtime content files: fetched by a hook, validated by contract B. */
const GUARDED = [
  'site.json',
  'pricing.json',
  'services.json',
  'case_studies.json',
  'home_sections.json',
] as const

/**
 * Files in public/content that no hook fetches. Each entry names its reason;
 * contract E asserts the premise still holds (the file exists, and for orphans
 * that runtime src still does not reference it), so an entry cannot outlive
 * what it exempts and a NEW stray file cannot hide behind an old excuse.
 */
const NON_RUNTIME: ReadonlyArray<{ file: string; reason: 'script-output' | 'orphan' }> = [
  // Written by scripts/setup-stripe-payment-links.mjs as the record of the
  // generated Stripe links; read by tests and the script, never fetched by the app.
  { file: 'stripe_payment_links.json', reason: 'script-output' },
  // CONTENT-ORPHAN-1: RetainersPage renders INLINE data; this file is a decoy
  // duplicate that editing changes nothing. Owner call: delete or wire up.
  { file: 'retainers.json', reason: 'orphan' },
  // CONTENT-ORPHAN-1: LeadMagnetPage does not fetch it.
  { file: 'lead-magnet.json', reason: 'orphan' },
  // CONTENT-ORPHAN-1: fetched by nothing AND still describes the retired
  // Task Portal identity (Kanban board, goal planner) on a public URL.
  { file: 'roadmap.json', reason: 'orphan' },
]

function raw(file: string): string {
  return readFileSync(path.join(CONTENT_DIR, file), 'utf-8')
}

function parsed(file: string): unknown {
  return JSON.parse(raw(file))
}

// ---------------------------------------------------------------------------
// Validators: pure functions returning a list of problems, so the negative
// controls can assert the exact complaint and the it.each output names the file.
// ---------------------------------------------------------------------------

type Problems = string[]

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => isNonEmptyString(x))
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** App.tsx renders title/subtitle; useSiteContent falls back per-field, but the
 * authored file must be complete so the fallback never masks a content hole. */
export function validateSite(v: unknown): Problems {
  const p: Problems = []
  const j = asRecord(v)
  if (!j) return ['site: root is not an object']
  if (!isNonEmptyString(j.title)) p.push('site: title missing or empty')
  if (!isNonEmptyString(j.subtitle)) p.push('site: subtitle missing or empty')
  if (!isNonEmptyString(j.heroTagline)) p.push('site: heroTagline missing or empty')
  return p
}

/** PricingPage reads note/tiers; PricingCard dereferences features.map,
 * renders tier/price/description/ctaLabel and keys the grid on tier. */
export function validatePricing(v: unknown): Problems {
  const p: Problems = []
  const j = asRecord(v)
  if (!j) return ['pricing: root is not an object']
  if (!isNonEmptyString(j.note)) p.push('pricing: note missing or empty')
  if (!Array.isArray(j.tiers) || j.tiers.length === 0) {
    p.push('pricing: tiers missing or empty (the pricing grid would render nothing)')
    return p
  }
  const names = new Set<string>()
  j.tiers.forEach((t, i) => {
    const tier = asRecord(t)
    if (!tier) {
      p.push(`pricing: tiers[${i}] is not an object`)
      return
    }
    for (const key of ['tier', 'price', 'description', 'ctaLabel'] as const) {
      if (!isNonEmptyString(tier[key])) p.push(`pricing: tiers[${i}].${key} missing or empty`)
    }
    if (!isStringArray(tier.features) || (tier.features as string[]).length === 0) {
      // PricingCard calls features.map unconditionally: a missing array is a
      // render crash, not a cosmetic gap.
      p.push(`pricing: tiers[${i}].features missing, empty, or not an array of strings`)
    }
    if (typeof tier.highlighted !== 'boolean') p.push(`pricing: tiers[${i}].highlighted must be boolean`)
    if (!isNonEmptyString(tier.ctaHref)) p.push(`pricing: tiers[${i}].ctaHref missing or empty`)
    if (tier.checkoutUrl !== null && tier.checkoutUrl !== undefined) {
      if (typeof tier.checkoutUrl !== 'string' || !/^https:\/\/buy\.stripe\.com\//.test(tier.checkoutUrl)) {
        p.push(`pricing: tiers[${i}].checkoutUrl must be null or an https buy.stripe.com link`)
      }
    }
    if (tier.scarcity !== null && tier.scarcity !== undefined && !isNonEmptyString(tier.scarcity)) {
      p.push(`pricing: tiers[${i}].scarcity must be null or a non-empty string`)
    }
    const name = String(tier.tier)
    if (names.has(name)) p.push(`pricing: duplicate tier name "${name}" (React keys the grid on tier)`)
    names.add(name)
  })
  return p
}

/** ServicesPage maps services into ServiceCard, which dereferences tags.map. */
export function validateServices(v: unknown): Problems {
  const p: Problems = []
  const j = asRecord(v)
  if (!j) return ['services: root is not an object']
  if (!isNonEmptyString(j.intro)) p.push('services: intro missing or empty')
  if (!Array.isArray(j.services) || j.services.length === 0) {
    p.push('services: services missing or empty')
    return p
  }
  j.services.forEach((s, i) => {
    const svc = asRecord(s)
    if (!svc) {
      p.push(`services: services[${i}] is not an object`)
      return
    }
    if (!isNonEmptyString(svc.title)) p.push(`services: services[${i}].title missing or empty`)
    if (!isNonEmptyString(svc.description)) p.push(`services: services[${i}].description missing or empty`)
    if (!isStringArray(svc.tags)) p.push(`services: services[${i}].tags must be an array of strings`)
  })
  return p
}

function validateCaseStudy(cs: unknown, label: string): Problems {
  const p: Problems = []
  const j = asRecord(cs)
  if (!j) return [`case_studies: ${label} is not an object`]
  for (const key of ['title', 'subtitle', 'description'] as const) {
    if (!isNonEmptyString(j[key])) p.push(`case_studies: ${label}.${key} missing or empty`)
  }
  // CaseStudyCard dereferences .length and .map on both arrays unconditionally.
  if (!isStringArray(j.techStack)) p.push(`case_studies: ${label}.techStack must be an array of strings`)
  if (!isStringArray(j.highlights)) p.push(`case_studies: ${label}.highlights must be an array of strings`)
  if (j.githubUrl !== undefined && (typeof j.githubUrl !== 'string' || !/^https:\/\//.test(j.githubUrl))) {
    p.push(`case_studies: ${label}.githubUrl must be an https URL when present`)
  }
  if (j.detailUrl !== undefined && !isNonEmptyString(j.detailUrl)) {
    p.push(`case_studies: ${label}.detailUrl must be a non-empty string when present`)
  }
  return p
}

/** CaseStudiesPage renders featured (when titled) plus others via CaseStudyCard. */
export function validateCaseStudies(v: unknown): Problems {
  const p: Problems = []
  const j = asRecord(v)
  if (!j) return ['case_studies: root is not an object']
  if (!isNonEmptyString(j.intro)) p.push('case_studies: intro missing or empty')
  p.push(...validateCaseStudy(j.featured, 'featured'))
  if (!Array.isArray(j.others)) {
    p.push('case_studies: others must be an array')
    return p
  }
  j.others.forEach((cs, i) => p.push(...validateCaseStudy(cs, `others[${i}]`)))
  return p
}

/** useHomeSectionsContent filters cards missing heading or body; the committed
 * file must not depend on that filter (a filtered-out card is authored content
 * silently dropped). */
export function validateHomeSections(v: unknown): Problems {
  const p: Problems = []
  const j = asRecord(v)
  if (!j) return ['home_sections: root is not an object']
  if (!isNonEmptyString(j.title)) p.push('home_sections: title missing or empty')
  if (!Array.isArray(j.cards) || j.cards.length === 0) {
    p.push('home_sections: cards missing or empty')
    return p
  }
  j.cards.forEach((c, i) => {
    const card = asRecord(c)
    if (!card) {
      p.push(`home_sections: cards[${i}] is not an object`)
      return
    }
    if (!isNonEmptyString(card.heading)) p.push(`home_sections: cards[${i}].heading missing or empty (the hook would silently drop this card)`)
    if (!isNonEmptyString(card.body)) p.push(`home_sections: cards[${i}].body missing or empty (the hook would silently drop this card)`)
    if (card.link !== undefined && !isNonEmptyString(card.link)) p.push(`home_sections: cards[${i}].link must be a non-empty string when present`)
    if (card.image !== undefined && !isNonEmptyString(card.image)) p.push(`home_sections: cards[${i}].image must be a non-empty string when present`)
  })
  return p
}

const VALIDATORS: Record<(typeof GUARDED)[number], (v: unknown) => Problems> = {
  'site.json': validateSite,
  'pricing.json': validatePricing,
  'services.json': validateServices,
  'case_studies.json': validateCaseStudies,
  'home_sections.json': validateHomeSections,
}

// ---------------------------------------------------------------------------
// Router vocabulary (the routeIntegrity.test.ts parse, applied to content).
// The v1.21.3 repo-wide hash scan sweeps src/**/*.{ts,tsx} only, so a dead
// route inside content JSON was unguarded until this file.
// ---------------------------------------------------------------------------

interface RouteVocabulary {
  exact: Set<string>
  prefixes: string[]
}

function parseRouteVocabulary(source: string): RouteVocabulary {
  const exact = new Set<string>()
  for (const m of source.matchAll(/hash === '(#\/[^']*)'/g)) exact.add(m[1])
  const prefixes: string[] = []
  for (const m of source.matchAll(/hash\.startsWith\('(#\/[^']*)'\)/g)) prefixes.push(m[1])
  return { exact, prefixes }
}

const VOCAB = parseRouteVocabulary(readFileSync(path.join(ROOT, ROUTER_SOURCE), 'utf-8'))

function resolvesGenerically(href: string): boolean {
  if (href === '#/' || href === '') return true
  if (VOCAB.exact.has(href)) return true
  return VOCAB.prefixes.some((prefix) => href.startsWith(prefix))
}

/** Every `#/...` string value anywhere inside a JSON document. */
export function collectHashStrings(v: unknown, found: string[] = []): string[] {
  if (typeof v === 'string') {
    if (v.startsWith('#/')) found.push(v)
  } else if (Array.isArray(v)) {
    v.forEach((x) => collectHashStrings(x, found))
  } else if (v !== null && typeof v === 'object') {
    Object.values(v).forEach((x) => collectHashStrings(x, found))
  }
  return found
}

// ---------------------------------------------------------------------------
// Source scans for contracts D and E.
// ---------------------------------------------------------------------------

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkSourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** The content files runtime code actually fetches, read from non-test src. */
function fetchedContentFiles(): Set<string> {
  const found = new Set<string>()
  for (const file of walkSourceFiles(path.join(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf-8')
    for (const m of source.matchAll(/content\/([a-zA-Z0-9_-]+\.json)/g)) found.add(m[1])
  }
  return found
}

// ---------------------------------------------------------------------------
// The contracts.
// ---------------------------------------------------------------------------

describe('contract A: every runtime content file parses as JSON', () => {
  // The failure mode: a hand-edit typo makes res.json() throw, the hook's
  // catch swallows it, and the page silently renders its empty default.
  it.each(GUARDED)('%s parses', (file) => {
    expect(() => parsed(file)).not.toThrow()
  })
})

describe('contract B: the committed content satisfies the render contract', () => {
  it.each(GUARDED)('%s matches what its consumers dereference', (file) => {
    expect(VALIDATORS[file](parsed(file))).toEqual([])
  })

  it('negative control: a tier missing features is reported (the render-crash shape)', () => {
    const broken = {
      note: 'n',
      tiers: [{ tier: 'T', price: 'p', description: 'd', ctaLabel: 'c', ctaHref: '#/contact', highlighted: false }],
    }
    expect(validatePricing(broken)).toEqual([
      'pricing: tiers[0].features missing, empty, or not an array of strings',
    ])
  })

  it('negative control: duplicate tier names are reported (React key collision)', () => {
    const tier = {
      tier: 'Same',
      price: 'p',
      description: 'd',
      ctaLabel: 'c',
      ctaHref: '#/contact',
      highlighted: false,
      features: ['f'],
    }
    expect(validatePricing({ note: 'n', tiers: [tier, { ...tier }] })).toEqual([
      'pricing: duplicate tier name "Same" (React keys the grid on tier)',
    ])
  })

  it('negative control: a case study with a non-array techStack is reported', () => {
    const cs = { title: 't', subtitle: 's', description: 'd', techStack: 'not-an-array', highlights: [] as string[] }
    expect(validateCaseStudy(cs, 'featured')).toEqual([
      'case_studies: featured.techStack must be an array of strings',
    ])
  })

  it('negative control: a home-sections card the hook would silently drop is reported', () => {
    const problems = validateHomeSections({ title: 't', cards: [{ heading: 'h' }] })
    expect(problems).toEqual(['home_sections: cards[0].body missing or empty (the hook would silently drop this card)'])
  })

  it('negative control: an empty site title is reported', () => {
    expect(validateSite({ title: ' ', subtitle: 's', heroTagline: 'h' })).toEqual(['site: title missing or empty'])
  })
})

describe('contract C: every internal route inside content resolves', () => {
  it('scan sanity: the vocabulary parse found the router', () => {
    expect(VOCAB.exact.size).toBeGreaterThan(15)
    expect(VOCAB.prefixes).toContain('#/case-studies/')
  })

  it.each(GUARDED)('%s has no dead internal destination', (file) => {
    const dead = collectHashStrings(parsed(file)).filter((h) => !resolvesGenerically(h))
    expect(dead).toEqual([])
  })

  it('case-study detail links hit an EXACT route arm, never the index catch-all', () => {
    // `hash.startsWith('#/case-studies/')` renders the case-studies INDEX for
    // any unknown slug, so a typo'd detailUrl "resolves" while silently
    // dropping the visitor on the wrong page. Detail links must therefore
    // match one of the explicit case-study routes in main.tsx.
    const exactCaseStudyRoutes = [...VOCAB.exact].filter((r) => r.startsWith('#/case-studies/'))
    expect(exactCaseStudyRoutes.length).toBeGreaterThanOrEqual(5)
    const detailLinks = collectHashStrings(parsed('case_studies.json')).filter((h) =>
      h.startsWith('#/case-studies/'),
    )
    expect(detailLinks.length).toBeGreaterThan(0)
    const landingOnIndex = detailLinks.filter((h) => !exactCaseStudyRoutes.includes(h))
    expect(landingOnIndex).toEqual([])
  })

  it('negative control: the walker finds a planted dead route and the resolver rejects it', () => {
    const planted = collectHashStrings({ a: { b: ['#/bogus-typo-route', '#/contact'] } })
    expect(planted).toEqual(['#/bogus-typo-route', '#/contact'])
    expect(resolvesGenerically('#/bogus-typo-route')).toBe(false)
    expect(resolvesGenerically('#/contact')).toBe(true)
    // A typo'd case-study slug resolves generically (the catch-all) but must
    // still fail the exact-route clause above; prove the discrimination here.
    expect(resolvesGenerically('#/case-studies/typo-slug')).toBe(true)
    expect([...VOCAB.exact].includes('#/case-studies/typo-slug')).toBe(false)
  })
})

describe('contract D: guard scope equals the runtime fetch targets (both directions)', () => {
  it('every fetched content file is guarded, and every guarded file is fetched', () => {
    const fetched = fetchedContentFiles()
    expect([...fetched].sort()).toEqual([...GUARDED].sort())
  })
})

describe('contract E: no stray file in public/content', () => {
  it('every file is either guarded or excused by name with a live reason', () => {
    const onDisk = readdirSync(CONTENT_DIR).sort()
    const known = [...GUARDED, ...NON_RUNTIME.map((e) => e.file)].sort()
    expect(onDisk).toEqual(known)
  })

  it('an allowlist entry cannot outlive what it exempts', () => {
    const fetched = fetchedContentFiles()
    for (const entry of NON_RUNTIME) {
      // The file must still exist; a deleted file leaves a stale excuse behind.
      expect(readdirSync(CONTENT_DIR)).toContain(entry.file)
      // An orphan must still be an orphan: the moment runtime code fetches it,
      // the entry must move to GUARDED and gain a validator.
      if (entry.reason === 'orphan') {
        expect(fetched.has(entry.file)).toBe(false)
      }
    }
  })

  it('script-output entries are actually written by a script', () => {
    const script = readFileSync(path.join(ROOT, 'scripts', 'setup-stripe-payment-links.mjs'), 'utf-8')
    expect(script).toContain('stripe_payment_links.json')
  })
})
