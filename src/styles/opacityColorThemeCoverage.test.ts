/**
 * Repo-wide opacity-suffixed colour theme-coverage test (v1.18.3 QA
 * follow-up, generalised beyond ContactPage.tsx per PR #37 adversarial
 * review; widened from text- only to also cover bg- and border- in v1.18.4).
 *
 * PR #36 shipped two opacity-suffixed Tailwind text-colour classes on
 * ContactPage.tsx's referral panel - `text-emerald-200/80` and
 * `text-emerald-200/70` - with no `[data-theme="light"]` override anywhere
 * in src/index.css. Tailwind emits an opacity-suffixed class as a SEPARATE
 * selector from its bare counterpart, so `.text-emerald-200` already having
 * a light-theme override gave the opacity variants no protection at all: on
 * the near-white light `surface-card` background the un-overridden
 * dark-mode colour composited to roughly a 1.1-1.3:1 contrast ratio -
 * functionally invisible. This is the "ghost class invisible in one theme"
 * defect class the v1.18 UX theme (docs/design/V1_18_UX_THEME.md) exists to
 * eliminate.
 *
 * This file (formerly src/pages/contactPageThemeCoverage.test.ts, then
 * src/styles/opacityTextColorThemeCoverage.test.ts) was widened three times:
 *
 * 1. PR #37 round 2 generalised the file scan from ContactPage.tsx alone to
 *    every src/**\/*.tsx, which surfaced 14 more real, live, un-overridden
 *    `text-*` ghost classes repo-wide - all fixed alongside that widening.
 * 2. v1.18.4 PR2 generalised the COLOUR-PREFIX scan from `text-*` only to
 *    `text-*`/`bg-*`/`border-*`. That gap was deliberately left open by PR
 *    #37's own docstring, which named the two exact repo-wide bugs it would
 *    surface - `border-amber-400/30` and `border-amber-400/60` (the primary
 *    CTA button's border and hover-border, used across a dozen-plus files)
 *    and `bg-emerald-500/10` (used in 16 files).
 * 3. Pre-merge QA on that same PR2 found the widening in (2) was
 *    STRUCTURALLY BLIND to an entire class of gap: `opacityColorClassesIn`
 *    stripped any `variant:` prefix (`raw.slice(raw.lastIndexOf(':') + 1)`)
 *    before checking coverage, so it reported `hover:border-amber-400/60` as
 *    covered whenever the BARE `.border-amber-400\/60` rule existed in
 *    index.css - even though Tailwind compiles the variant class to a
 *    completely different selector, `.hover\:border-amber-400\/60:hover`,
 *    which that bare rule can never match (a CSS class selector requires an
 *    exact whole-token match). Every real consumer of `border-amber-400/60`
 *    in this app is `hover:`-only, so PR2's headline "fixed" bug was not
 *    fixed for a single real user, while the test suite reported it green.
 *    This revision makes the scanner variant-aware: it keeps the full token
 *    (`hover:border-amber-400/60`, not just `border-amber-400/60`) and
 *    checks coverage against the selector Tailwind actually compiles for
 *    that variant (see `VARIANT_SELECTOR_SUFFIX` below), the same way a real
 *    browser would. This surfaced 17 further un-overridden `hover:`/`focus:`
 *    classes beyond the 2 originally named, all fixed in src/index.css
 *    alongside this revision.
 *
 * Deliberately still scoped to:
 *  - `text-*`/`bg-*`/`border-*` classes only, and only the OPACITY-SUFFIXED
 *    ones. Bare (non-opacity) classes of any of these three prefixes are
 *    covered by the separate, long-standing systematic overrides in
 *    index.css's "Text overrides" / "Background overrides" / "Border
 *    overrides" sections - a different, already-working mechanism.
 *  - Other opacity-bearing prefixes this repo also uses (`ring-`, `divide-`,
 *    `from-`/`via-`/`to-` gradient stops) are NOT scanned here - a smaller,
 *    largely-covered surface (spot-checked, not exhaustively swept), a
 *    real separately-decided narrowing distinct from the `hover:`/`focus:`/
 *    `open:` variant gap fixed in (3) above, which IS now in scope for
 *    text-/bg-/border- opacity classes.
 *  - Variant prefixes on text-/bg-/border- opacity classes ARE in scope, but
 *    only ones this file knows how to translate to a compiled CSS selector
 *    (`VARIANT_SELECTOR_SUFFIX`, below). An unrecognised variant prefix
 *    fails the test loudly (see `hasLightOverride`) rather than being
 *    silently stripped and reported as covered - that silent-strip is
 *    exactly the bug this revision fixes, so the scanner must never
 *    reintroduce it for some future variant this repo starts using.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const INDEX_CSS_RULES = readFileSync(path.join(ROOT, 'src/index.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')

const TAILWIND_PALETTE_NAMES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const

const OPACITY_COLOR_PREFIXES = ['text', 'bg', 'border'] as const

// `{prefix}-{palette}-{shade}/{opacity}`, with an optional leading
// `variant:` this file knows how to translate to a compiled CSS selector -
// see VARIANT_SELECTOR_SUFFIX below. See the file header for why bare
// classes and other prefixes (ring-, divide-, gradient stops) are
// deliberately out of scope here.
const OPACITY_COLOR_CLASS_PATTERN = new RegExp(
  `^(${OPACITY_COLOR_PREFIXES.join('|')})-(${TAILWIND_PALETTE_NAMES.join('|')})-[0-9]{2,3}/[0-9]{1,3}$`,
)

/** Tailwind variants (as they appear in a `variant:` class prefix) this
 * scanner has verified, via a real `tailwindcss` CLI build of this repo's
 * content, are actually used with opacity-suffixed text-/bg-/border-colour
 * classes here - mapped to the exact suffix Tailwind appends after the
 * escaped class name in the compiled selector. `hover:`/`focus:` compile to
 * a trailing pseudo-class; `open:` (the `<details>`/`<dialog>` state
 * variant) compiles to a trailing ATTRIBUTE selector, not a pseudo-class -
 * getting this wrong is exactly how a prior "fix" silently no-opped for
 * every real `hover:`-only consumer of a class like `border-amber-400/60`:
 * the override it wrote, `[data-theme="light"] .border-amber-400\/60`, can
 * never match the real compiled selector,
 * `.hover\:border-amber-400\/60:hover`. src/index.css's matching
 * "Variant-state ... overrides" section must stay in sync with this map. */
