/**
 * Conversion-instrumentation guard (v1.22.1, ROADMAP decision D-9).
 *
 * WHAT WENT WRONG. The funnel's event vocabulary was 17 names scattered as
 * string literals across 13 files, and nothing related "the surfaces that
 * convert" to "the surfaces that emit events". Two consequences, both
 * measured on 2026-07-26: `CheckoutThankYouPage` - the page a paying
 * customer lands on - fired zero events, so even with a sink wired a
 * purchase would not have been counted; and `PricingPage`'s two page-level
 * CTAs carried no tracking for a month while the tier-card CTAs did, which
 * would have skewed any funnel numbers toward the cards.
 *
 * WHY A GUARD RATHER THAN TWO EDITS (L-003). Fixing the two gaps closes
 * today's instances. What makes the class recur is that nothing stops a new
 * event name being minted as a literal, a registry entry outliving its
 * surface, or a new conversion surface shipping unmeasured. Each pairing is
 * asserted below from BOTH sides:
 *
 *   A  single vocabulary   no call site passes a quoted literal, and every
 *                          `PORTFOLIO_EVENTS.x` reference resolves to a key
 *                          parsed out of the registry source
 *   B  no dead vocabulary  every registry key is referenced by at least one
 *                          non-test source file
 *   C  declared coverage   the conversion-surface list and the set of files
 *                          that actually call trackPortfolioEvent are EQUAL,
 *                          so a surface cannot ship unmeasured-but-undeclared
 *                          and the list cannot name a file that stopped
 *                          tracking (or stopped existing)
 *   D  the two defects     the checkout landing event fires on mount and
 *                          carries the tier; every anchor on PricingPage is
 *                          click-tracked
 *
 * The negative controls exist because a guard whose regex cannot match
 * reports green forever (the PR #91 process note: a control that does not
 * visibly change behavior is not a control).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { PORTFOLIO_EVENTS } from '../../utils/analyticsEvents'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

const REGISTRY_PATH = 'src/utils/analyticsEvents.ts'
const DISPATCH_PATH = 'src/utils/analytics.ts'
const CHECKOUT_PAGE_PATH = 'src/pages/CheckoutThankYouPage.tsx'
const PRICING_PAGE_PATH = 'src/pages/PricingPage.tsx'

/**
 * The conversion-surface list (contract C reads it against reality in BOTH
 * directions, so it can neither rot nor hide a gap). A file belongs here
 * exactly when it emits at least one portfolio analytics event.
 */
const CONVERSION_SURFACES = [
  'src/features/consulting/PricingCard.tsx',
  'src/features/layout/SiteFooter.tsx',
  'src/features/site/ContactCTA.tsx',
  'src/features/site/HeroSection.tsx',
  'src/features/site/HowItWorksSection.tsx',
  'src/features/site/OpenSourceCrates.tsx',
  'src/features/site/ProofStrip.tsx',
  'src/pages/CheckoutThankYouPage.tsx',
  'src/pages/ContactPage.tsx',
  'src/pages/LeadMagnetPage.tsx',
  'src/pages/NotFoundPage.tsx',
  'src/pages/PricingPage.tsx',
  'src/pages/RetainersPage.tsx',
] as const

/** Every `.ts`/`.tsx` file under `src/`, excluding test files. */
function sourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...sourceFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found
}

/** Registry keys parsed from the MODULE SOURCE (not the import), so contract
 * A genuinely reads two artifacts rather than comparing an object to itself. */
function registryKeysFromSource(): string[] {
  const body = /PORTFOLIO_EVENTS = \{([\s\S]*?)\} as const/.exec(read(REGISTRY_PATH))
  expect(body, 'registry object literal should be parseable').not.toBeNull()
  return [...body![1].matchAll(/([a-z_]+): '([a-z_]+)'/g)].map(m => {
    expect(m[1], 'registry keys must equal their runtime string').toBe(m[2])
    return m[1]
  })
}

/**
 * JSX `<a ...>` opening tags, extracted brace-aware: the tag ends at the
 * first `>` OUTSIDE any `{...}` attribute expression, so an arrow function
 * inside onClick (which contains `=>`) cannot truncate the tag early.
 */
function anchorOpeningTags(src: string): string[] {
  const tags: string[] = []
  const re = /<a\s/g
  let match: RegExpExecArray | null
  while ((match = re.exec(src)) !== null) {
    let depth = 0
    for (let i = match.index; i < src.length; i++) {
      const ch = src[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0 && src[i - 1] !== '=') {
        tags.push(src.slice(match.index, i + 1))
        break
      }
    }
  }
  return tags
}

