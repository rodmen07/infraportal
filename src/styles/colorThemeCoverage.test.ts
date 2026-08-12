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
 *   FOCUS INDICATORS (v1.27.3, D-26 + D-29) are gated on a COMPUTED ratio at
 *   3:1 - WCAG 1.4.11's bar for visual information that identifies a
 *   component's STATE - against ALL THREE surface backdrops, in BOTH themes.
 *   The targets are discovered from source and from index.css rather than
 *   listed, they include the arbitrary-value and semantic-token spellings that
 *   parseColorUtility cannot see, and a focus spelling the classifier cannot
 *   measure is a HARD FAILURE, never a silent skip. See the criterion's own
 *   section below for the boundary it draws.
 *
 * WHAT IS DELIBERATELY NOT GATED, WITH THE MEASUREMENT RATHER THAN AN
 * ASSERTION. A blanket 3:1 contrast bar on hairlines was the v1.26 definition's
 * recommended default and it is NOT implemented here, because measuring it
 * falsified it: 73 of this repo's 76 hairline utilities land below 3:1 in light
 * mode (this header read "72 of this repo's 76" as written on 2026-08-08; the
 * v1.27 definition pass re-ran the same census the same day and measured 73,
 * naming the three passing rows - see ROADMAP.md's v1.26.3 correction), and
 * most of them do so because index.css deliberately overrides them to a faint
 * rgba(0,0,0,0.08-0.16). That is an authored design decision about decorative
 * card hairlines, not 73 bugs, and WCAG's non-text-contrast requirement
 * applies to boundaries that IDENTIFY a control or its state rather than to
 * every rule and divider. Applying the bar as written would have demanded
 * redesigning every border in the app inside a scanner increment.
 *
 * The v1.26.4 decision this header used to defer to IS NOW TAKEN. Until
 * v1.27.3 this paragraph ended: "The sub-question that IS a real defect -
 * focus indicators that vanish in light, measured as low as 1.10:1 - is filed
 * separately with its numbers. Choosing the hairline criterion is ROADMAP.md
 * v1.26.4; until it is chosen this file says so instead of pretending the
 * surface is covered." ROADMAP.md D-26 answered it: focus indicators are gated
 * at 3:1 (implemented below), decorative hairlines stay on rule-existence.
 *
 * FILLS ARE OUT OF THE CONTRAST CRITERION STRUCTURALLY, not by exemption: a
 * fill has no contrast of its own, its legibility is a property of the
 * foreground sitting on it, and that foreground is gated above.
 */
import { describe, expect, it } from 'vitest'
import {
  AA_NORMAL_TEXT,
  classTokensIn,
  COLOR_PREFIXES,
  type ColorUtility,
  colorUtilitiesIn,
  compositeOver,
  consumersOf,
  contrastRatio,
  classNamesInSelector,
  cssVariable,
  hasLightOverride,
  INDEX_CSS,
  LIGHT_OVERRIDE_SELECTORS,
  LIGHT_THEME_ATTR,
  lightContrastRatio,
  lightOverrideColor,
  lightOverrideHeads,
  lightOverrideOrphans,
  lightOverrideSelectorFor,
  lightOverrideSelectors,
  lightResolvedColor,
  paletteColorFor,
  parseColorUtility,
  parseCssColor,
  PALETTE_HUES,
  RAW_INDEX_CSS,
  relativeLuminance,
  type Rgba,
  SOURCE_ENTRIES,
  SOURCE_FILES,
  SURFACE_NAMES,
  type SurfaceName,
  surfaceBackdrop,
  unreadableOverrideHeads,
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
   D-26 + D-29 (v1.27.3): every focus indicator clears 3:1, both themes, all
   three surfaces.

   THE BOUNDARY, stated once. WCAG 1.4.11's state bar applies to the BOUNDARY
   that identifies focus, so the criterion covers the hairline spellings (ring,
   outline, border, divide) in every form this repo can write them: palette
   utility, arbitrary var() value, semantic token, named keyword. What it
   deliberately does NOT cover, each with its owner:

     - `outline-none` suppressions: the ABSENCE of an indicator, not a colour
       to measure. focusSpelling.test.ts contract C pins that inventory to a
       documented allowlist that can only shrink, and the two real-control
       entries in it are FOCUS-OUTLINE-SUPPRESSED-1 in the backlog.
     - focus-variant FOREGROUNDS: gated at AA (4.5:1, a stricter bar) by the
       D-22 sweep above, which is variant-aware.
     - focus-variant FILLS and positioning/reveal classes (the skip link's
       focus-revealed panel): a fill identifies state by area, not boundary,
       and its legibility is its foreground's, which D-22 gates.

   Ring and outline WIDTHS are geometry, not colour - but a focus-variant ring
   width with no ring colour in the same file falls back to Tailwind's stock
   blue-500/50 default (measured in v1.27.2, which deleted exactly that
   pairing hazard), and an outline width with no named colour paints a colour
   this criterion cannot measure. Both are therefore REQUIRED to name a
   measurable colour in the same file, and anything the classifier cannot
   place is a HARD FAILURE with instructions, never a silent skip.
   ------------------------------------------------------------------------- */

/** WCAG 2.2 SC 1.4.11 non-text contrast: 3:1 for the visual information that
 * identifies a component's state. Pinned, not derived - the bar is a standard,
 * and deriving it from the tree would make it unfalsifiable. */
const FOCUS_INDICATOR_MIN = 3

const FOCUS_VARIANTS = new Set(['focus', 'focus-visible', 'focus-within'])

/** Leading `variant:` segments of a class token, split from the utility they
 * modify. The variant charset is [a-z0-9-], so a bracketed arbitrary value
 * (which may contain anything) can never be mistaken for a variant chain. */
function splitVariants(token: string): { variants: string[]; bare: string } {
  const variants: string[] = []
  let bare = token
  let match: RegExpExecArray | null
  while ((match = /^([a-z][a-z0-9-]*):(.+)$/.exec(bare)) !== null) {
    variants.push(match[1])
    bare = match[2]
  }
  return { variants, bare }
}

type FocusClassification =
  | { role: 'indicator'; light: Rgba; dark: Rgba; via: string }
  | { role: 'geometry'; family: string; needsColour: boolean }
  | { role: 'outside'; why: string }

function withAlpha(colour: Rgba, alpha: number): Rgba {
  return [colour[0], colour[1], colour[2], alpha]
}

/** Tailwind's shadeless colour keywords, plus this repo's semantic tokens
 * (tailwind.config.js maps each onto var(--<name>) in tokens.css, DEFAULT keys
 * dropping their suffix, so the class remainder IS the variable name). */
function namedOrSemanticColour(name: string, theme: 'light' | 'dark'): Rgba | null {
  if (name === 'white') return [255, 255, 255, 1]
  if (name === 'black') return [0, 0, 0, 1]
  if (name === 'transparent') return [0, 0, 0, 0]
  try {
    return parseCssColor(cssVariable(theme, name))
  } catch {
    return null
  }
}

/**
 * What a focus-variant class token PAINTS, or where its measurement lives
 * instead. Throws - a hard failure, by design - on any spelling it cannot
 * place, including a focus-visible PALETTE colour utility (the override
 * lookup's VARIANT_SELECTOR_SUFFIX does not map that variant; the v1.27
 * milestone constraint says the edit that introduces one adds the mapping).
 */
function classifyFocusToken(token: string): FocusClassification {
  const { bare } = splitVariants(token)

  if (bare === 'outline-none') {
    return { role: 'outside', why: 'suppression - inventoried and allowlisted by focusSpelling.test.ts contract C' }
  }

  // Palette utilities: COLOR_PREFIXES is the one vocabulary that decides kind.
  const palette = parseColorUtility(token)
  if (palette !== null) {
    if (palette.kind === 'foreground') {
      return { role: 'outside', why: 'foreground - gated at AA by the D-22 sweep, which is variant-aware' }
    }
    if (palette.kind === 'fill') {
      return { role: 'outside', why: 'fill - identifies state by area, not boundary; its foreground is D-22 gated' }
    }
    const property = COLOR_PREFIXES[palette.prefix].property ?? 'color'
    const base = parseCssColor(paletteColorFor(token))
    return {
      role: 'indicator',
      // Light honours the override sheet exactly like every real render does;
      // dark is authored directly on the palette (index.css carries zero
      // [data-theme="dark"] rules - see the module header of themeContrast).
      light: lightResolvedColor(token, property),
      dark: palette.alpha === null ? base : withAlpha(base, palette.alpha),
      via: `palette ${palette.kind}`,
    }
  }

  const familyMatch = /^(ring|outline|border|divide)(?:-(.+))?$/.exec(bare)
  if (familyMatch === null) {
    return { role: 'outside', why: 'not a boundary property - positioning, reveal and fill classes identify nothing by boundary' }
  }
  const family = familyMatch[1]
  const rest = familyMatch[2]

  // Bare `ring` (width 3) / `outline` (style solid) / `border` (width 1).
  if (rest === undefined) {
    return { role: 'geometry', family, needsColour: family === 'ring' || family === 'outline' }
  }

  // Arbitrary values: the app's own recipe is the --focus-ring arbitrary
  // outline (spelled whole only at its live call sites - a bare copy here
  // would become a dead rule in the shipped stylesheet).
  const arbitrary = /^\[(.+)\]$/.exec(rest)
  if (arbitrary !== null) {
    const varRef = /^var\(--([a-z0-9-]+)\)$/.exec(arbitrary[1])
    if (varRef !== null) {
      return {
        role: 'indicator',
        light: parseCssColor(cssVariable('light', varRef[1])),
        dark: parseCssColor(cssVariable('dark', varRef[1])),
        via: `var(--${varRef[1]})`,
      }
    }
    if (/^\d/.test(arbitrary[1])) {
      return { role: 'geometry', family, needsColour: family === 'ring' || family === 'outline' }
    }
    const literal = parseCssColor(arbitrary[1]) // throws on a non-colour: hard failure with the parser's message
    return { role: 'indicator', light: literal, dark: literal, via: 'arbitrary literal colour' }
  }

  // Widths, styles and offsets - geometry, not colour. A border/divide width
  // inherits its colour from the element's resting border utility, which the
  // hairline scope covers; ring and outline widths must name theirs (below).
  if (/^\d+$/.test(rest)) {
    return { role: 'geometry', family, needsColour: family === 'ring' || family === 'outline' }
  }
  if (['solid', 'dashed', 'dotted', 'double', 'hidden', 'none', 'inset'].includes(rest)) {
    return { role: 'geometry', family, needsColour: false }
  }
  if (/^offset-/.test(rest)) {
    return { role: 'geometry', family, needsColour: false }
  }

  // Semantic tokens and shadeless keywords, with the opacity-modifier trap
  // called out: tailwind.config.js's own comment records that Tailwind cannot
  // apply an alpha channel to a bare var() colour, so `/NN` on one of these is
  // a spelling that does not compile to what it reads as.
  const alphaMatch = /^(.+?)\/(\d{1,3})$/.exec(rest)
  const name = alphaMatch === null ? rest : alphaMatch[1]
  const alpha = alphaMatch === null ? null : Number(alphaMatch[2]) / 100
  const light = namedOrSemanticColour(name, 'light')
  const dark = namedOrSemanticColour(name, 'dark')
  if (light !== null && dark !== null) {
    if (alpha !== null) {
      if (!['white', 'black', 'transparent'].includes(name)) {
        throw new Error(
          `"${token}": an opacity modifier on a var()-backed colour does not compile ` +
            '(tailwind.config.js documents this); spell the translucent role as its own token in tokens.css.',
        )
      }
      return { role: 'indicator', light: withAlpha(light, alpha), dark: withAlpha(dark, alpha), via: `keyword ${name}/${alphaMatch![2]}` }
    }
    return { role: 'indicator', light, dark, via: `token --${name}` }
  }
  throw new Error(
    `"${token}" carries a focus variant but cannot be classified: not a palette utility, not var(--...) or a ` +
      'literal colour, not a width/style/offset, and not a token tokens.css defines in both themes. A focus ' +
      'indicator this criterion cannot measure is a hard failure, never a silent skip - either respell it with ' +
      'a measurable colour (the app recipe is the --focus-ring outline) or teach classifyFocusToken the new form.',
  )
}

/** Every focus-variant class token in non-test source, with its files. */
const FOCUS_CLASS_FILES = new Map<string, string[]>()
for (const { rel, source } of SOURCE_ENTRIES) {
  for (const token of classTokensIn(source)) {
    if (!splitVariants(token).variants.some((v) => FOCUS_VARIANTS.has(v))) continue
    const files = FOCUS_CLASS_FILES.get(token)
    if (files === undefined) FOCUS_CLASS_FILES.set(token, [rel])
    else if (!files.includes(rel)) files.push(rel)
  }
}

const FOCUS_CLASSIFIED = [...FOCUS_CLASS_FILES.entries()]
  .map(([token, files]) => ({ token, files: [...files].sort() }))
  .sort((a, b) => a.token.localeCompare(b.token))
  .map((entry) => {
    try {
      return { ...entry, classification: classifyFocusToken(entry.token), error: null as Error | null }
    } catch (error) {
      return { ...entry, classification: null, error: error as Error }
    }
  })

const FOCUS_CLASS_INDICATORS = FOCUS_CLASSIFIED.filter(
  (e): e is typeof e & { classification: Extract<FocusClassification, { role: 'indicator' }> } =>
    e.classification?.role === 'indicator',
)

/** Flat {selector, body} list of index.css rules, descending into at-rule
 * bodies so a rule one @media deep is still seen. Written as a tiny
 * depth-aware walk because the flat regex the sibling suites use would treat
 * an @media header and its first nested rule as one giant selector. */
function cssRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = []
  const walk = (from: number, to: number): void => {
    let start = from
    let idx = from
    while (idx < to) {
      if (css[idx] === '{') {
        let depth = 1
        let close = idx + 1
        while (close < to && depth > 0) {
          if (css[close] === '{') depth += 1
          else if (css[close] === '}') depth -= 1
          close += 1
        }
        const selector = css.slice(start, idx).trim()
        if (selector.startsWith('@')) walk(idx + 1, close - 1)
        else rules.push({ selector, body: css.slice(idx + 1, close - 1) })
        start = close
        idx = close
      } else {
        idx += 1
      }
    }
  }
  walk(0, css.length)
  return rules
}

const FOCUS_SELECTOR = /:focus(?:-visible|-within)?(?![a-z-])/

/** The boundary-colour properties an index.css focus rule can paint an
 * indicator with. Background is deliberately absent: a fill identifies state
 * by area, not boundary, and its legibility is its foreground's. */
const BOUNDARY_PROPERTIES = ['outline-color', 'outline', 'border-color', 'border', 'box-shadow', '--tw-ring-color']

function classifyFocusRule(rule: { selector: string; body: string }):
  | { role: 'indicator'; light: Rgba | null; dark: Rgba | null; via: string }
  | { role: 'outside'; why: string } {
  const themes: ('light' | 'dark')[] = rule.selector.includes('[data-theme="light"]')
    ? ['light']
    : rule.selector.includes('[data-theme="dark"]')
      ? ['dark']
      : ['light', 'dark']
  for (const property of BOUNDARY_PROPERTIES) {
    const escaped = property.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
    const declared = new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;]+)`).exec(rule.body)
    if (declared === null) continue
    const value = declared[1].trim()
    const varRef = /var\(--([a-z0-9-]+)\)/.exec(value)
    if (varRef !== null) {
      return {
        role: 'indicator',
        light: themes.includes('light') ? parseCssColor(cssVariable('light', varRef[1])) : null,
        dark: themes.includes('dark') ? parseCssColor(cssVariable('dark', varRef[1])) : null,
        via: `${property}: var(--${varRef[1]})`,
      }
    }
    for (const piece of value.split(/[\s,]+/)) {
      try {
        const colour = parseCssColor(piece)
        return {
          role: 'indicator',
          light: themes.includes('light') ? colour : null,
          dark: themes.includes('dark') ? colour : null,
          via: `${property} literal`,
        }
      } catch {
        // not a colour piece; keep looking
      }
    }
    throw new Error(
      `index.css rule "${rule.selector}" declares "${property}: ${value}" on a focus selector, but no colour in ` +
        'that value resolves. Spell it as var(--token) or a hex/rgb literal so this criterion can measure it - ' +
        'an unmeasurable focus indicator is a hard failure, never a silent skip.',
    )
  }
  return { role: 'outside', why: 'no boundary-colour declaration (geometry or positioning only)' }
}

const FOCUS_RULES_CLASSIFIED = cssRules(INDEX_CSS)
  .filter((rule) => FOCUS_SELECTOR.test(rule.selector))
  .map((rule) => {
    const selector = rule.selector.replace(/\s+/g, ' ')
    try {
      return { selector, classification: classifyFocusRule(rule), error: null as Error | null }
    } catch (error) {
      return { selector, classification: null, error: error as Error }
    }
  })

const FOCUS_RULE_INDICATORS = FOCUS_RULES_CLASSIFIED.filter(
  (e): e is typeof e & { classification: { role: 'indicator'; light: Rgba | null; dark: Rgba | null; via: string } } =>
    e.classification?.role === 'indicator',
)

function indicatorRatio(colour: Rgba, theme: 'light' | 'dark', surface: SurfaceName): number {
  const backdrop = surfaceBackdrop(theme, surface)
  return contrastRatio(compositeOver(colour, backdrop), backdrop)
}

function ratioTriple(colour: Rgba, theme: 'light' | 'dark'): string {
  return SURFACE_NAMES.map((s) => indicatorRatio(colour, theme, s).toFixed(2)).join('/')
}

/** Files whose focus-variant ring/outline WIDTHS have no measurable colour of
 * the same family beside them. Parameterised over the corpus so the sweep's
 * own failure mode is testable on a synthetic file (L-031). */
function pairingViolations(entries: readonly { rel: string; source: string }[]): string[] {
  const violations: string[] = []
  for (const { rel, source } of entries) {
    const tokens = classTokensIn(source).filter((t) => splitVariants(t).variants.some((v) => FOCUS_VARIANTS.has(v)))
    const classified = tokens.flatMap((t) => {
      try {
        return [{ token: t, classification: classifyFocusToken(t) }]
      } catch {
        return [] // unclassifiable tokens are the classifiability test's finding, not this sweep's
      }
    })
    for (const family of ['ring', 'outline']) {
      const widths = classified.filter(
        (e) => e.classification.role === 'geometry' && e.classification.family === family && e.classification.needsColour,
      )
      if (widths.length === 0) continue
      const colours = classified.filter(
        (e) => e.classification.role === 'indicator' && splitVariants(e.token).bare.startsWith(family),
      )
      if (colours.length === 0) {
        violations.push(
          `${rel}: ${widths.map((e) => e.token).join(' ')} with no focus-variant ${family} colour in the same ` +
            `file - a ring width alone paints Tailwind's stock blue default, and an outline width alone ` +
            'paints a colour this criterion cannot measure. Name the colour (the app recipe pairs the width ' +
            'with the --focus-ring arbitrary outline or the accent ring token).',
        )
      }
    }
  }
  return violations
}