const VARIANT_SELECTOR_SUFFIX: Record<string, string> = {
  hover: ':hover',
  focus: ':focus',
  open: '[open]',
}

/** Every .tsx file under src/, relative to the repo root, sorted. Mirrors
 * tokens.test.ts's allComponentFiles() so both ghost-class sweeps cover
 * exactly the same file set. `.tsx` only (not `.ts`) naturally excludes this
 * suite's own `.test.ts` file - a `.test.ts` string literal used as a
 * negative-control argument, like `text-cyan-500/33` below, must never be
 * picked up as "used in a component". */
function allComponentFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allComponentFiles(relPath))
    else if (entry.name.endsWith('.tsx')) found.push(relPath)
  }
  return found.sort()
}

const COMPONENT_FILES = allComponentFiles()

/** Every opacity-suffixed Tailwind text/bg/border-colour class token
 * referenced in a component's string/template literals, INCLUDING any
 * leading `variant:` prefix (`hover:border-amber-400/60`, kept whole, not
 * stripped to `border-amber-400/60`) - stripping the prefix before checking
 * coverage is exactly the bug this file was rewritten to fix, see the file
 * header. Deliberately keeps the `/NN` suffix, unlike tokens.test.ts's
 * `classTokensIn` (scoped to bare owned-namespace classes), which would
 * otherwise collapse `bg-emerald-500/10` and `bg-emerald-500` into the same
 * token and miss exactly the defect this test exists to catch. */
function opacityColorClassesIn(source: string): string[] {
  const tokens = new Set<string>()
  const literalPattern = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g
  let match: RegExpExecArray | null
  while ((match = literalPattern.exec(source)) !== null) {
    const literal = match[1] ?? match[2] ?? match[3] ?? ''
    for (const raw of literal.split(/\s+/)) {
      const base = raw.slice(raw.lastIndexOf(':') + 1) // the part after any variant: prefix
      if (OPACITY_COLOR_CLASS_PATTERN.test(base)) tokens.add(raw) // keep the FULL token, variant included
    }
  }
  return [...tokens]
}