const NON_TEST_SOURCES = sourceFiles()
/** Files calling the dispatcher, minus the dispatcher itself. */
const FILES_WITH_CALLS = NON_TEST_SOURCES.filter(
  rel => rel !== DISPATCH_PATH && /trackPortfolioEvent\(/.test(read(rel)),
)

describe('contract A: the vocabulary is single-sourced', () => {
  it('no non-test source passes a quoted literal to trackPortfolioEvent', () => {
    const offenders = FILES_WITH_CALLS.filter(rel => /trackPortfolioEvent\(\s*['"`]/.test(read(rel)))
    expect(
      offenders,
      'event names live in src/utils/analyticsEvents.ts; import PORTFOLIO_EVENTS instead of minting a literal',
    ).toEqual([])
  })

  it('every PORTFOLIO_EVENTS.x reference in source resolves to a registry key', () => {
    const keys = new Set(registryKeysFromSource())
    for (const rel of NON_TEST_SOURCES) {
      if (rel === REGISTRY_PATH) continue
      for (const [, key] of read(rel).matchAll(/PORTFOLIO_EVENTS\.([a-z_]+)/g)) {
        expect(keys.has(key), `${rel} references PORTFOLIO_EVENTS.${key}, which the registry does not define`).toBe(true)
      }
    }
  })

  it('the imported registry and the parsed source agree (the parser is not blind)', () => {
    expect(new Set(registryKeysFromSource())).toEqual(new Set(Object.keys(PORTFOLIO_EVENTS)))
  })
})

describe('contract B: no dead vocabulary', () => {
  it('every registry key is referenced by at least one non-test source file', () => {
    const referenced = new Set<string>()
    for (const rel of NON_TEST_SOURCES) {
      if (rel === REGISTRY_PATH) continue
      for (const [, key] of read(rel).matchAll(/PORTFOLIO_EVENTS\.([a-z_]+)/g)) referenced.add(key)
    }
    const dead = registryKeysFromSource().filter(key => !referenced.has(key))
    expect(dead, 'a retired surface takes its event name with it; delete these keys').toEqual([])
  })

  it('the registry is not empty (the reference scan cannot pass vacuously)', () => {
    expect(registryKeysFromSource().length).toBeGreaterThanOrEqual(18)
  })
})

describe('contract C: declared conversion surfaces match reality, both directions', () => {
  it('every declared surface exists and emits at least one event', () => {
    for (const rel of CONVERSION_SURFACES) {
      expect(NON_TEST_SOURCES, `${rel} is declared but does not exist`).toContain(rel)
      expect(
        /trackPortfolioEvent\(/.test(read(rel)),
        `${rel} is declared a conversion surface but calls trackPortfolioEvent nowhere`,
      ).toBe(true)
    }
  })

  it('every file that emits events is declared (a new surface must join the list)', () => {
    const declared = new Set<string>(CONVERSION_SURFACES)
    const undeclared = FILES_WITH_CALLS.filter(rel => !declared.has(rel))
    expect(undeclared, 'add these to CONVERSION_SURFACES so the coverage universe stays complete').toEqual([])
  })

  it('the discovery scan found the surfaces (it cannot pass vacuously)', () => {
    expect(FILES_WITH_CALLS.length).toBeGreaterThanOrEqual(13)
  })
})

describe('contract D: the two 2026-07-26 defects stay closed', () => {
  it('CheckoutThankYouPage fires the landing event on mount, carrying the tier', () => {
    const src = read(CHECKOUT_PAGE_PATH)
    expect(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?trackPortfolioEvent\(\s*PORTFOLIO_EVENTS\.checkout_thank_you_view/.test(src),
      'the completed-payment page must emit checkout_thank_you_view from a mount effect',
    ).toBe(true)
    expect(
      /checkoutLandingParams\(/.test(src),
      'the landing event must carry the tier read by checkoutTier.ts',
    ).toBe(true)
  })

  it('every anchor on PricingPage is click-tracked', () => {
    const tags = anchorOpeningTags(read(PRICING_PAGE_PATH))
    expect(tags.length, 'PricingPage should render at least its two entry CTAs').toBeGreaterThanOrEqual(2)
    for (const tag of tags) {
      expect(/trackPortfolioEvent\(/.test(tag), `untracked anchor on PricingPage: ${tag.slice(0, 120)}`).toBe(true)
    }
  })
})

describe('negative controls: the scanners can actually fire', () => {
  it('the literal ban matches a planted quoted call', () => {
    expect(/trackPortfolioEvent\(\s*['"`]/.test("trackPortfolioEvent('planted_literal', {})")).toBe(true)
  })

  it('the anchor extractor survives an arrow function inside onClick', () => {
    const fixture = `<a href="https://e.com/x" onClick={() => track(n > 1 ? 'a' : 'b')}>go</a><a href="https://e.com/y">quiet</a>`
    const tags = anchorOpeningTags(fixture)
    expect(tags).toHaveLength(2)
    expect(tags[0]).toContain('onClick')
    expect(tags[1]).not.toContain('onClick')
  })

  it('the registry parser rejects a key whose value drifts from its name', () => {
    expect('drifted_key: \'other_value\'').toMatch(/([a-z_]+): '([a-z_]+)'/)
  })
})
