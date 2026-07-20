/**
 * F9 regression test (v1.18.3): shareability metadata + proof strip.
 *
 * Before this milestone (docs/design/V1_18_UX_THEME.md finding F9), Home
 * showed zero social proof above the fold and index.html had no meta
 * description and no OpenGraph/Twitter card tags, so sharing the portfolio
 * produced a bare link with no preview. This locks in: the meta tags exist,
 * they reference a real committed image (not a path that would 404), and
 * Home renders a proof strip. Source-scan assertions, matching this repo's
 * established pattern (see tokens.test.ts, themeDefault.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')
const INDEX_HTML = read('index.html')

function metaContent(attr: 'name' | 'property', key: string): string | null {
  const re = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)
  return re.exec(INDEX_HTML)?.[1] ?? null
}

describe('F9: index.html carries a real description + OpenGraph/Twitter cards', () => {
  it('has a non-empty meta description', () => {
    const description = metaContent('name', 'description')
    expect(description).not.toBeNull()
    expect(description!.length).toBeGreaterThan(20)
  })

  it('has the required OpenGraph tags', () => {
    expect(metaContent('property', 'og:type')).toBe('website')
    expect(metaContent('property', 'og:title')).not.toBeNull()
    expect(metaContent('property', 'og:description')).not.toBeNull()
    expect(metaContent('property', 'og:url')).toMatch(/^https:\/\//)
    expect(metaContent('property', 'og:image')).toMatch(/^https:\/\//)
  })

  it('has the required Twitter card tags, using summary_large_image', () => {
    expect(metaContent('name', 'twitter:card')).toBe('summary_large_image')
    expect(metaContent('name', 'twitter:title')).not.toBeNull()
    expect(metaContent('name', 'twitter:description')).not.toBeNull()
    expect(metaContent('name', 'twitter:image')).toMatch(/^https:\/\//)
  })

  it('og:image and twitter:image point at the same real, committed asset (no 404-prone path)', () => {
    const ogImage = metaContent('property', 'og:image')!
    const twitterImage = metaContent('name', 'twitter:image')!
    expect(ogImage).toBe(twitterImage)

    // The URL is absolute (required by the OG/Twitter spec) and rooted at
    // the deployed GitHub Pages base (vite.config.js sets base:
    // '/infraportal/' in production); strip that prefix to find the file
    // under public/, which Vite copies to the site root at build time.
    const imagePath = new URL(ogImage).pathname.replace(/^\/infraportal\//, '')
    expect(existsSync(path.join(ROOT, 'public', imagePath)), `public/${imagePath} should exist on disk`).toBe(true)
  })

  it('is not an SVG (Twitter Cards does not support SVG for twitter:image)', () => {
    const twitterImage = metaContent('name', 'twitter:image')!
    expect(twitterImage).not.toMatch(/\.svg$/i)
  })
})

describe('F9: Home renders a proof strip above the closing CTA', () => {
  it('ProofStrip.tsx exists and is mounted on the home page between the hero and the explainer', () => {
    expect(existsSync(path.join(ROOT, 'src/features/site/ProofStrip.tsx'))).toBe(true)
    const appSrc = read('src/App.tsx')
    const heroIndex = appSrc.indexOf('<HeroSection')
    const proofIndex = appSrc.indexOf('<ProofStrip')
    const howItWorksIndex = appSrc.indexOf('<HowItWorksSection')
    expect(heroIndex).toBeGreaterThan(-1)
    expect(proofIndex).toBeGreaterThan(heroIndex)
    expect(howItWorksIndex).toBeGreaterThan(proofIndex)
  })

  it('the proof strip links out to real case studies, GitHub, and crates.io evidence', () => {
    const proofSrc = read('src/features/site/ProofStrip.tsx')
    expect(proofSrc).toMatch(/#\/case-studies/)
    expect(proofSrc).toMatch(/github\.com\/rodmen07/)
    expect(proofSrc).toMatch(/crates\.io\/crates\//)
  })
})
