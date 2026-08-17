/**
 * TOPOLOGY-1: `--diagram-ink` clears the 3:1 non-text bar in BOTH themes on
 * the surface the topology diagram actually renders on.
 *
 * WHY THIS FILE EXISTS. The topology SVG paints its meaning-carrying strokes
 * (edges, arrowheads, legend swatches) through inline `style` attributes,
 * which sit outside every class-string scanner in this repo: colorThemeCoverage
 * and friends parse Tailwind utilities, so an inline `var(--...)` is invisible
 * to all of them. The first draft used `--border-strong` as line ink and
 * composited to 1.99:1 in light — under half the WCAG 1.4.11 bar — with every
 * suite green. Same measuring pattern as focusRingToken.test.ts: derive the
 * values and the compositing from tokens.css, pin only the bar.
 *
 * WCAG 1.4.11 (non-text contrast) sets 3:1 for graphical objects required to
 * understand the content. The diagram's edges and their dash-pattern
 * vocabulary are exactly that.
 */
import { describe, expect, it } from 'vitest'

import {
  compositeOver,
  contrastRatio,
  cssVariable,
  parseCssColor,
  relativeLuminance,
  SOURCE_ENTRIES,
  surfaceBackdrop,
} from '../../scripts/lib/themeContrast'

const NON_TEXT_MIN = 3

/** The diagram renders inside a .surface-card (CaseStudiesPage), so
 * --surface-1 is the backdrop that matters; --surface-2 is measured too so a
 * future move onto a strong card cannot silently regress. */
const SURFACES = ['surface-1', 'surface-2'] as const

function inkRatio(theme: 'light' | 'dark', surface: (typeof SURFACES)[number]): number {
  const backdrop = surfaceBackdrop(theme, surface)
  const ink = compositeOver(parseCssColor(cssVariable(theme, 'diagram-ink')), backdrop)
  return contrastRatio(ink, backdrop)
}

describe('--diagram-ink clears the non-text contrast bar in both themes', () => {
  it('reads the theme blocks it claims to read', () => {
    expect(relativeLuminance(surfaceBackdrop('light'))).toBeGreaterThan(0.5)
    expect(relativeLuminance(surfaceBackdrop('dark'))).toBeLessThan(0.1)
    expect(cssVariable('light', 'diagram-ink')).not.toBe(cssVariable('dark', 'diagram-ink'))

    // Printed on every run so the next reader can re-derive the numbers.
    for (const theme of ['light', 'dark'] as const) {
      console.log(
        `${theme} --diagram-ink ${cssVariable(theme, 'diagram-ink')}: ` +
          SURFACES.map((s) => `--${s} ${inkRatio(theme, s).toFixed(2)}:1`).join(', '),
      )
    }
  })

  it.each(
    (['light', 'dark'] as const).flatMap((theme) => SURFACES.map((s) => [theme, s] as const)),
  )('%s --diagram-ink clears 3:1 on --%s', (theme, surface) => {
    const ratio = inkRatio(theme, surface)
    expect(
      ratio,
      `${theme} --diagram-ink is ${cssVariable(theme, 'diagram-ink')}; on --${surface} it ` +
        `composites to ${ratio.toFixed(2)}:1, under the ${NON_TEXT_MIN}:1 WCAG 1.4.11 bar ` +
        'for meaning-carrying graphics. This is the defect --border-strong had as line ink.',
    ).toBeGreaterThanOrEqual(NON_TEXT_MIN)
  })

  it('is measuring a token something actually paints with', () => {
    // Inline styles are the whole reason this file exists, so the consumer
    // discovery greps for the inline spelling; empty discovery is a failure,
    // never a silent pass (L-031).
    const consumers = SOURCE_ENTRIES.filter(({ source }) =>
      source.includes('var(--diagram-ink)'),
    ).map(({ rel }) => rel)
    expect(
      consumers.length,
      'no source file paints with var(--diagram-ink); a ratio on an unused token guards nothing',
    ).toBeGreaterThan(0)
  })
})
