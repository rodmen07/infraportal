/**
 * D8 regression test (v1.18.3): canonical discovery offer + single
 * first-person voice.
 *
 * Before this milestone (docs/design/V1_18_UX_THEME.md finding F7, section
 * 7 D8), whether discovery was free or paid was unresolved across the
 * highest-intent pages (ContactPage said "free", HeroSection's fallback CTA
 * said "Start paid discovery", ContactCTA's heading said "Start a paid
 * engagement"), and voice flipped between first-person "I" (HeroSection,
 * HowItWorksSection, ContactCTA) and "we" (ServicesPage, ContactCTA). D8
 * resolved both: "free 30-minute discovery call" everywhere, first-person
 * "I" throughout. Source-scan assertions, matching this repo's established
 * pattern (see tokens.test.ts, pageAnatomy.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

// Every marketing/funnel surface the F7 audit and this milestone's copy
// pass touched. Deliberately excludes CrmAdminPage/PortalPage/UserDashboard
// (out of scope per the v1.18 doc's "scope creep" risk mitigation) and
// PortalForgotPasswordPage (the client portal's own transactional copy, a
// different product surface, not the consultant's marketing voice).
//
// ProofStrip.tsx and MotionPreferenceToggle.tsx (both PR #36 additions) were
// omitted here at first land - a QA adversarial review of that PR caught the
// gap: both carry visitor-facing marketing prose and had zero voice coverage.
const VOICE_CHECKED_FILES = [
  'src/App.tsx',
  'src/features/site/HeroSection.tsx',
  'src/features/site/HowItWorksSection.tsx',
  'src/features/site/ContactCTA.tsx',
  'src/features/site/AboutHero.tsx',
  'src/features/site/ProofStrip.tsx',
  'src/features/site/MotionPreferenceToggle.tsx',
  // v1.20.3 (D-3): the site footer is visitor-facing marketing copy on EVERY
  // route, so it is enrolled at first land rather than after a QA review
  // catches the gap, which is what happened to the two entries above.
  'src/features/layout/SiteFooter.tsx',
  'src/pages/ServicesPage.tsx',
  'src/pages/ContactPage.tsx',
  'src/pages/PricingPage.tsx',
  'src/pages/CaseStudiesPage.tsx',
  'src/pages/RetainersPage.tsx',
]

describe('D8: VOICE_CHECKED_FILES stays current with new marketing surfaces', () => {
  // Regression proof for the coverage gap above: this PR's own new
  // components must be enrolled in the voice guard, not just future ones.
  it('includes ProofStrip.tsx and MotionPreferenceToggle.tsx', () => {
    expect(VOICE_CHECKED_FILES).toEqual(
      expect.arrayContaining(['src/features/site/ProofStrip.tsx', 'src/features/site/MotionPreferenceToggle.tsx']),
    )
  })
})

describe('D8: no "paid discovery" contradiction survives', () => {
  it.each(VOICE_CHECKED_FILES)('%s never frames the discovery call as paid', (rel) => {
    const src = read(rel)
    expect(src).not.toMatch(/paid discovery/i)
    expect(src).not.toMatch(/start a paid engagement/i)
  })

  it('ContactPage still states the canonical free 30-minute discovery call', () => {
    expect(read('src/pages/ContactPage.tsx')).toMatch(/free 30-minute discovery call/i)
  })
})

describe('D8: single first-person voice ("I", not "we") on funnel copy', () => {
  // \bwe\b also matches inside words like "we're"/"we'll"; that is
  // intentional, both are still first-person-plural. \bus\b was added after
  // a QA adversarial review of PR #36 found the pattern let the objective
  // case of the same plural pronoun ("reach us", "contact us") straight
  // through; \b word boundaries keep it from matching inside "focus",
  // "discuss", "trust", or "custom".
  const WE_PATTERN = /\bwe\b|\bwe'll\b|\bwe're\b|\bour\b|\bus\b/i

  it.each(VOICE_CHECKED_FILES)('%s carries no "we"/"our"/"us" marketing voice', (rel) => {
    const src = read(rel)
    // Strip JS/TSX comments so code-comment pronouns (which are not
    // rendered copy) cannot fail this assertion.
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(withoutComments).not.toMatch(WE_PATTERN)
  })

  it('catches a plural-voice phrase using "us" that the pre-fix pattern missed', () => {
    const oldPattern = /\bwe\b|\bwe'll\b|\bwe're\b|\bour\b/i
    const samplePlural = 'Have a project in mind? Reach us any time.'
    // Proves the regression this pattern used to let through.
    expect(oldPattern.test(samplePlural)).toBe(false)
    expect(WE_PATTERN.test(samplePlural)).toBe(true)
  })

  it('does not false-positive on words merely containing "us" as a substring', () => {
    const sampleSingular = 'I focus on trust, discuss scope, and keep custom work honest.'
    expect(WE_PATTERN.test(sampleSingular)).toBe(false)
  })
})
