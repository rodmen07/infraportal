/**
 * Content-keyed analytics-effect guard (v1.23.3, ROADMAP decision D-13;
 * closes CONTENT-SETTLE-2 via its second branch).
 *
 * WHAT WENT WRONG (ANALYTICS-PHANTOM-1, QA 2026-08-01). Every content hook
 * returns its default synchronously and the payload one microtask later. A
 * consumer `useEffect` keyed on the content value alone therefore runs TWICE
 * per visit - once over the empty default, once over the real payload - and
 * when that effect reports analytics, every visit double-counts and half the
 * records describe the placeholder. `PricingPage` shipped exactly that shape
 * and was fixed by keying on the hook's `settled` bit (PR #118).
 *
 * WHY A GUARD (L-003): the fix closed one instance; nothing stopped the NEXT
 * consumer from keying an impression or a page-view on `useSiteContent`,
 * `useHomeSectionsContent`, `useCaseStudiesContent` or `useServicesContent` -
 * none of which even HAS a settled bit (deliberately: a flag no consumer
 * reads is dead surface). This guard fails the build the moment a
 * `useEffect` anywhere in `src/**` calls `trackPortfolioEvent` while keyed
 * ONLY on content-hook values with no settle gate, which is the phantom shape.
 * The two sources it reads (L-003): the hook modules themselves (the hook
 * vocabulary is DISCOVERED from source, L-031, so a new content hook is
 * covered the day it is added) and every non-test consumer source.
 *
 * Contract C is the executable control (L-001): the guard must redden on a
 * fixture reproducing the exact pre-#118 `PricingPage` wiring. Contract D
 * proves the shipped, fixed wiring passes, so the guard cannot be satisfied
 * by rejecting everything (L-034: the finding's CONTENT is asserted, not its
 * mere existence).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

/** Every `.ts`/`.tsx` file under `src/`, excluding test files (the
 * conversionInstrumentation.test.ts walk; glob-discovered per L-031). */
function sourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...sourceFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found
}

/** Hook-definition modules, discovered by shape rather than hand-listed. */
function contentHookFiles(files: string[]): string[] {
  return files.filter(rel => /use[A-Z]\w*Content\.tsx?$/.test(rel))
}

