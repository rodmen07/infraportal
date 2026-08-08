/**
 * Repo-wide colour theme-coverage scanner (v1.26.3, ROADMAP.md D-21/D-22/D-23).
 *
 * Formerly src/pages/contactPageThemeCoverage.test.ts, then
 * src/styles/opacityTextColorThemeCoverage.test.ts, then
 * src/styles/opacityColorThemeCoverage.test.ts. Renamed here because the scope
 * is no longer "opacity-suffixed": bare classes and every colour-bearing prefix
 * are in it now.
 *
 * WHY THIS FILE EXISTS. PR #36 shipped two opacity-suffixed text-colour classes
 * on ContactPage's referral panel with no `[data-theme="light"]` override
 * anywhere in src/index.css. Tailwind emits an opacity-suffixed class as a
 * SEPARATE selector from its bare counterpart, so the bare class already having
 * a light-theme override gave the opacity variants no protection at all: on the
 * near-white light card background the un-overridden dark-mode colour
 * composited to roughly 1.1-1.3:1 - functionally invisible. Every widening
 * since has been the same defect wearing a different prefix.
 *
 * HISTORY OF THE WIDENINGS (each one found real, live, shipped bugs):
 *
 * 1. PR #37 round 2 generalised the file scan from ContactPage alone to every
 *    component, which surfaced 14 more un-overridden text ghost classes.
 * 2. v1.18.4 PR2 generalised the prefix scan from text- only to text-/bg-/
 *    border-, which surfaced the primary CTA button's border and hover-border
 *    and a fill used in 16 files.
 * 3. Pre-merge QA on that PR found the widening was STRUCTURALLY BLIND to
 *    variants: the extractor stripped any `variant:` prefix before checking
 *    coverage, so a hover-only class was reported as covered whenever the BARE
 *    rule existed - even though Tailwind compiles the variant to a completely
 *    different selector that the bare rule can never match. Every real consumer
 *    of that PR's headline "fixed" class was hover-only, so the fix reached
 *    nobody while the suite reported green. The scanner has been variant-aware
 *    ever since, and an unrecognised variant is a HARD FAILURE rather than a
 *    silent pass.
 * 4. v1.26.3 (this revision) widened the scan to BARE classes, to every
 *    colour-bearing prefix, and to non-test `.ts` files - and replaced the
 *    rule-existence criterion with a computed contrast ratio for foregrounds.
 *
 * THE TWO CLAIMS THIS REVISION RETIRES, QUOTED VERBATIM SO THE CORRECTION IS
 * AUDITABLE. Until v1.26.3 this docstring carried a "deliberately still scoped
 * to" section asserting a coverage that did not exist:
 *
 *   "`text-*`/`bg-*`/`border-*` classes only, and only the OPACITY-SUFFIXED
 *    ones. Bare (non-opacity) classes of any of these three prefixes are
 *    covered by the separate, long-standing systematic overrides in index.css's
 *    'Text overrides' / 'Background overrides' / 'Border overrides' sections -
 *    a different, already-working mechanism."
 *
 *   "Other opacity-bearing prefixes this repo also uses (`ring-`, `divide-`,
 *    `from-`/`via-`/`to-` gradient stops) are NOT scanned here - a smaller,
 *    largely-covered surface (spot-checked, not exhaustively swept)."
 *
 * Both were false. Measured 2026-08-08 by running this file's own extraction
 * over the same file set with only the class pattern widened: 42 distinct bare
 * palette utilities were in use with 19 carrying no light override at all
 * (45% uncovered, not "a different, already-working mechanism"), and 31 distinct
 * utilities of the other prefixes were in use with 25 uncovered (81% - largely
 * UNcovered, the opposite of the claim). The live consequence was an invisible
 * `<h3>`: the empty-state heading on the audit page rendered at 1.02:1 in light
 * mode because it used the BARE form of a class, which this scanner could not
 * see. v1.26.1 fixed that heading and its five siblings; this revision is what
 * makes the class unrepresentable rather than fixed one instance at a time.
 *
 * WHAT IS GATED NOW, AND BY WHICH CRITERION. The vocabulary lives in
 * scripts/lib/themeContrast.ts's COLOR_PREFIXES map, not here, so one definition
 * decides what counts as a colour utility and what it is for:
 *
 *   FOREGROUNDS (text-, placeholder-, caret-, decoration-) are gated on a
 *   COMPUTED WCAG CONTRAST RATIO against this repo's own composited light card
 *   fill, at AA for normal text. Bare, opacity-suffixed and variant forms all
 *   count, and there are ZERO exemptions. Rule existence was the old criterion
 *   and it is wrong in both directions: three of this repo's un-overridden
 *   foregrounds clear AA comfortably and need nothing (existence would have
 *   demanded three pointless overrides against a ratchet with no headroom),
 *   while an override that EXISTS but is wrong - a pastel swapped for another
 *   pastel - passes existence and still ships an unreadable heading. A ratio
 *   catches both, which is why replacing existence here is a strengthening
 *   rather than a swap: every foreground the old criterion covered still passes
 *   the new one, and the new one additionally covers every bare form.
 *
 *   HAIRLINES (border-, ring-, outline-, divide-) and FILLS (bg-, gradient
 *   stops, shadow-, fill-, stroke-, accent-) keep the long-standing
 *   RULE-EXISTENCE criterion, unchanged and unweakened, for the opacity-
 *   suffixed forms that have carried it since v1.18.4.
 *
 * WHAT IS DELIBERATELY NOT GATED, WITH THE MEASUREMENT RATHER THAN AN
 * ASSERTION. A blanket 3:1 contrast bar on hairlines was the v1.26 definition's
 * recommended default and it is NOT implemented here, because measuring it
 * falsified it: 72 of this repo's 76 hairline utilities land below 3:1 in light
 * mode, and most of them do so because index.css deliberately overrides them to
 * a faint rgba(0,0,0,0.08-0.16). That is an authored design decision about
 * decorative card hairlines, not 72 bugs, and WCAG's non-text-contrast
 * requirement applies to boundaries that IDENTIFY a control or its state rather
 * than to every rule and divider. Applying the bar as written would have
 * demanded redesigning every border in the app inside a scanner increment. The
 * sub-question that IS a real defect - focus indicators that vanish in light,
 * measured as low as 1.10:1 - is filed separately with its numbers. Choosing
 * the hairline criterion is ROADMAP.md v1.26.4; until it is chosen this file
 * says so instead of pretending the surface is covered.
 *
 * FILLS ARE OUT OF THE CONTRAST CRITERION STRUCTURALLY, not by exemption: a
 * fill has no contrast of its own, its legibility is a property of the
 * foreground sitting on it, and that foreground is gated above.
 */