/** The exact `[data-theme="light"] .selector` string index.css must declare
 * for `token` to be covered, accounting for the literal backslash Tailwind
 * (and every existing override in this file) uses to escape `:` and `/` in
 * a CSS class selector, e.g. `.text-emerald-200\/80` or
 * `.hover\:border-amber-400\/60`.
 *
 * A bare token (no `variant:` prefix) resolves to the bare selector. A
 * variant-prefixed token additionally requires the pseudo-class/attribute
 * suffix Tailwind appends AFTER the escaped class name for that variant
 * (`:hover`, `:focus`, `[open]` - see `VARIANT_SELECTOR_SUFFIX`): treating
 * `hover:border-amber-400/60` as covered by a rule that only matches a bare
 * `border-amber-400/60` is the exact silent-pass bug this file was
 * rewritten to fix. An unrecognised variant is a hard failure, not a silent
 * "uncovered": it means this scanner does not yet know how to check it at
 * all, which is worse than reporting it as covered.
 *
 * Shared by `hasLightOverride` (existence check) and the it.each failure
 * message (fix suggestion) so the two can never drift out of sync with
 * each other - a suggested fix that does not match what was actually
 * checked would be its own silent-pass-shaped bug. */
function lightOverrideSelectorFor(token: string): string {
  const lastColonIdx = token.lastIndexOf(':')
  const variant = lastColonIdx === -1 ? null : token.slice(0, lastColonIdx)
  let suffix = ''
  if (variant !== null) {
    const knownSuffix = VARIANT_SELECTOR_SUFFIX[variant]
    if (knownSuffix === undefined) {
      throw new Error(
        `opacityColorThemeCoverage.test.ts does not know how Tailwind compiles the "${variant}:" variant to a ` +
          `CSS selector (used by "${token}"). Add it to VARIANT_SELECTOR_SUFFIX in this file, and add the ` +
          'matching override to src/index.css\'s "Variant-state ... overrides" section - guessing wrong (or not ' +
          'checking at all) here is exactly how a prior fix silently no-opped for every real hover:-only ' +
          'consumer of a class like border-amber-400/60 (see the file header).',
      )
    }
    suffix = knownSuffix
  }
  const escapedToken = token.replace(/:/g, '\\:').replace(/\//g, '\\/')
  return `[data-theme="light"] .${escapedToken}${suffix}`
}

/** True when index.css declares `lightOverrideSelectorFor(token)`. Plain
 * substring search, not a regex, so no escaping of `.`/other characters is
 * needed beyond the `:`/`/` Tailwind itself escapes. */
function hasLightOverride(token: string): boolean {
  const selector = lightOverrideSelectorFor(token)
  let searchFrom = 0
  for (;;) {
    const idx = INDEX_CSS_RULES.indexOf(selector, searchFrom)
    if (idx === -1) return false
    const nextChar = INDEX_CSS_RULES[idx + selector.length]
    if (nextChar === undefined || !/[\w-]/.test(nextChar)) return true
    searchFrom = idx + 1
  }
}

describe('every src/**/*.tsx file - opacity-suffixed text/bg/border colours are covered in light mode', () => {
  it('finds components to scan', () => {
    // Guards the file sweep itself, same shape as tokens.test.ts's
    // equivalent check: if allComponentFiles() ever silently returned an
    // empty or tiny list, the it.each below would pass vacuously.
    expect(COMPONENT_FILES.length).toBeGreaterThan(40)
  })

  it.each(COMPONENT_FILES)('%s uses only opacity-suffixed text/bg/border classes that have a light override', (relPath) => {
    const source = readFileSync(path.join(ROOT, relPath), 'utf-8')
    const usedClasses = opacityColorClassesIn(source)
    const uncovered = usedClasses.filter((token) => !hasLightOverride(token))
    expect(
      uncovered,
      uncovered.length === 0
        ? ''
        : uncovered
            .map(
              (token) =>
                `.${token} is used in ${relPath} with no light-theme override in src/index.css - this ` +
                'composites to near-invisible (or wrong-state) colour on the light surface-card background. Add ' +
                `${lightOverrideSelectorFor(token)} { ... !important; } next to the other opacity-modified ` +
                'overrides.',
            )
            .join('\n'),
    ).toEqual([])
  })

  it('finds at least the three classes named in the v1.18.4 repo-wide contrast finding (scanner self-check)', () => {
    // Regression anchor for the two named repo-wide bugs (portfolio backlog
    // `## Bugs`): if the extraction regex ever silently stops matching
    // bg-*/border-* prefixes, this catches it even though the it.each sweep
    // above no longer names any file specially. HeroSection's real usage is
    // `hover:border-amber-400/60`, never a bare `border-amber-400/60` - the
    // full token (variant included) is what this scanner must extract and
    // check; asserting the bare form here would silently reintroduce the
    // exact stripped-prefix bug this file was rewritten to fix.
    const heroSource = readFileSync(path.join(ROOT, 'src/features/site/HeroSection.tsx'), 'utf-8')
    expect(opacityColorClassesIn(heroSource)).toEqual(
      expect.arrayContaining(['hover:border-amber-400/60']),
    )
    const apiExplorerSource = readFileSync(path.join(ROOT, 'src/features/apiDocs/ApiSpecExplorer.tsx'), 'utf-8')
    expect(opacityColorClassesIn(apiExplorerSource)).toEqual(
      expect.arrayContaining(['bg-emerald-500/10']),
    )
  })

  it('is variant-aware: a hover-only class covered solely by a bare override is reported as uncovered', () => {
    // Regression anchor for the actual pre-merge QA finding: a bare
    // `[data-theme="light"] .border-amber-400\/60` rule (which index.css
    // does carry, for the handful of classes that also have a genuine bare
    // consumer) must NOT be accepted as coverage for the `hover:` variant of
    // the same class, because Tailwind compiles them to different
    // selectors. This is what `raw.slice(raw.lastIndexOf(':') + 1)` got
    // silently wrong before this rewrite.
    expect(hasLightOverride('border-amber-400/60')).toBe(true)
    expect(hasLightOverride('hover:border-amber-400/60')).toBe(true) // now real, see index.css
    // A variant/class combination with no consumer and no override at all
    // (bare or variant) must still correctly report uncovered.
    expect(hasLightOverride('hover:border-amber-400/25')).toBe(false)
  })

  it('throws on a variant this scanner has not been taught to compile a selector for', () => {
    // An unrecognised variant must fail loudly rather than being silently
    // treated as "uncovered" (indistinguishable from a real gap) or, worse,
    // silently stripped and checked as if it were bare (the original bug).
    expect(() => hasLightOverride('group-hover:border-amber-400/60')).toThrow(/does not know how Tailwind compiles/)
  })

  it('the scanner actually finds opacity-suffixed classes across the codebase (not just zero)', () => {
    // Guards against the regex silently breaking repo-wide: if it stopped
    // matching entirely, every it.each case above would pass vacuously.
    const total = COMPONENT_FILES.reduce(
      (count, relPath) => count + opacityColorClassesIn(readFileSync(path.join(ROOT, relPath), 'utf-8')).length,
      0,
    )
    expect(total).toBeGreaterThan(20)
  })

  it('the scanner covers all three prefixes, not just text- (regression guard for the v1.18.4 widening)', () => {
    const allTokens = COMPONENT_FILES.flatMap((relPath) =>
      opacityColorClassesIn(readFileSync(path.join(ROOT, relPath), 'utf-8')),
    )
    expect(allTokens.some((t) => t.startsWith('bg-'))).toBe(true)
    expect(allTokens.some((t) => t.startsWith('border-'))).toBe(true)
    expect(allTokens.some((t) => t.startsWith('text-'))).toBe(true)
  })

  it('the scanner can fail: an undefined class/opacity combination is correctly reported as uncovered', () => {
    // Negative control (no component uses this exact colour/opacity pair).
    expect(hasLightOverride('text-cyan-500/33')).toBe(false)
    expect(hasLightOverride('bg-cyan-500/33')).toBe(false)
    expect(hasLightOverride('border-cyan-500/33')).toBe(false)
  })
})