/** Exported content-hook names, parsed from the discovered module sources. */
function contentHookNames(files: string[]): string[] {
  const names: string[] = []
  for (const rel of contentHookFiles(files)) {
    for (const m of read(rel).matchAll(/export function (use[A-Z]\w*Content)\(/g)) {
      names.push(m[1])
    }
  }
  return names
}

interface Bindings {
  /** Bare local names bound to content VALUES (destructured, not `settled`). */
  contentValues: Set<string>
  /** Bare local names bound to a hook's `settled` bit. */
  settleFlags: Set<string>
  /** Local names holding a hook's whole result object. */
  wholeObjects: Set<string>
}

function contentBindings(source: string, hookNames: readonly string[]): Bindings {
  const bindings: Bindings = { contentValues: new Set(), settleFlags: new Set(), wholeObjects: new Set() }
  if (hookNames.length === 0) return bindings
  const alt = hookNames.join('|')

  for (const m of source.matchAll(new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*(?:${alt})\\s*\\(`, 'g'))) {
    for (const rawEntry of m[1].split(',')) {
      const entry = rawEntry.split('=')[0].trim()
      if (!entry) continue
      const [prop, local = prop] = entry.split(':').map(s => s.trim())
      if (prop === 'settled') bindings.settleFlags.add(local)
      else bindings.contentValues.add(local)
    }
  }
  for (const m of source.matchAll(new RegExp(`const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:${alt})\\s*\\(`, 'g'))) {
    bindings.wholeObjects.add(m[1])
  }
  return bindings
}

/** The full argument span of every `useEffect(...)` call, extracted with a
 * string- and line-comment-aware depth scan so a paren inside a label or a
 * comment cannot truncate the span. */
function effectSpans(source: string): string[] {
  const spans: string[] = []
  const re = /useEffect\s*\(/g
  while (re.exec(source) !== null) {
    const start = re.lastIndex
    let depth = 1
    let i = start
    while (i < source.length && depth > 0) {
      const ch = source[i]
      if (ch === "'" || ch === '"' || ch === '`') {
        i++
        while (i < source.length && source[i] !== ch) {
          if (source[i] === '\\') i++
          i++
        }
      } else if (ch === '/' && source[i + 1] === '/') {
        while (i < source.length && source[i] !== '\n') i++
      } else if (ch === '(' || ch === '[' || ch === '{') depth++
      else if (ch === ')' || ch === ']' || ch === '}') depth--
      i++
    }
    spans.push(source.slice(start, i - 1))
  }
  return spans
}

interface Finding {
  /** The dependency list of the offending effect, verbatim. */
  deps: string[]
}

/** True when `dep` is a content VALUE: a destructured content binding, or a
 * member access off a whole-result binding that is not the `settled` bit. */
function isContentValueDep(dep: string, b: Bindings): boolean {
  if (b.contentValues.has(dep)) return true
  const dot = dep.indexOf('.')
  if (dot > 0) {
    const obj = dep.slice(0, dot)
    const prop = dep.slice(dot + 1)
    if (b.wholeObjects.has(obj)) return prop !== 'settled'
  }
  return false
}

/**
 * The phantom shape: a `useEffect` that calls `trackPortfolioEvent` while
 * EVERY dependency is a content-hook value. Any non-content dependency - the
 * `settled` bit above all - exempts the effect, as does an empty list (a
 * mount event fires once regardless of when content lands).
 */
function findContentKeyedTrackingEffects(source: string, hookNames: readonly string[]): Finding[] {
  const bindings = contentBindings(source, hookNames)
  if (bindings.contentValues.size === 0 && bindings.wholeObjects.size === 0) return []

  const findings: Finding[] = []
  for (const span of effectSpans(source)) {
    if (!span.includes('trackPortfolioEvent(')) continue
    const depMatch = /,\s*\[([^\][]*)\]\s*$/.exec(span.trimEnd())
    if (!depMatch) continue
    const deps = depMatch[1].split(',').map(d => d.trim()).filter(Boolean)
    if (deps.length > 0 && deps.every(d => isContentValueDep(d, bindings))) {
      findings.push({ deps })
    }
  }
  return findings
}

const FILES = sourceFiles()
const HOOK_NAMES = contentHookNames(FILES)

describe('contract A: the hook vocabulary is discovered, not hand-listed (L-031)', () => {
  it('discovers at least one content-hook module with at least one exported hook', () => {
    // Zero-match hard failure: a broken walk or a renamed convention must
    // fail loudly here, never scan nothing and report clean.
    expect(contentHookFiles(FILES).length).toBeGreaterThan(0)
    expect(HOOK_NAMES.length).toBeGreaterThan(0)
  })

  it('the discovered vocabulary includes the known sentinels (token presence, not file)', () => {
    expect(HOOK_NAMES).toContain('usePricingContent')
    expect(HOOK_NAMES).toContain('useSiteContent')
  })

  it("the special-cased dependency name 'settled' is the name the pricing hook actually declares", () => {
    // The guard exempts a dep named `settled`; this pins that name to the
    // artifact that defines it, so a rename reddens here instead of silently
    // hollowing out the exemption.
    const pricingModule = contentHookFiles(FILES).find(rel => rel.endsWith('usePricingContent.ts'))
    expect(pricingModule).toBeDefined()
    expect(read(pricingModule!)).toMatch(/settled: boolean/)
  })
})

describe('contract B: no shipped source keys a tracking effect on content alone', () => {
  it('finds zero content-keyed tracking effects across src/**', () => {
    expect(FILES.length, 'the source walk must find files').toBeGreaterThan(0)
    const offenders = FILES.map(rel => ({ rel, findings: findContentKeyedTrackingEffects(read(rel), HOOK_NAMES) })).filter(
      o => o.findings.length > 0,
    )
    expect(
      offenders.map(o => `${o.rel} [${o.findings.map(f => f.deps.join(', ')).join('] [')}]`),
      'a useEffect calling trackPortfolioEvent keyed only on content-hook values re-creates ANALYTICS-PHANTOM-1: ' +
        'key it on the settle bit (the PricingPage shape) or hoist the call into a handler',
    ).toEqual([])
  })
})

// The exact pre-#118 PricingPage wiring: the hook read the old way, the
// effect keyed on the content value alone. This is the executable control
// D-13 demands - the guard must REDDEN on it.
const PRE_118_PRICING_WIRING = `
import { useEffect } from 'react'
import { usePricingContent } from '../features/consulting/usePricingContent'
import { trackPortfolioEvent } from '../utils/analytics'
export function PricingPage() {
  const baseUrl = '/'
  const { note, tiers } = usePricingContent(baseUrl)
  useEffect(() => {
    trackPortfolioEvent('pricing_page_view', {
      tier_count: tiers.length,
      has_retainer_link: tiers.some(t => t.tier === 'Retainer'),
    })
  }, [tiers])
  return null
}
`

// The shipped, fixed wiring: the settle bit gates the same effect.
const FIXED_PRICING_WIRING = PRE_118_PRICING_WIRING.replace('const { note, tiers }', 'const { note, tiers, settled }')
  .replace('useEffect(() => {', 'useEffect(() => {\n    if (!settled) return')
  .replace('}, [tiers])', '}, [settled, tiers])')

describe('contract C: the pre-#118 wiring reddens (the executable control, L-001)', () => {
  it('flags the destructured phantom shape, naming its dependency', () => {
    const findings = findContentKeyedTrackingEffects(PRE_118_PRICING_WIRING, HOOK_NAMES)
    expect(findings).toEqual([{ deps: ['tiers'] }])
  })

  it('flags the whole-object phantom shape (the App.tsx binding style)', () => {
    const source = `
const pricing = usePricingContent(baseUrl)
useEffect(() => {
  trackPortfolioEvent('x', { n: pricing.tiers.length })
}, [pricing.tiers])
`
    expect(findContentKeyedTrackingEffects(source, HOOK_NAMES)).toEqual([{ deps: ['pricing.tiers'] }])
  })
})

describe('contract D: legitimate shapes pass, so the guard is not rejecting everything', () => {
  it('accepts the shipped fix: a settle-gated effect', () => {
    // Sanity-check the fixture surgery actually produced the fixed shape.
    expect(FIXED_PRICING_WIRING).toContain('}, [settled, tiers])')
    expect(findContentKeyedTrackingEffects(FIXED_PRICING_WIRING, HOOK_NAMES)).toEqual([])
  })

  it('accepts a settle-gated whole-object effect', () => {
    const source = `
const pricing = usePricingContent(baseUrl)
useEffect(() => {
  trackPortfolioEvent('x', { n: pricing.tiers.length })
}, [pricing.settled, pricing.tiers])
`
    expect(findContentKeyedTrackingEffects(source, HOOK_NAMES)).toEqual([])
  })

  it('accepts a mount event (empty deps), the CheckoutThankYouPage shape', () => {
    const source = `
const { tiers } = usePricingContent(baseUrl)
useEffect(() => {
  trackPortfolioEvent('landed', {})
}, [])
`
    expect(findContentKeyedTrackingEffects(source, HOOK_NAMES)).toEqual([])
  })

  it('ignores effects that do not track, whatever they key on', () => {
    const source = `
const { tiers } = usePricingContent(baseUrl)
useEffect(() => {
  document.title = String(tiers.length)
}, [tiers])
`
    expect(findContentKeyedTrackingEffects(source, HOOK_NAMES)).toEqual([])
  })
})
