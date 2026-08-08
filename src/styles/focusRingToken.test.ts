/**
 * v1.27.1 (ROADMAP.md D-26 + D-27): the `--focus-ring` token clears 3:1 in BOTH
 * themes, against every surface it can be painted on.
 *
 * WHY THIS FILE EXISTS. This app spells "this element has keyboard focus" in
 * several ways, and the widest-reaching one is a single custom property:
 * `outline: 2px solid var(--focus-ring)` in src/index.css covers every styled
 * button and every text input, and seven more files name the token directly as
 * an arbitrary-value outline utility. FOCUS-RING-LIGHT-1 excused exactly that
 * mechanism - verbatim, "Note the app-level focus ring is fine ... a token that
 * carries both themes" - and the token does carry both themes. That was never
 * the question. Composited onto this repo's own light surfaces the light value
 * measured under the 3:1 bar on all three of them, so the one focus indicator
 * that reaches every control in the app was the one surface nobody measured.
 *
 * WCAG 1.4.11 (non-text contrast) sets 3:1 for visual information that
 * identifies a component's STATE. A focus indicator is the textbook instance,
 * which is why the bar here is 3 rather than the 4.5 the foreground suites use:
 * a ring is not text.
 *
 * WHAT IS DERIVED AND WHAT IS PINNED, because the distinction is the whole
 * value of the file:
 *
 *   - DERIVED: the token's value, the three surface fills, the compositing and
 *     the ratio arithmetic all come from src/styles/tokens.css through
 *     scripts/lib/themeContrast.ts. Nothing here is a hex copied out of a
 *     roadmap table, and no assertion is a grep for the new value - a
 *     `grep -c "#b45309"` is satisfied by a comment, and would have passed just
 *     as happily on the old translucent value if someone had merely mentioned
 *     it (L-033).
 *   - PINNED: the BAR (3:1) and the DARK ratios. The bar is a standard, not a
 *     measurement, so deriving it from the tree would make it unfalsifiable.
 *     The dark ratios are pinned to two decimals so that "fixed light by
 *     breaking dark" cannot pass: v1.27.1 changes the LIGHT value only, and a
 *     dark edit has to come here and say so.
 *
 * The surfaces are checked one at a time rather than against the card fill
 * alone because they differ and the page background is the WORST case in light:
 * --surface-0 is zinc-100, while --surface-1 and --surface-2 are near-white
 * fills laid over it. A focus ring on a bare page therefore has less to work
 * with than the same ring inside a modal, and measuring only the modal measures
 * the easy one.
 */
import { describe, expect, it } from 'vitest'

import {
  compositeOver,
  contrastRatio,
  cssVariable,
  INDEX_CSS,
  parseCssColor,
  relativeLuminance,
  SOURCE_ENTRIES,
  SURFACE_NAMES,
  surfaceBackdrop,
  type SurfaceName,
} from '../../scripts/lib/themeContrast'

/** WCAG 2.2 SC 1.4.11 Non-text Contrast: 3:1 for the visual information needed
 * to identify a user-interface component's state. A focus indicator is that. */
const FOCUS_INDICATOR_MIN = 3

/**
 * The dark ratios as they stand before v1.27.1, keyed by surface. Pinned, not
 * derived - see the header. If a change to the dark token moves any of these,
 * this file must be edited deliberately, which is the point.
 */
const DARK_RATIOS: Record<SurfaceName, number> = {
  'surface-0': 6.12,
  'surface-1': 5.59,
  'surface-2': 5.86,
}

/** The composited contrast of --focus-ring against one surface fill in one
 * theme. The token is translucent in dark and opaque in light, so compositing
 * is not optional in either direction: skipping it measures a colour that never
 * reaches a screen. */
function focusRingRatio(theme: 'light' | 'dark', surface: SurfaceName): number {
  const backdrop = surfaceBackdrop(theme, surface)
  const ring = compositeOver(parseCssColor(cssVariable(theme, 'focus-ring')), backdrop)
  return contrastRatio(ring, backdrop)
}

function ratioTable(theme: 'light' | 'dark'): string {
  return SURFACE_NAMES.map((s) => `--${s} ${focusRingRatio(theme, s).toFixed(2)}:1`).join(', ')
}