describe('every focus indicator clears 3:1 in both themes (D-26 + D-29, v1.27.3)', () => {
  it('classifies every focus spelling - an unclassifiable one is a hard failure, never a skip', () => {
    expect(FOCUS_CLASSIFIED.filter((e) => e.error !== null).map((e) => `${e.token}: ${e.error!.message}`)).toEqual([])
    expect(
      FOCUS_RULES_CLASSIFIED.filter((e) => e.error !== null).map((e) => `${e.selector}: ${e.error!.message}`),
    ).toEqual([])
  })

  it('discovers a real corpus, and prints every classification and ratio (L-031)', () => {
    const lines: string[] = []
    for (const e of FOCUS_CLASSIFIED) {
      const c = e.classification
      if (c === null) lines.push(`  ${e.token} -> UNCLASSIFIABLE: ${e.error!.message}`)
      else if (c.role === 'indicator') {
        lines.push(
          `  ${e.token} [${c.via}] light ${ratioTriple(c.light, 'light')} dark ${ratioTriple(c.dark, 'dark')} (${e.files.join(', ')})`,
        )
      } else if (c.role === 'geometry') {
        lines.push(`  ${e.token} [geometry: ${c.family}${c.needsColour ? ', must pair with a colour' : ''}] (${e.files.join(', ')})`)
      } else lines.push(`  ${e.token} [outside: ${c.why}] (${e.files.join(', ')})`)
    }
    for (const e of FOCUS_RULE_INDICATORS) {
      const c = e.classification
      lines.push(
        `  index.css "${e.selector}" [${c.via}]` +
          (c.light !== null ? ` light ${ratioTriple(c.light, 'light')}` : '') +
          (c.dark !== null ? ` dark ${ratioTriple(c.dark, 'dark')}` : ''),
      )
    }
    console.log(`[focusIndicators] ratios vs --surface-0/1/2, bar ${FOCUS_INDICATOR_MIN}:1:\n${lines.join('\n')}`)

    // Zero-match floors: this tree HAS focus indicators, so a scan that finds
    // fewer than it must has gone blind, not clean. The arbitrary --focus-ring
    // outline reaches at least five files, and index.css contributes at least
    // the styled-button rule and the form-control rule.
    expect(FOCUS_CLASS_INDICATORS.length).toBeGreaterThanOrEqual(2)
    expect(FOCUS_RULE_INDICATORS.length).toBeGreaterThanOrEqual(2)
    const arbitraryForm = FOCUS_CLASS_INDICATORS.find((e) => e.classification.via.includes('focus-ring'))
    expect(arbitraryForm, 'the var(--focus-ring) outline utility vanished from source').toBeDefined()
    expect(arbitraryForm!.files.length).toBeGreaterThanOrEqual(5)
  })

  it.each(FOCUS_CLASS_INDICATORS.map((e) => ({ token: e.token, e })))(
    '$token clears 3:1 on every surface in both themes',
    ({ e }) => {
      const c = e.classification
      for (const theme of ['light', 'dark'] as const) {
        const colour = theme === 'light' ? c.light : c.dark
        for (const surface of SURFACE_NAMES) {
          const ratio = indicatorRatio(colour, theme, surface)
          expect(
            ratio,
            `"${e.token}" (${c.via}) lands at ${ratio.toFixed(2)}:1 on --${surface} in ${theme}, under the ` +
              `${FOCUS_INDICATOR_MIN}:1 WCAG 1.4.11 bar for a focus indicator. Used by: ${e.files.join(', ')}. ` +
              'Fix the value - this criterion has zero exemptions by design.',
          ).toBeGreaterThanOrEqual(FOCUS_INDICATOR_MIN)
        }
      }
    },
  )

  it.each(FOCUS_RULE_INDICATORS.map((e) => ({ selector: e.selector, e })))(
    'index.css $selector clears 3:1 on every surface it applies in',
    ({ e }) => {
      const c = e.classification
      for (const theme of ['light', 'dark'] as const) {
        const colour = theme === 'light' ? c.light : c.dark
        if (colour === null) continue
        for (const surface of SURFACE_NAMES) {
          const ratio = indicatorRatio(colour, theme, surface)
          expect(
            ratio,
            `index.css "${e.selector}" (${c.via}) lands at ${ratio.toFixed(2)}:1 on --${surface} in ${theme}, ` +
              `under the ${FOCUS_INDICATOR_MIN}:1 WCAG 1.4.11 bar.`,
          ).toBeGreaterThanOrEqual(FOCUS_INDICATOR_MIN)
        }
      }
    },
  )

  it('a focus-variant ring or outline width names its colour in the same file - and the sweep can fail', () => {
    expect(pairingViolations(SOURCE_ENTRIES)).toEqual([])
    // Both halves on a synthetic corpus, so the empty list above cannot be
    // vacuous. Composed from fragments (TAILWIND-TESTPROSE-LEAK-1): the width
    // alone must be reported, the width beside a measurable colour must not.
    const width = ['focus-visible', `ring-${2}`].join(':')
    const colour = ['focus-visible', ['ring', 'accent'].join('-')].join(':')
    expect(pairingViolations([{ rel: 'synthetic.tsx', source: `"${width}"` }])).toHaveLength(1)
    expect(pairingViolations([{ rel: 'synthetic.tsx', source: `"${width} ${colour}"` }])).toEqual([])
  })

  it('draws its boundary where the milestone does, per class', () => {
    // Live spellings only, written whole because regenerating a class the app
    // really uses is a no-op for the content extractor.
    expect(classifyFocusToken('focus:outline-none').role).toBe('outside')
    expect(classifyFocusToken('focus-visible:ring-2')).toEqual({ role: 'geometry', family: 'ring', needsColour: true })
    expect(classifyFocusToken('focus-visible:outline-offset-2')).toEqual({
      role: 'geometry',
      family: 'outline',
      needsColour: false,
    })
    // A focus-variant foreground stays with D-22's stricter bar.
    const foreground = ['focus', ['text', 'zinc', '200'].join('-')].join(':')
    expect(classifyFocusToken(foreground).role).toBe('outside')
  })

  it('judges the pre-v1.27.1 translucent token below the bar - the permanent anchor', () => {
    // The exact value FOCUS-RING-LIGHT-1 shipped with, measured through the
    // identical path the live criterion uses. Its recorded triple (2.75 /
    // 2.90 / 2.81 on --surface-0/1/2) is re-derived here on every run, so the
    // arithmetic drifting generous cannot keep the sweeps above green.
    const old = parseCssColor('rgba(180, 100, 10, 0.75)')
    const expected: Record<SurfaceName, string> = { 'surface-0': '2.75', 'surface-1': '2.90', 'surface-2': '2.81' }
    for (const surface of SURFACE_NAMES) {
      const ratio = indicatorRatio(old, 'light', surface)
      expect(ratio).toBeLessThan(FOCUS_INDICATOR_MIN)
      expect(ratio.toFixed(2), `--${surface}`).toBe(expected[surface])
    }
  })

  it('judges a below-bar palette focus ring through the same path a live one would take', () => {
    // The class v1.27.2 retired, composed from fragments so the content
    // extractor cannot resurrect it as a dead rule in the shipped stylesheet.
    const retired = ['focus', ['ring', 'amber', '500/30'].join('-')].join(':')
    const c = classifyFocusToken(retired)
    expect(c.role).toBe('indicator')
    if (c.role === 'indicator') {
      expect(indicatorRatio(c.light, 'light', 'surface-2')).toBeLessThan(2)
    }
    // A transparent ring is an indicator that FAILS (ratio 1), never a skip:
    // pairing a width with the transparent ring keyword must not read as
    // covered.
    const transparent = ['focus-visible', ['ring', 'transparent'].join('-')].join(':')
    const t = classifyFocusToken(transparent)
    expect(t.role).toBe('indicator')
    if (t.role === 'indicator') {
      expect(indicatorRatio(t.light, 'light', 'surface-0')).toBeLessThan(FOCUS_INDICATOR_MIN)
    }
  })

  it('hard-fails on the spellings it cannot measure, with instructions', () => {
    // A shadeless hue with no semantic token behind it.
    expect(() => classifyFocusToken(['focus', ['ring', 'fuchsia'].join('-')].join(':'))).toThrow(/cannot be classified/)
    // A non-colour arbitrary value on a colour-capable prefix, composed so the
    // content extractor cannot compile it into a garbage rule.
    expect(() => classifyFocusToken(['focus-visible', ['outline-[o', 'ops]'].join('')].join(':'))).toThrow(
      /unparseable/,
    )
    // An opacity modifier on a var()-backed token - the spelling that does not
    // compile to what it reads as.
    expect(() => classifyFocusToken(['focus', ['ring', 'accent/50'].join('-')].join(':'))).toThrow(/opacity modifier/)
    // A focus-visible PALETTE colour utility: the override lookup throws until
    // VARIANT_SELECTOR_SUFFIX learns the variant, per the milestone constraint.
    expect(() => classifyFocusToken(['focus-visible', ['ring', 'amber', '500/30'].join('-')].join(':'))).toThrow(
      /does not know how Tailwind compiles/,
    )
  })
})

