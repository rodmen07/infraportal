/**
 * Open-source crates showcase (About page), added to portfolio content: an
 * autodev increment approved by the user to surface the three real,
 * published, open-source Rust crates (svccat, slokit, axum-api-kit) as
 * portfolio content, distinct from the Theme C guided-demo-tours deferral in
 * docs/design/V1_18_UX_THEME.md section 6 - this showcases the actual
 * open-source work, not a product demo.
 *
 * Repo's vitest config runs `environment: 'node'` with no react-testing-
 * library dependency and only collects `src/**\/*.test.ts` (not `.test.tsx`),
 * so this follows the established source-scan pattern (see
 * contactFormShortening.test.ts, voiceAndOffer.test.ts, tokens.test.ts)
 * rather than rendering JSX.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

const CRATES_SRC = read('src/features/site/OpenSourceCrates.tsx')
const ABOUT_PAGE_SRC = read('src/pages/AboutPage.tsx')

const CRATE_NAMES = ['svccat', 'slokit', 'axum-api-kit'] as const

describe('AboutPage renders the open-source crates showcase', () => {
  it('imports and renders <OpenSourceCrates />', () => {
    expect(ABOUT_PAGE_SRC).toMatch(/import \{ OpenSourceCrates \} from '\.\.\/features\/site\/OpenSourceCrates'/)
    expect(ABOUT_PAGE_SRC).toMatch(/<OpenSourceCrates \/>/)
  })

  it('does not touch the fenced-off admin pages', () => {
    expect(ABOUT_PAGE_SRC).not.toMatch(/CrmAdminPage|PortalPage/)
  })
})

describe('every crate has real crates.io, docs.rs, and GitHub links', () => {
  it.each(CRATE_NAMES)('%s links to crates.io/%s', (name) => {
    expect(CRATES_SRC).toContain(`https://crates.io/crates/${name}`)
  })

  it.each(CRATE_NAMES)('%s links to docs.rs/%s', (name) => {
    expect(CRATES_SRC).toContain(`https://docs.rs/${name}`)
  })

  it.each(CRATE_NAMES)('%s links to github.com/rodmen07/%s', (name) => {
    expect(CRATES_SRC).toContain(`https://github.com/rodmen07/${name}`)
  })

  it.each(CRATE_NAMES)('%s has a real shields.io downloads badge', (name) => {
    expect(CRATES_SRC).toContain(`https://img.shields.io/crates/d/${name}.svg`)
  })
})

describe('crate versions are pinned to a specific string per crate (regression anchor)', () => {
  // The infraportal repo does not check out the sibling cargo_crates repos in
  // CI, so this deliberately does not cross-reference their Cargo.toml files
  // (that would pass locally and fail on every CI run with no sibling repo
  // present). Versions were manually verified against each crate's real
  // Cargo.toml `[package].version` at authoring time (svccat 1.5.0, slokit
  // 1.0.0, axum-api-kit 1.4.0); this test only pins them so a future edit
  // cannot silently drift without a reviewer noticing the diff.
  it('svccat 1.5.0', () => {
    expect(CRATES_SRC).toMatch(/name: 'svccat',\s*version: '1\.5\.0'/)
  })

  it('slokit 1.0.0', () => {
    expect(CRATES_SRC).toMatch(/name: 'slokit',\s*version: '1\.0\.0'/)
  })

  it('axum-api-kit 1.4.0', () => {
    expect(CRATES_SRC).toMatch(/name: 'axum-api-kit',\s*version: '1\.4\.0'/)
  })
})

describe('every outbound crate link is tracked, following the ProofStrip precedent', () => {
  it('imports trackPortfolioEvent', () => {
    expect(CRATES_SRC).toMatch(/import \{ trackPortfolioEvent \} from '\.\.\/\.\.\/utils\/analytics'/)
  })

  it('fires consulting_cta_click with a shared location key from one handler shared by every link', () => {
    // Non-greedy [\s\S]*?\}\) rather than [^}]*\}\): the object's own `label`
    // field is a template literal containing `${crate.name} ${link.label}`,
    // which has intermediate `}` characters from the interpolation, so a
    // naive [^}]* would truncate the match before the object's real closing
    // brace (the same opaque-template-literal shape the backlog's own
    // opacityColorThemeCoverage.test.ts header documents as a scanner
    // hazard). `\}\)` only matches a `}` immediately followed by `)`, which
    // in this source only occurs at each call's true closing `})`.
    //
    // Exactly ONE call site in source (not 9): the onClick handler lives
    // inside a single `.map()` over each crate's `links` array, so all 3
    // crates x 3 links (crates.io/docs.rs/GitHub) = 9 real clicks at runtime
    // share one written call, rather than 9 hand-duplicated onClick props -
    // the DRY shape this repo's own component-authoring bar expects.
    const matches = [...CRATES_SRC.matchAll(/trackPortfolioEvent\('consulting_cta_click',\s*\{([\s\S]*?)\}\)/g)]
    expect(matches.length).toBe(1)
    expect(matches[0][1]).toContain("location: 'open-source-crates'")
    expect(matches[0][1]).toMatch(/label: `\$\{crate\.name\} \$\{link\.label\}`/)
  })
})

describe('uses only shared primitives and token classes, no new raw opacity-suffixed colour utilities', () => {
  it('imports the shared Card and Button primitives rather than inventing new markup', () => {
    expect(CRATES_SRC).toMatch(/import \{ Card \} from '\.\.\/\.\.\/components\/ui\/Card'/)
    expect(CRATES_SRC).toMatch(/import \{ Button \} from '\.\.\/\.\.\/components\/ui\/Button'/)
  })

  it('introduces no text-[10px]/text-[11px] arbitrary sizes (12px type-scale floor)', () => {
    expect(CRATES_SRC).not.toMatch(/text-\[(10|11)px\]/)
  })

  it('the outer section wrapper reuses the exact already-shipped, both-theme-safe ProofStrip panel classes', () => {
    // Same class string ProofStrip.tsx (v1.18.3) already ships with, minus
    // `reveal` (an above-the-fold hero entrance animation not used elsewhere
    // on the About page) - inherits existing theme coverage instead of
    // introducing a new untested class combination.
    expect(CRATES_SRC).toContain(
      'forge-panel surface-card rounded-3xl border border-zinc-500/30 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8',
    )
  })
})