describe('--focus-ring clears the non-text contrast bar in both themes', () => {
  it('reads the theme blocks it claims to read', () => {
    // tokens.css names both blocks in its own header prose, so a slicing bug
    // that lands inside a comment yields the DARK block for a light lookup -
    // every token resolves, every ratio looks plausible, and the wrong theme
    // has been measured. Luminance settles it before any ratio is trusted.
    expect(relativeLuminance(surfaceBackdrop('light'))).toBeGreaterThan(0.5)
    expect(relativeLuminance(surfaceBackdrop('dark'))).toBeLessThan(0.1)
    expect(cssVariable('light', 'focus-ring')).not.toBe(cssVariable('dark', 'focus-ring'))

    // Printed on every run, pass or fail. A contrast suite whose numbers are
    // only visible when it is red gives the next reader nothing to re-derive
    // from, and this repo has twice had a milestone inherit a ratio nobody
    // could reproduce.
    console.log(
      `light --focus-ring ${cssVariable('light', 'focus-ring')}: ${ratioTable('light')}\n` +
        `dark  --focus-ring ${cssVariable('dark', 'focus-ring')}: ${ratioTable('dark')}`,
    )
  })

  it('measures three distinct light surfaces, not the same one three times', () => {
    // If --surface-1 and --surface-2 ever collapse onto --surface-0, the loop
    // below would still pass while checking one backdrop three times.
    const distinct = new Set(SURFACE_NAMES.map((s) => surfaceBackdrop('light', s).join(',')))
    expect(distinct.size, `light surface backdrops: ${[...distinct].join(' / ')}`).toBe(SURFACE_NAMES.length)
  })

  it.each(SURFACE_NAMES)('light --focus-ring clears 3:1 on --%s', (surface) => {
    const ratio = focusRingRatio('light', surface)
    expect(
      ratio,
      `light --focus-ring is ${cssVariable('light', 'focus-ring')}; on --${surface} it resolves ` +
        `${ratio.toFixed(2)}:1, under the ${FOCUS_INDICATOR_MIN}:1 WCAG 1.4.11 bar for a focus ` +
        `indicator. Whole light table: ${ratioTable('light')}`,
    ).toBeGreaterThanOrEqual(FOCUS_INDICATOR_MIN)
  })

  it.each(SURFACE_NAMES)('dark --focus-ring is unchanged on --%s', (surface) => {
    const ratio = focusRingRatio('dark', surface)
    expect(
      Number(ratio.toFixed(2)),
      `dark --focus-ring moved on --${surface}: expected ${DARK_RATIOS[surface]}:1, got ` +
        `${ratio.toFixed(2)}:1. v1.27.1 changes the LIGHT token only. Whole dark table: ` +
        `${ratioTable('dark')}`,
    ).toBe(DARK_RATIOS[surface])
    expect(ratio).toBeGreaterThanOrEqual(FOCUS_INDICATOR_MIN)
  })

  it('is measuring a token something actually paints with', () => {
    // A ratio on an unused token is a green light for nothing. The two index.css
    // rules and the arbitrary-value outline utility are discovered here rather
    // than listed, and an empty discovery is a hard failure, never a silent
    // pass (L-031).
    //
    // The utility is assembled from parts rather than written whole because
    // tailwind.config.js's content glob is ./src/**/*.{ts,tsx} and its extractor
    // reads this file: a class spelled out here stays in the shipped stylesheet
    // after its last real consumer leaves, which is TAILWIND-TESTPROSE-LEAK-1
    // and would also make this very assertion self-satisfying.
    //
    // The variant prefix is part of the pattern, not part of the token: every
    // real call site spells this as a `focus-visible:` utility, so a boundary
    // anchored on whitespace alone finds ZERO consumers on a tree that has
    // eight - which is what this assertion caught on its first run, before the
    // token was touched.
    const utility = ['outline-[var(--focus', '-ring)]'].join('')
    const escaped = utility.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const boundary = new RegExp(`(^|[\\s'"\`])([a-z0-9-]+:)*${escaped}(?=[\\s'"\`]|$)`, 'm')
    const consumers = SOURCE_ENTRIES.filter(({ source }) => boundary.test(source)).map(({ rel }) => rel)

    const cssRules = [...INDEX_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => /outline:\s*[^;]*var\(--focus-ring\)/.test(body))
      .map(([, selector]) => selector.trim().replace(/\s+/g, ' '))

    console.log(
      `--focus-ring consumers: ${cssRules.length} index.css rule(s) [${cssRules.join(' | ')}], ` +
        `${consumers.length} source file(s) [${consumers.join(', ')}]`,
    )
    expect(cssRules.length).toBeGreaterThan(0)
    expect(consumers.length).toBeGreaterThan(0)
  })
})