/* -------------------------------------------------------------------------
   D-34 (v1.28.3): the mirror direction. Every criterion above asks "this class
   is used - is it covered?"; this one asks "this rule exists - is it used?",
   form-exactly. See the criterion's own header in scripts/lib/themeContrast.ts.
   ------------------------------------------------------------------------- */

const OVERRIDE_HEADS = lightOverrideHeads()
const OVERRIDE_CLASS_HEADS = OVERRIDE_HEADS.filter((h) => h.classNames.length > 0)
const OVERRIDE_ELEMENT_HEADS = OVERRIDE_HEADS.filter((h) => h.classNames.length === 0)
const OVERRIDE_ORPHANS = lightOverrideOrphans(OVERRIDE_HEADS)

/** Every selector SHAPE the live sheet uses, labelled by what it stands for and
 * asserted to still BE in the live sheet below - a fixture authored beside the
 * lexer would be drawn from the lexer's own assumptions and agree with its bugs
 * instead of catching them (L-069). Written as whole class names, which
 * v1.28.1's content glob made safe for new tests (see testProseLeak.test.ts). */
const SELECTOR_SHAPES: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ['element only, no class to consume', `${LIGHT_THEME_ATTR} body`, []],
  ['an authored component class', `${LIGHT_THEME_ATTR} .forge-panel`, ['forge-panel']],
  ['authored class + a real pseudo-class', `${LIGHT_THEME_ATTR} .forge-panel:hover`, ['forge-panel']],
  ['element qualified by a class', `${LIGHT_THEME_ATTR} pre.code-surface`, ['code-surface']],
  ['escaped opacity modifier', `${LIGHT_THEME_ATTR} .bg-zinc-900\\/80`, ['bg-zinc-900/80']],
  [
    'Tailwind variant: the escaped colon is part of the NAME, the bare one is a pseudo-class',
    `${LIGHT_THEME_ATTR} .hover\\:border-zinc-600\\/50:hover`,
    ['hover:border-zinc-600/50'],
  ],
  [
    'a variant compiling to an attribute rather than a pseudo-class',
    `${LIGHT_THEME_ATTR} .open\\:border-amber-400\\/30[open]`,
    ['open:border-amber-400/30'],
  ],
  [
    'compound: two classes that must both be on one element',
    `${LIGHT_THEME_ATTR} .animate-pulse.bg-zinc-800\\/60`,
    ['animate-pulse', 'bg-zinc-800/60'],
  ],
  [
    'combinators and a functional pseudo-class after the class',
    `${LIGHT_THEME_ATTR} .divide-zinc-800\\/40 > :not([hidden]) ~ :not([hidden])`,
    ['divide-zinc-800/40'],
  ],
]

