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
 *   F  bulk ladder      every retainer tier bills below the published base
 *                       rate, the discount deepens as capacity grows, each
 *                       card's arithmetic matches its own claim, and the two
 *                       hand-edited sources quote the same weekly prices
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
  // CONTENT-ORPHAN-1 / retainers.json: RESOLVED 2026-07-29 by deletion, the
  // owner call this list was waiting on. RetainersPage renders INLINE data, so
  // the file was a decoy duplicate that editing changed nothing; the repricing
  // would have left it serving a third stale copy of the rates (plus two dead
  // Stripe links, one of them a fabricated id) from a public URL.
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

// ---------------------------------------------------------------------------
// Contract F: the bulk ladder.
//
// `validatePricing` above accepts ANY non-empty `price` string, which is how
// the pre-2026-07-29 ladder shipped an ANTI-discount unnoticed: retainers were
// authored as hour RANGES ($1,500/week for 10-15 hrs), so their effective rate
// was a band of $100-$150/hr against a $125/hr base. The bulk tiers cost MORE
// per hour than the base rate at the top of every band, and nothing failed.
//
// The rates also live in two hand-edited places that no code couples: the
// aggregate card in pricing.json, and the INLINE array in RetainersPage.tsx
// (which is not fetched, so it does not follow the JSON). A half-applied
// repricing leaves them disagreeing, silently, on the monetization surface.
//
// Both validators below read BOTH sources (L-003) and check the PROPERTY
// rather than the literals, so they survive the next repricing without edits.
// ---------------------------------------------------------------------------

const RETAINERS_PAGE = 'src/pages/RetainersPage.tsx'

interface LadderRung {
  tier: string
  weekly: number
  hours: number
  statedRate: number
  statedDiscountPct: number
  statedBase: number
}

function srcText(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf-8')
}

function money(v: string): number {
  return Number(v.replace(/,/g, ''))
}

/** Every "$N/week" figure in a string, cheapest first. */
function weeklyFigures(text: string): number[] {
  return (text.match(/\$[\d,]+\/week/g) ?? [])
    .map((m) => money(m.slice(1, -5)))
    .sort((a, b) => a - b)
}

/** The base rate, from whichever tier publishes a plain hourly price. */
function parseBaseRate(v: unknown): number | null {
  const j = asRecord(v)
  if (!j || !Array.isArray(j.tiers)) return null
  for (const t of j.tiers) {
    const tier = asRecord(t)
    const m = tier && /^\$([\d,]+)\/hr$/.exec(String(tier.price ?? ''))
    if (m) return money(m[1])
  }
  return null
}

/** The retainer rungs, parsed out of the inline literal in RetainersPage.tsx. */
function parseLadder(source: string): LadderRung[] {
  const rungs: LadderRung[] = []
  // Collapsed so the regexes do not depend on how prettier wraps the literal.
  for (const chunk of source.replace(/\s+/g, ' ').split("tier: '").slice(1)) {
    const price = /price: '\$([\d,]+)\/week · (\d+) hrs\/week'/.exec(chunk)
    const rate = /\$([\d,]+)\/hr effective, (\d+)% off the \$([\d,]+) base rate/.exec(chunk)
    if (!price || !rate) continue
    rungs.push({
      tier: chunk.slice(0, chunk.indexOf("'")),
      weekly: money(price[1]),
      hours: Number(price[2]),
      statedRate: money(rate[1]),
      statedDiscountPct: Number(rate[2]),
      statedBase: money(rate[3]),
    })
  }
  return rungs
}

/** Each rung must be arithmetically honest and cheaper than the one below it. */
export function validateRateLadder(pricing: unknown, retainersSource: string): Problems {
  const p: Problems = []
  const base = parseBaseRate(pricing)
  if (base === null) return ['ladder: no tier in pricing.json publishes a plain "$N/hr" base rate']

  const rungs = parseLadder(retainersSource)
  if (rungs.length === 0) return [`ladder: parsed no retainer rungs out of ${RETAINERS_PAGE}`]

  for (const r of rungs) {
    const effective = r.weekly / r.hours
    if (effective !== r.statedRate) {
      p.push(
        `ladder: ${r.tier} bills $${r.weekly}/week for ${r.hours} hrs, i.e. $${effective.toFixed(2)}/hr, but its card claims $${r.statedRate}/hr`,
      )
    }
    if (r.statedBase !== base) {
      p.push(`ladder: ${r.tier} cites a $${r.statedBase} base rate; pricing.json publishes $${base}`)
    }
    if (effective >= base) {
      p.push(
        `ladder: ${r.tier} costs $${effective.toFixed(2)}/hr against a $${base}/hr base, so the bulk tier is not a discount`,
      )
    }
    const discount = Math.round((1 - effective / base) * 100)
    if (discount !== r.statedDiscountPct) {
      p.push(`ladder: ${r.tier} is ${discount}% off the base, but its card claims ${r.statedDiscountPct}%`)
    }
  }

  const byHours = [...rungs].sort((a, b) => a.hours - b.hours)
  for (let i = 1; i < byHours.length; i += 1) {
    const prev = byHours[i - 1]
    const cur = byHours[i]
    if (cur.weekly / cur.hours >= prev.weekly / prev.hours) {
      p.push(
        `ladder: ${cur.tier} (${cur.hours} hrs) is not cheaper per hour than ${prev.tier} (${prev.hours} hrs); the discount must deepen as capacity grows`,
      )
    }
  }
  return p
}