import { describe, expect, it } from 'vitest'
import {
  AA_NORMAL_TEXT,
  COLOR_PREFIXES,
  type ColorUtility,
  colorUtilitiesIn,
  consumersOf,
  hasLightOverride,
  lightContrastRatio,
  lightOverrideColor,
  lightOverrideSelectorFor,
  paletteColorFor,
  parseColorUtility,
  PALETTE_HUES,
  relativeLuminance,
  SOURCE_ENTRIES,
  SOURCE_FILES,
  surfaceBackdrop,
} from '../../scripts/lib/themeContrast'

/* -------------------------------------------------------------------------
   What is actually on disk. Everything below is quantified over these, so the
   vacuity guards in the first describe are load-bearing, not decoration.
   ------------------------------------------------------------------------- */

/** Every colour utility used anywhere in non-test src, with the files using
 * it. Discovered by scanning, never listed here: a hand list cannot catch a
 * class nobody thought of, which is the entire property this file needs. */
const DISCOVERED = new Map<string, { utility: ColorUtility; files: string[] }>()
for (const { rel, source } of SOURCE_ENTRIES) {
  for (const utility of colorUtilitiesIn(source)) {
    const existing = DISCOVERED.get(utility.token)
    if (existing === undefined) DISCOVERED.set(utility.token, { utility, files: [rel] })
    else existing.files.push(rel)
  }
}