describe('every [data-theme="light"] override still has a consumer (D-34, v1.28.3)', () => {
  it('discovers a real rule list from index.css, and prints it (L-031)', () => {
    console.log(
      `[lightOverrideConsumers] ${OVERRIDE_HEADS.length} rule heads, ${OVERRIDE_CLASS_HEADS.length} class-bearing, ` +
        `${OVERRIDE_ELEMENT_HEADS.length} element-only (${OVERRIDE_ELEMENT_HEADS.map((h) => h.selector).join(', ')}):\n` +
        OVERRIDE_CLASS_HEADS.map((h) => `  ${h.selector} -> ${h.classNames.join(' + ')}`).join('\n'),
    )
    // A zero-match hard failure, and only that: the sheet is deliberately
    // SHRINKING milestone by milestone (this criterion exists because v1.28.2
    // took 11 rules out of it), so a floor at today's 194 would redden on the
    // next legitimate deletion and send the reader to edit the guard instead of
    // reading the finding (L-090). The upper bound is the ratchet's job.
    expect(
      OVERRIDE_HEADS.length,
      'no [data-theme="light"] rule was parsed out of src/index.css - the discovery has gone blind, not clean',
    ).toBeGreaterThanOrEqual(1)
  })

  it('separates "this selector has no class" from "its class could not be read" (L-069)', () => {
    // Both are zero class names, and the second silently drops a rule from the
    // sweep below - so the criterion would go quiet exactly when the lexer is
    // wrong. Element-only heads are outside the criterion STRUCTURALLY: their
    // consumer is an HTML element, which this scanner does not parse.
    expect(unreadableOverrideHeads(OVERRIDE_HEADS)).toEqual([])
    expect(OVERRIDE_CLASS_HEADS.length + OVERRIDE_ELEMENT_HEADS.length).toBe(OVERRIDE_HEADS.length)
  })

  it.each(OVERRIDE_CLASS_HEADS.map((h) => ({ selector: h.selector, head: h })))(
    '$selector has a consumer in the form it matches',
    ({ head }) => {
      const orphaned = OVERRIDE_ORPHANS.filter((o) => o.selector === head.selector).map((o) => o.className)
      expect(
        orphaned,
        `src/index.css declares "${head.selector}" and no non-test source under src/ uses ` +
          `${orphaned.map((c) => `"${c}"`).join(' or ')} in that exact form. Tailwind compiles a variant to a ` +
          'different selector than the bare class, so a bare rule cannot cover a variant-only consumer and vice ' +
          'versa - that mismatch IS this defect (THEME-VARIANT-ORPHAN-1, 11 rules matching zero elements). Delete ' +
          'the rule and lower the ratchet in src/styles/tokens.test.ts, or point it at the form really in use. ' +
          'This criterion has no exemptions by design.',
      ).toEqual([])
    },
  )

  it('reads the shapes off the LIVE sheet, not off its own assumptions (L-069)', () => {
    for (const [shape, selector, expected] of SELECTOR_SHAPES) {
      expect(classNamesInSelector(selector), shape).toEqual([...expected])
      expect(
        LIGHT_OVERRIDE_SELECTORS,
        `index.css no longer declares "${selector}" (${shape}). Re-derive this table from the live sheet rather ` +
          'than keeping a shape the parser was written against.',
      ).toContain(selector)
    }
  })

  it('does not mistake a rule QUOTED IN A COMMENT for a rule (L-031)', () => {
    // index.css argues with itself in prose: it quotes override rules deleted in
    // earlier milestones, `.border-amber-400\/60` among them, whose bare form
    // has had no consumer since v1.27.2. A regex sweep resurrects those and
    // reports them as orphans - a guard that reports garbage gets deleted.
    const commented = `${LIGHT_THEME_ATTR} .border-amber-400\\/60`
    expect(RAW_INDEX_CSS).toContain(commented)
    expect(LIGHT_OVERRIDE_SELECTORS).not.toContain(commented)
    expect(consumersOf('border-amber-400/60')).toEqual([])
    expect(consumersOf('hover:border-amber-400/60').length).toBeGreaterThan(5)
    // The same count, both ways, on the real file.
    expect((RAW_INDEX_CSS.match(/\[data-theme="light"\]/g) ?? []).length).toBeGreaterThan(
      LIGHT_OVERRIDE_SELECTORS.length,
    )
    expect((INDEX_CSS.match(/\[data-theme="light"\]/g) ?? []).length).toBe(LIGHT_OVERRIDE_SELECTORS.length)
  })

  it('the criterion can actually fail, and only on the orphan', () => {
    // Driven over a synthetic corpus so neither real source is touched: one head
    // whose class the corpus uses, one whose class it uses only through a
    // variant - the exact THEME-VARIANT-ORPHAN-1 shape.
    const heads = lightOverrideHeads([
      `${LIGHT_THEME_ATTR} .border-zinc-600\\/60`,
      `${LIGHT_THEME_ATTR} .hover\\:border-zinc-600\\/60:hover`,
    ])
    const corpus = 'className="hover:border-zinc-600/60"'
    const consumers = (token: string) => (new RegExp(`(^|["\\s])${token.replace(/[/\\]/g, '\\$&')}(?=["\\s]|$)`).test(corpus) ? ['synthetic.tsx'] : [])
    expect(lightOverrideOrphans(heads, consumers)).toEqual([
      { selector: `${LIGHT_THEME_ATTR} .border-zinc-600\\/60`, className: 'border-zinc-600/60' },
    ])
    // And the parser half can fail too: an empty sheet discovers nothing.
    expect(lightOverrideSelectors('/* [data-theme="light"] .bg-zinc-800 { color: red } */')).toEqual([])
  })
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