/** pricing.json restates the retainer rates in prose; it must agree with the page. */
export function validateRetainerCrossReference(pricing: unknown, retainersSource: string): Problems {
  const p: Problems = []
  const weeklies = parseLadder(retainersSource).map((r) => r.weekly).sort((a, b) => a - b)
  if (weeklies.length === 0) return [`ladder: parsed no retainer rungs out of ${RETAINERS_PAGE}`]

  const j = asRecord(pricing)
  const tiers = Array.isArray(j?.tiers) ? j.tiers : []
  const aggregate = tiers
    .map(asRecord)
    .find((t) => t !== null && /Starting at/.test(String(t.price ?? '')))
  if (!aggregate) return ['ladder: no tier in pricing.json quotes a "Starting at" retainer price']

  const start = /Starting at \$([\d,]+)\/week/.exec(String(aggregate.price ?? ''))
  if (!start) {
    p.push('ladder: the aggregate retainer price does not quote "Starting at $N/week"')
  } else if (money(start[1]) !== weeklies[0]) {
    p.push(
      `ladder: pricing.json starts retainers at $${money(start[1])}/week; the cheapest tier in ${RETAINERS_PAGE} is $${weeklies[0]}/week`,
    )
  }

  const quoted = weeklyFigures(String(aggregate.description ?? ''))
  if (quoted.join('/') !== weeklies.join('/')) {
    p.push(
      `ladder: pricing.json's retainer prose quotes ${quoted.join('/')} per week; ${RETAINERS_PAGE} publishes ${weeklies.join('/')}`,
    )
  }
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

describe('contract F: the bulk ladder is a real discount', () => {
  const pricing = parsed('pricing.json')
  const retainers = srcText(RETAINERS_PAGE)

  it('every retainer tier bills below the base rate and deepens with capacity', () => {
    expect(validateRateLadder(pricing, retainers)).toEqual([])
  })

  it('pricing.json and the retainers page quote the same weekly prices', () => {
    expect(validateRetainerCrossReference(pricing, retainers)).toEqual([])
  })

  it('parses the shipped ladder rather than silently matching nothing', () => {
    // Without this, a renamed field or reformatted literal would make every
    // assertion above vacuously true against an empty rung list.
    const rungs = parseLadder(retainers)
    expect(rungs.length).toBe(3)
    expect(parseBaseRate(pricing)).toBeGreaterThan(0)
    for (const r of rungs) expect(r.hours).toBeGreaterThan(0)
  })
})

describe('contract F negative controls: the ladder guard actually bites', () => {
  const BASE = { tiers: [{ price: '$100/hr' }, { price: 'Flexible · Starting at $640/week' }] }

  /** One inline tier in the shape RetainersPage.tsx authors them. */
  function rung(tier: string, weekly: string, hours: number, rate: string, pct: number): string {
    return `
      tier: '${tier}',
      price: '$${weekly}/week · ${hours} hrs/week',
      features: [
        '${hours} hrs/week of hands-on work',
        '$${rate}/hr effective, ${pct}% off the $100 base rate'
      ],`
  }

  const HONEST = rung('Starter', '640', 8, '80', 20) + rung('Premium', '1,200', 24, '50', 50)

  it('accepts the honest ladder, so the failures below are the guard and not the fixture', () => {
    expect(validateRateLadder(BASE, HONEST)).toEqual([])
  })

  it('catches a bulk tier that costs MORE per hour than the base (the 2026-07 defect)', () => {
    // The shipped shape of the old defect: the top retainer billed $3,000/week
    // for ~24 hrs, i.e. $125/hr, while claiming to be the deepest discount.
    const source = rung('Starter', '640', 8, '80', 20) + rung('Premium', '3,000', 24, '125', 0)
    expect(validateRateLadder(BASE, source)).toContainEqual(
      expect.stringContaining('so the bulk tier is not a discount'),
    )
  })

  it('catches a discount that stops deepening as capacity grows', () => {
    const source = rung('Starter', '400', 8, '50', 50) + rung('Premium', '1,440', 24, '60', 40)
    expect(validateRateLadder(BASE, source)).toContainEqual(
      expect.stringContaining('the discount must deepen as capacity grows'),
    )
  })

  it('catches a card whose stated rate disagrees with its own arithmetic', () => {
    expect(validateRateLadder(BASE, rung('Starter', '640', 8, '45', 20))).toContainEqual(
      expect.stringContaining('but its card claims $45/hr'),
    )
  })

  it('catches a stated discount percentage that does not follow from the rates', () => {
    expect(validateRateLadder(BASE, rung('Starter', '640', 8, '80', 10))).toContainEqual(
      expect.stringContaining('but its card claims 10%'),
    )
  })

  it('catches a card citing a base rate the pricing page does not publish', () => {
    const stale = rung('Starter', '360', 8, '45', 10).replace('$100 base', '$50 base')
    expect(validateRateLadder(BASE, stale)).toContainEqual(
      expect.stringContaining('cites a $50 base rate; pricing.json publishes $100'),
    )
  })

  it('catches the two sources drifting apart on the weekly prices', () => {
    expect(validateRetainerCrossReference(BASE, HONEST)).toContainEqual(
      expect.stringContaining("pricing.json's retainer prose quotes"),
    )
    const agreeing = {
      tiers: [
        { price: '$100/hr' },
        {
          price: 'Flexible · Starting at $640/week',
          description: 'Starter ($640/week) or Premium ($1,200/week).',
        },
      ],
    }
    expect(validateRetainerCrossReference(agreeing, HONEST)).toEqual([])
  })

  it('catches a starting price that is not the cheapest tier', () => {
    const wrongStart = {
      tiers: [
        { price: '$100/hr' },
        {
          price: 'Flexible · Starting at $1,200/week',
          description: 'Starter ($640/week) or Premium ($1,200/week).',
        },
      ],
    }
    expect(validateRetainerCrossReference(wrongStart, HONEST)).toContainEqual(
      expect.stringContaining('starts retainers at $1200/week'),
    )
  })
})
