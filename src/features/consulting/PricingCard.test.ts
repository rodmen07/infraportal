/**
 * Regression lock for PricingCard's v1.18.4 token migration (finding F2,
 * mechanism 2: "per-component JS branching on useTheme() with parallel
 * dark/light class records"). Source-scan style, matching the repo's
 * established pattern (tokens.css comment header, tokens.test.ts) for
 * asserting a component's *shape* without a React render harness (the
 * vitest config runs environment: 'node' and only collects `*.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SOURCE = readFileSync(path.join(process.cwd(), 'src/features/consulting/PricingCard.tsx'), 'utf-8')

describe('PricingCard no longer branches on theme in JS', () => {
  it('does not import useTheme', () => {
    expect(SOURCE).not.toMatch(/useTheme/)
  })

  it('has no isLight branch or parallel dark/light style records', () => {
    expect(SOURCE).not.toMatch(/isLight/)
    expect(SOURCE).not.toMatch(/darkCardStyles|lightCardStyles|darkPriceStyles|lightPriceStyles|darkCtaStyles|lightCtaStyles/)
  })

  it('uses the shared Badge and Button primitives instead of ad hoc pill/CTA markup', () => {
    expect(SOURCE).toMatch(/from '\.\.\/\.\.\/components\/ui\/Badge'/)
    expect(SOURCE).toMatch(/from '\.\.\/\.\.\/components\/ui\/Button'/)
  })

  it('reads card emphasis from accent tokens, not raw amber/orange Tailwind utilities', () => {
    expect(SOURCE).toMatch(/accent-line|accent-soft/)
    // The two named v1.18.4 contrast-bug classes must not reappear here.
    expect(SOURCE).not.toMatch(/border-amber-400\/30|border-amber-400\/60/)
  })
})