const ALL = [...DISCOVERED.values()].sort((a, b) => a.utility.token.localeCompare(b.utility.token))
const FOREGROUNDS = ALL.filter((e) => e.utility.kind === 'foreground')
const HAIRLINES = ALL.filter((e) => e.utility.kind === 'hairline')
const FILLS = ALL.filter((e) => e.utility.kind === 'fill')

/** The subset the rule-existence criterion has covered since v1.18.4:
 * opacity-suffixed fills and hairlines. Kept exactly as it was so this
 * revision cannot be a quiet narrowing of a shipped gate. */
const EXISTENCE_SCOPE = [...HAIRLINES, ...FILLS].filter(
  (e) => e.utility.alpha !== null && (e.utility.prefix === 'bg' || e.utility.prefix === 'border'),
)

describe('the scanner reads a real repo (L-031 vacuity guards)', () => {
  it('discovers source files, including the non-test .ts registries', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(40)
    // `.tsx` alone was the old file set and it is exactly what hid a live chip
    // fill from every sweep in this repo. If this ever drops to zero the whole
    // widening has silently reverted.
    expect(SOURCE_FILES.filter((rel) => rel.endsWith('.ts')).length).toBeGreaterThan(0)
    // Test files must stay OUT, or a class written as a negative-control
    // argument below would be counted as a component using it.
    expect(SOURCE_FILES.filter((rel) => /\.test\.tsx?$/.test(rel))).toEqual([])
  })

  it('discovers colour utilities of every kind, and prints the counts', () => {
    // The done-when for this slice asks for the discovered counts to be
    // MEASURED by running the scanner rather than transcribed from a document,
    // so it prints them.
    console.log(
      `[colorThemeCoverage] ${SOURCE_FILES.length} source files, ${ALL.length} distinct colour utilities: ` +
        `${FOREGROUNDS.length} foreground (contrast-gated at ${AA_NORMAL_TEXT}:1), ` +
        `${HAIRLINES.length} hairline, ${FILLS.length} fill, ` +
        `${EXISTENCE_SCOPE.length} in the rule-existence scope.`,
    )
    expect(ALL.length).toBeGreaterThan(150)
    expect(FOREGROUNDS.length).toBeGreaterThan(20)
    expect(HAIRLINES.length).toBeGreaterThan(30)
    expect(FILLS.length).toBeGreaterThan(50)
    expect(EXISTENCE_SCOPE.length).toBeGreaterThan(20)
  })

  it('the hue vocabulary comes from the installed tailwindcss, not a hand list', () => {
    // If this ever collapses, every parse below returns null and every it.each
    // sweep passes vacuously while checking nothing.
    expect(PALETTE_HUES.length).toBeGreaterThan(15)
    expect(PALETTE_HUES).toContain('zinc')
    expect(PALETTE_HUES).toContain('amber')
  })

  it('the light card fill it measures against really is light', () => {
    // Catches slicing the wrong `[data-theme]` block out of tokens.css, which
    // otherwise reads as a perfectly plausible run: every token resolves and
    // every ratio comes back high.
    expect(relativeLuminance(surfaceBackdrop('light'))).toBeGreaterThan(0.5)
    expect(relativeLuminance(surfaceBackdrop('dark'))).toBeLessThan(0.1)
  })
})

/* -------------------------------------------------------------------------
   D-22: foregrounds are gated on a measured ratio, with zero exemptions.
   ------------------------------------------------------------------------- */

