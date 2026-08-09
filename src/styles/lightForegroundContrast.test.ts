/**
 * v1.26.1 (ROADMAP.md D-22): the six sub-2:1 light-mode foregrounds stay fixed.
 *
 * This app is authored dark-first. Light is not a second authored theme, it is
 * a patch: src/index.css carries ~200 `[data-theme="light"]` override rules and
 * zero `[data-theme="dark"]` ones, so every dark-authored Tailwind palette
 * utility needs a hand-written light twin. When this slice shipped, the repo's
 * only such check (then named opacityColorThemeCoverage.test.ts, renamed to
 * colorThemeCoverage.test.ts by v1.26.3) covered a third of that surface and
 * covered it by RULE EXISTENCE; six foregrounds fell through both gaps and
 * rendered between 1.02:1 and 1.74:1 on this repo's own light card fill -
 * `text-zinc-50` on AuditPage's empty-state heading was a literally invisible
 * `<h3>`. v1.26.3 has since widened that scanner to every foreground utility
 * under this file's contrast criterion, so this suite is now the narrower of
 * the two: it pins the six that slice OWNED and the routes they took.
 *
 * Why this file computes contrast instead of checking that an override exists,
 * which is the whole of D-22: rule existence is wrong in BOTH directions. Three
 * of the uncovered foregrounds in the same v1.26 measurement (`text-zinc-600`
 * 7.28:1, `placeholder-zinc-500` 4.55:1, `text-zinc-900` 16.68:1) need nothing
 * at all, so existence would demand three pointless overrides against a ratchet
 * with no headroom - while an override that EXISTS but is wrong (a pastel
 * replaced by another pastel) passes existence and still ships an unreadable
 * heading. A ratio catches both.
 *
 * Nothing here is transcribed from ROADMAP.md's measurement table, and that is
 * deliberate - that table is a 2026-08-08 snapshot, and a guard that inherits
 * its numbers proves only that someone could copy. Everything is derived:
 *
 *   - the surface it measures against comes from src/styles/tokens.css's real
 *     `[data-theme="light"]` block, composited (--surface-2 is translucent, so
 *     the naive #f8f8f8 reading of it is wrong by itself);
 *   - the colour a class resolves to comes from src/index.css's override sheet
 *     when a rule exists, and otherwise from the Tailwind palette;
 *   - the palette is imported from the installed `tailwindcss` package, never
 *     a hand-copied hex table, so this file cannot disagree with what Tailwind
 *     actually compiles;
 *   - the consumer list is discovered by scanning src/ on disk (`.tsx` plus
 *     non-test `.ts`, widened from `.tsx`-only by v1.26.3).
 *
 * The six are named explicitly because they are this slice's scope, not its
 * evidence. Widening the scan to every colour-bearing utility is v1.26.3
 * (D-21/D-22/D-23/D-25) and deliberately lands AFTER v1.26.2 retires the JS
 * theming path, because the amber-600 icon colour in PricingFaq.tsx was
 * light-AUTHORED and would have reddened a repo-wide sweep run then. (Named in
 * parts rather than as a class string on purpose: tailwind.config.js's content
 * glob covers `./src/**` and the extractor reads comments, so the whole class
 * written here kept that utility alive in the shipped stylesheet after v1.26.2
 * removed its last consumer - TAILWIND-TESTPROSE-LEAK-1, observed in the built
 * bundle rather than inferred.)
 *
 * v1.26.3 MOVED the pure helpers this file used to define and export into
 * `scripts/lib/themeContrast.ts`, and they are imported below. Nothing about the
 * arithmetic changed; what changed is that the widened scanner now shares this
 * exact code instead of carrying a second, subtly different copy of it - two
 * scanners with two scopes is precisely how NotificationBell's chip got its
 * fill checked and its text not. One consequence is deliberate and is a
 * strengthening of the retirement guard below: `consumersOf` now discovers
 * non-test `.ts` files as well as `.tsx`, so a retired class reintroduced in a
 * class-name registry (this repo keeps one at src/features/crm/vocabulary.ts)
 * is caught rather than silently invisible.
 */
import { describe, expect, it } from 'vitest'
import {
  AA_NORMAL_TEXT,
  consumersOf,
  contrastRatio,
  cssVariable,
  lightOverrideColor,
  lightResolvedColor,
  paletteColorFor,
  parseCssColor,
  relativeLuminance,
  SOURCE_FILES,
  surfaceBackdrop,
} from '../../scripts/lib/themeContrast'

/**
 * The six foregrounds v1.26.1 owns, with the route each one took.
 *
 * `token` is the Tailwind class as it appears in JSX, variant prefix included -
 * `hover:text-amber-200`, never `text-amber-200`, because Tailwind compiles a
 * variant to a different selector entirely and collapsing them is exactly the
 * silent-pass bug colorThemeCoverage.test.ts was rewritten to fix.
 *
 * `route` records WHY each landed where it did and is asserted, not decorative:
 * 'token' classes must have left the repo (a semantic text token carries both
 * themes, so re-introducing the raw class re-introduces the defect), 'override'
 * classes must still resolve above the bar in light.
 */
