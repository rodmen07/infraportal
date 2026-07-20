/**
 * One page anatomy (v1.18.2 PR2, D7).
 *
 * Locks in the retirement of the full-viewport FocusCard section pattern
 * (finding F5): funnel pages now flow continuously, share one page-header
 * component, and end with exactly one closing CTA block instead of the
 * stacked HowItWorks + ContactCTA tail (finding F8). Source-scan assertions,
 * the established pattern in this repo (see tokens.test.ts, navigation.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const read = (rel: string) => stripComments(readFileSync(path.join(ROOT, rel), 'utf-8'))

// Every page that used to wrap its sections in the min-h-screen FocusCard.
const FUNNEL_PAGES = [
  'src/pages/AboutPage.tsx',
  'src/pages/ServicesPage.tsx',
  'src/pages/PricingPage.tsx',
  'src/pages/ContactPage.tsx',
  'src/pages/CaseStudiesPage.tsx',
  'src/pages/RetainersPage.tsx',
  'src/pages/CheckoutThankYouPage.tsx',
  'src/pages/LeadMagnetPage.tsx',
]

// Pages the audit (F5) called out as multi-viewport scroll walls.
const PAGES_ON_PAGEHEADER = [
  'src/pages/ServicesPage.tsx',
  'src/pages/CaseStudiesPage.tsx',
  'src/pages/PricingPage.tsx',
  'src/pages/ContactPage.tsx',
  'src/pages/CheckoutThankYouPage.tsx',
]

describe('D7: the full-viewport FocusCard pattern is retired', () => {
  it('the FocusCard component file no longer exists', () => {
    expect(existsSync(path.join(ROOT, 'src/features/layout/FocusCard.tsx'))).toBe(false)
  })

  it.each([...FUNNEL_PAGES, 'src/App.tsx'])('%s no longer imports FocusCard', (rel) => {
    expect(read(rel)).not.toMatch(/FocusCard/)
  })

  it.each(FUNNEL_PAGES)('%s carries no min-h-screen section wrapper', (rel) => {
    // The page shell (PageLayout / App) still owns one min-h-screen for the
    // page background; a content page must not stretch its sections to a
    // viewport each, which is the F5 pattern this milestone removes.
    expect(read(rel)).not.toMatch(/min-h-screen/)
  })
})

describe('D7: funnel pages adopt one page-header pattern', () => {
  it('the shared PageHeader component exists', () => {
    expect(existsSync(path.join(ROOT, 'src/features/site/PageHeader.tsx'))).toBe(true)
  })

  it.each(PAGES_ON_PAGEHEADER)('%s uses the shared PageHeader', (rel) => {
    expect(read(rel)).toMatch(/PageHeader/)
  })
})

describe('F8: exactly one closing CTA block, no stacked HowItWorks + ContactCTA tail', () => {
  // The repeated HowItWorksSection tail is removed from the funnel subpages;
  // it survives only on the home page as the canonical explainer.
  const SUBPAGES_WITHOUT_HOWITWORKS = [
    'src/pages/AboutPage.tsx',
    'src/pages/ServicesPage.tsx',
    'src/pages/PricingPage.tsx',
    'src/pages/ContactPage.tsx',
  ]

  it.each(SUBPAGES_WITHOUT_HOWITWORKS)('%s no longer stacks HowItWorksSection', (rel) => {
    expect(read(rel)).not.toMatch(/HowItWorksSection/)
  })

  it('the home page still owns the single HowItWorks explainer', () => {
    expect(read('src/App.tsx')).toMatch(/HowItWorksSection/)
  })

  it.each([
    'src/App.tsx',
    'src/pages/AboutPage.tsx',
    'src/pages/ServicesPage.tsx',
    'src/pages/PricingPage.tsx',
    'src/pages/CaseStudiesPage.tsx',
    'src/pages/RetainersPage.tsx',
  ])('%s renders ContactCTA at most once as the closing block', (rel) => {
    const matches = read(rel).match(/<ContactCTA\b/g) ?? []
    expect(matches.length).toBeLessThanOrEqual(1)
  })
})