describe('every foreground colour utility is legible in light mode (D-22)', () => {
  it.each(FOREGROUNDS.map(({ utility, files }) => ({ token: utility.token, files })))(
    '$token clears AA on the light card',
    ({ token, files }) => {
      const ratio = lightContrastRatio(token)
      expect(
        ratio,
        `"${token}" resolves to ${lightOverrideColor(token) ?? paletteColorFor(token)} in light mode and lands at ` +
          `${ratio.toFixed(2)}:1 on the composited light card, below AA's ${AA_NORMAL_TEXT}:1. Used by: ` +
          `${files.join(', ')}. Either migrate those consumers onto a semantic text token (each carries both ` +
          `themes), or add a "${lightOverrideSelectorFor(token)}" rule to src/index.css whose colour clears the ` +
          'bar. Do NOT add an exemption: this scanner has none by design.',
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    },
  )
})

/* -------------------------------------------------------------------------
   The rule-existence criterion, retained unchanged for the surface it has
   guarded since v1.18.4.
   ------------------------------------------------------------------------- */

describe('every opacity-suffixed fill and hairline still has a light override (v1.18.4 gate, retained)', () => {
  it.each(EXISTENCE_SCOPE.map(({ utility, files }) => ({ token: utility.token, files })))(
    '$token has a light-theme override',
    ({ token, files }) => {
      expect(
        hasLightOverride(token),
        `.${token} is used in ${files.join(', ')} with no light-theme override in src/index.css - a dark-authored ` +
          `fill or hairline composites to the wrong thing on the light card. Add ` +
          `"${lightOverrideSelectorFor(token)} { ... !important; }" next to the other overrides.`,
      ).toBe(true)
    },
  )
})

/* -------------------------------------------------------------------------
   The scanner's own machinery.
   ------------------------------------------------------------------------- */

describe('the extractor keeps whole tokens, variants and opacity modifiers included', () => {
  it('keeps a variant prefix rather than stripping it to the bare class', () => {
    // Regression anchor for the pre-merge QA finding in widening (3): the CTA
    // button's hover border is hover-only in every real consumer, and reporting
    // it as covered by the bare rule is the silent-pass bug this file was
    // rewritten to fix. Written as a literal because the class is live, so it
    // cannot leak a dead rule into the bundle.
    const hero = SOURCE_ENTRIES.find((e) => e.rel === 'src/features/site/HeroSection.tsx')
    expect(hero, 'HeroSection.tsx moved; re-point this anchor').toBeDefined()
    expect(colorUtilitiesIn(hero!.source).map((u) => u.token)).toEqual(
      expect.arrayContaining(['hover:border-amber-400/60']),
    )
  })

  it('extracts classes nested inside a template-literal ${...} ternary', () => {
    // The exact shape that once hid three fills and a hairline from this sweep:
    // the classes live inside a nested string literal within a `${...}` ternary
    // of an interpolated className, so whitespace-splitting leaves them with a
    // stray quote attached. Built from parts so no whole class name is written
    // as literal prose for Tailwind's content extractor to resurrect.
    const red = ['border', 'red', '500/60'].join('-')
    const redFill = ['bg', 'red', '500/8'].join('-')
    const ternarySource = 'className={`field-input ${hasError ? ' + `'${red} ${redFill}' : 'border-border-soft'}\`}`
    expect(colorUtilitiesIn(ternarySource).map((u) => u.token)).toEqual(expect.arrayContaining([red, redFill]))
  })

  it('classifies each prefix by what its colour is FOR, from one shared map', () => {
    expect(COLOR_PREFIXES.text.kind).toBe('foreground')
    expect(COLOR_PREFIXES.placeholder.kind).toBe('foreground')
    expect(COLOR_PREFIXES.ring.kind).toBe('hairline')
    expect(COLOR_PREFIXES.divide.kind).toBe('hairline')
    expect(COLOR_PREFIXES.bg.kind).toBe('fill')
    // Every prefix the map declares is reachable by the parser, so a prefix
    // added to the vocabulary can never sit there doing nothing.
    for (const prefix of Object.keys(COLOR_PREFIXES)) {
      const token = [prefix, 'zinc', '500'].join('-')
      expect(parseColorUtility(token), `${prefix} is in COLOR_PREFIXES but does not parse`).not.toBeNull()
    }
  })

  it('does not mistake this repo\'s own semantic tokens for palette utilities', () => {
    // Semantic tokens read as prefix + role + word, never prefix + hue + number,
    // and they carry BOTH themes - flagging them would be a false positive that
    // pushes an implementer toward adding an override that must not exist.
    for (const token of [
      ['text', 'text', 'primary'].join('-'),
      ['bg', 'surface', '1'].join('-'),
      ['border', 'border', 'soft'].join('-'),
      ['text', 'accent', 'text'].join('-'),
    ]) {
      expect(parseColorUtility(token), `${token} is a semantic token, not a palette utility`).toBeNull()
    }
  })

  it('throws on a variant it has not been taught to compile a selector for', () => {
    // An unrecognised variant must fail loudly rather than being treated as
    // "uncovered" (indistinguishable from a real gap) or, worse, silently
    // stripped and checked as if it were bare. Kept exactly as it was.
    //
    // Every piece is assembled at runtime, including the variant name: writing
    // the whole class as prose is what kept a dead `.group:hover
    // .group-hover\:border-amber-400\/60` rule alive in the shipped stylesheet
    // for as long as the previous revision of this file existed
    // (TAILWIND-TESTPROSE-LEAK-1, measured in the built bundle - this revision
    // removes seven such rules).
    const variant = ['group', 'hover'].join('-')
    const unknown = `${variant}:${['border', 'amber', '400/60'].join('-')}`
    expect(() => hasLightOverride(unknown)).toThrow(/does not know how Tailwind compiles/)
  })
})

/* -------------------------------------------------------------------------
   Permanent negative controls. A bar nothing can fail is not a bar.
   ------------------------------------------------------------------------- */

describe('the criteria can actually fail', () => {
  it('the existence criterion reports an undefined class/opacity pair as uncovered', () => {
    // No component uses these exact pairs. Composed from parts rather than
    // written whole, so Tailwind's content extractor - whose glob covers
    // src/**/*.ts, test files included - cannot resurrect them as dead rules in
    // the shipped stylesheet (TAILWIND-TESTPROSE-LEAK-1).
    for (const prefix of ['text', 'bg', 'border']) {
      expect(hasLightOverride([prefix, 'cyan', '500/33'].join('-'))).toBe(false)
    }
  })

  it('the contrast criterion judges a raw dark-authored pastel as invisible-grade', () => {
    // The permanent positive control for the ratio itself. Every foreground
    // assertion above is a "must pass"; if surfaceBackdrop or the luminance
    // arithmetic ever drifted toward returning something generous, they would
    // all stay green while measuring nothing. This is a real Tailwind palette
    // value with no override in this repo, i.e. exactly what a new consumer of
    // it would render in light mode, and it must still be judged a failure -
    // and not merely below the bar, but invisible-grade.
    const pastel = ['text', 'cyan', '200'].join('-')
    expect(hasLightOverride(pastel)).toBe(false)
    const ratio = lightContrastRatio(pastel)
    expect(ratio).toBeLessThan(AA_NORMAL_TEXT)
    expect(ratio).toBeLessThan(2)
    expect(paletteColorFor(pastel)).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('the two criteria disagree in BOTH directions - the whole reason for D-22', () => {
    // Rule existence is wrong both ways, which is why the foreground gate above
    // is a ratio and not an existence check.
    //
    // Direction 1: no override, yet perfectly legible. An existence criterion
    // would demand a pointless override here, against a ratchet with no
    // headroom - and this class is used in more than a dozen files.
    const legibleWithoutOverride = ['text', 'zinc', '600'].join('-')
    expect(hasLightOverride(legibleWithoutOverride)).toBe(false)
    expect(lightContrastRatio(legibleWithoutOverride)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    //
    // Direction 2: an override exists, and the ratio - not its existence - is
    // what says whether it works. Existence would pass this class no matter
    // what colour the rule declared, including another pastel.
    const overridden = ['text', 'cyan', '300'].join('-')
    expect(hasLightOverride(overridden)).toBe(true)
    expect(lightOverrideColor(overridden)).not.toBeNull()
    expect(lightContrastRatio(overridden)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })

  it('a foreground with no consumer is still checkable, so retiring a class cannot retire the guard', () => {
    // consumersOf is the discovery half; if it silently returned [] for
    // everything, the it.each sweeps above would shrink to nothing. Anchored on
    // a class this repo genuinely uses in many files.
    expect(consumersOf('text-amber-300').length).toBeGreaterThan(5)
    expect(consumersOf(['text', 'cyan', '500/33'].join('-'))).toEqual([])
  })
})