const V1_26_1_FOREGROUNDS = [
  { token: 'text-zinc-50', route: 'token', landedOn: 'text-primary' },
  { token: 'hover:text-amber-200', route: 'token', landedOn: 'accent-text' },
  { token: 'hover:text-emerald-300', route: 'token', landedOn: 'success' },
  { token: 'text-cyan-300', route: 'override', landedOn: null },
  { token: 'text-purple-300', route: 'override', landedOn: null },
  { token: 'text-violet-300', route: 'override', landedOn: null },
] as const

/* -------------------------------------------------------------------------
   The guards.
   ------------------------------------------------------------------------- */

describe('v1.26.1 - the light theme has no invisible foregrounds left (D-22)', () => {
  it('reads a real repo: components, both token blocks, and a composited light surface', () => {
    // Vacuity guards. Every assertion below is quantified over one of these
    // three, so a silently-empty file sweep, a mis-sliced token block, or an
    // unparsed surface would turn the whole suite green while checking nothing.
    expect(SOURCE_FILES.length).toBeGreaterThan(40)

    const lightBackdrop = surfaceBackdrop('light')
    const darkBackdrop = surfaceBackdrop('dark')
    // The light card must actually be light and the dark one dark - this is the
    // assertion that catches slicing the wrong `[data-theme]` block, which
    // otherwise reads as a perfectly plausible run.
    expect(relativeLuminance(lightBackdrop)).toBeGreaterThan(0.5)
    expect(relativeLuminance(darkBackdrop)).toBeLessThan(0.1)
  })

  it.each(V1_26_1_FOREGROUNDS)(
    '$token resolves above 4.5:1 on the light card wherever it is still used',
    ({ token }) => {
      const consumers = consumersOf(token)
      if (consumers.length === 0) return // took the token route; the next test owns it

      const resolved = lightResolvedColor(token)
      const ratio = contrastRatio(resolved, surfaceBackdrop('light'))
      expect(
        ratio,
        `"${token}" resolves to ${lightOverrideColor(token) ?? paletteColorFor(token)} in light mode and lands at ` +
          `${ratio.toFixed(2)}:1 on --surface-2, below AA's ${AA_NORMAL_TEXT}:1. Used by: ${consumers.join(', ')}. ` +
          'Either migrate those consumers onto a semantic text token (text-text-primary/secondary/muted/subtle, ' +
          'text-accent-text, text-success/warning/danger/caution/info-text - each carries both themes), or add a ' +
          `[data-theme="light"] .${token} rule to src/index.css whose colour clears the bar.`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    },
  )

  it.each(V1_26_1_FOREGROUNDS.filter((f) => f.route === 'token'))(
    '$token stayed retired - its consumers moved to the $landedOn token',
    ({ token, landedOn }) => {
      // A semantic token carries BOTH themes, so re-introducing the raw class
      // re-introduces the defect. The test above cannot catch that on its own:
      // it passes vacuously the moment a class has no consumers, so without
      // this one, deleting the last consumer would silently retire the guard.
      expect(
        consumersOf(token),
        `"${token}" is back in a component. v1.26.1 removed it because it renders at ` +
          `${contrastRatio(parseCssColor(paletteColorFor(token)), surfaceBackdrop('light')).toFixed(2)}:1 in light ` +
          `mode with no override. Use text-${landedOn} (or hover:text-${landedOn}), which carries both themes.`,
      ).toEqual([])
    },
  )

  it.each(
    [...new Set(V1_26_1_FOREGROUNDS.filter((f) => f.landedOn !== null).map((f) => f.landedOn as string))].map(
      (name) => ({ name }),
    ),
  )('the --$name token this slice migrated onto is legible in BOTH themes', ({ name }) => {
    // The migration is only a fix if the landing colour holds up on both
    // surfaces. Checking light alone would let a "fix" ship that repaired the
    // light theme by breaking the dark one - the same one-theme blindness in
    // the opposite direction.
    for (const theme of ['light', 'dark'] as const) {
      const ratio = contrastRatio(parseCssColor(cssVariable(theme, name)), surfaceBackdrop(theme))
      expect(
        ratio,
        `--${name} is ${cssVariable(theme, name)} in ${theme}, ${ratio.toFixed(2)}:1 on that theme's --surface-2.`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    }
  })

  it('the criterion itself rejects: all six raw dark-authored values fail in light', () => {
    // The permanent negative control. Every assertion above is a "must pass",
    // and a bar that nothing can fail is not a bar - if `surfaceBackdrop` or
    // `contrastRatio` ever regressed toward returning something generous, the
    // whole suite would stay green while measuring nothing. These are the six
    // values as Tailwind ships them, which is what a re-introduced raw class
    // would render, and every one of them must still be judged a failure.
    const backdrop = surfaceBackdrop('light')
    const measured = V1_26_1_FOREGROUNDS.map(({ token }) => ({
      token,
      hex: paletteColorFor(token),
      ratio: Number(contrastRatio(parseCssColor(paletteColorFor(token)), backdrop).toFixed(2)),
    }))
    for (const { token, ratio } of measured) {
      expect(ratio, `${token} raw palette value now measures ${ratio}:1, which no longer fails AA`).toBeLessThan(
        AA_NORMAL_TEXT,
      )
      // Not merely "below AA": every one of these was invisible-grade, and a
      // helper that had drifted to returning ~4:1 for everything would satisfy
      // a bare toBeLessThan while measuring nothing real.
      expect(ratio).toBeLessThan(2)
    }
  })
})
