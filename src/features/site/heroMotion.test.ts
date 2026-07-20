/**
 * D6 regression test (v1.18.3): calm hero motion.
 *
 * Before this milestone (docs/design/V1_18_UX_THEME.md finding F6, section
 * 7 D6), the hero rendered an infinitely pulsing, wiggling gradient badge
 * whose only payoff was a slide-over containing the animation-preference
 * checkbox, plus a floating h1 - a promotional presentation that
 * outcompeted the actual booking CTA for attention. Source-scan assertions,
 * the established pattern in this repo (see tokens.test.ts,
 * pageAnatomy.test.ts): vitest runs in a `node` environment with no React
 * render harness (D11 did not add one), so structure is verified from the
 * source rather than a mounted component.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')
const readCode = (rel: string) => stripComments(read(rel))

// Explanatory comments in HeroSection.tsx and index.css deliberately name
// the retired classes (documenting what moved and why), so assertions about
// live code must strip comments first or they would fail on the very
// documentation this milestone requires.
const HERO_SRC = readCode('src/features/site/HeroSection.tsx')
const INDEX_CSS = readCode('src/index.css')

describe('D6: the hero retires its infinite-loop flourishes', () => {
  it('no longer renders the pulsing gradient badge, the wiggle emoji, or the floating h1', () => {
    expect(HERO_SRC).not.toMatch(/animate-pulse-strong/)
    expect(HERO_SRC).not.toMatch(/animate-wiggle/)
    expect(HERO_SRC).not.toMatch(/animate-float-slow/)
    expect(HERO_SRC).not.toMatch(/animate-pop/)
    expect(HERO_SRC).not.toMatch(/glow-ring/)
  })

  it('no longer imports SlideOver or manages a motion-preference slide-over from the hero', () => {
    expect(HERO_SRC).not.toMatch(/SlideOver/)
    expect(HERO_SRC).not.toMatch(/motionEnabled/)
  })

  it('the now fully-unused infinite-loop keyframes are deleted from index.css, not left dead', () => {
    expect(INDEX_CSS).not.toMatch(/@keyframes pulse-strong/)
    expect(INDEX_CSS).not.toMatch(/@keyframes float-y/)
    expect(INDEX_CSS).not.toMatch(/@keyframes wiggle/)
    expect(INDEX_CSS).not.toMatch(/@keyframes pop-in/)
    expect(INDEX_CSS).not.toMatch(/\.glow-ring/)
  })

  it('keeps the one-time .reveal entrance, which is reduced-motion safe', () => {
    expect(HERO_SRC).toMatch(/\breveal\b/)
    expect(INDEX_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    // The reduced-motion block must still cover .reveal (the surviving
    // one-time entrance), even after the infinite-loop classes are pruned
    // from its selector list.
    const reducedMotionBlock = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)
    expect(reducedMotionBlock, 'reduced-motion media block should exist').not.toBeNull()
    expect(reducedMotionBlock![1]).toMatch(/\.reveal\b/)
  })
})

describe('D6: the animation preference control moved to the About page', () => {
  it('MotionPreferenceToggle.tsx exists and owns the motionEnabled/data-motion mechanism', () => {
    expect(existsSync(path.join(ROOT, 'src/features/site/MotionPreferenceToggle.tsx'))).toBe(true)
    const toggleSrc = read('src/features/site/MotionPreferenceToggle.tsx')
    expect(toggleSrc).toMatch(/motionEnabled/)
    expect(toggleSrc).toMatch(/data-motion/)
  })

  it('AboutPage renders the relocated toggle', () => {
    const aboutSrc = read('src/pages/AboutPage.tsx')
    expect(aboutSrc).toMatch(/MotionPreferenceToggle/)
  })
})
