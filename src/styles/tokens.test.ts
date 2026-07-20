/**
 * Token integrity test (v1.18.1 PR1).
 *
 * Finding F1 of the v1.18 UX audit (docs/design/V1_18_UX_THEME.md section 2):
 * `surface-card` and `surface-card-strong` were used across pages but
 * defined nowhere; `forge-panel`, `forge-grid`, and `interactive-card`
 * existed only as [data-theme="light"] overrides with no dark-mode base
 * style, so panels using them rendered with no background and no border in
 * dark mode. This test asserts each of the five named classes now has a
 * real rule in src/styles/tokens.css, and that the semantic role variables
 * those rules are built from have a value in both the dark and light
 * blocks. It also anticipates the v1.18.1 PR2 "token integrity test"
 * (scan src/**\/*.tsx for named surface classes, assert each has a CSS
 * definition): the scan-usage-then-assert-definition shape here is the same
 * one that later test formalizes repo-wide.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const TOKENS_CSS_PATH = path.join(process.cwd(), 'src/styles/tokens.css')
const TOKENS_CSS = readFileSync(TOKENS_CSS_PATH, 'utf-8')

// The exact classes named in the v1.18.1 PR1 scope and flagged as ghosts by
// finding F1 of the audit.
const NAMED_SURFACE_CLASSES = [
  'forge-grid',
  'forge-panel',
  'surface-card',
  'surface-card-strong',
  'interactive-card',
] as const

// Pages the audit cites as rendering invisible panels in dark mode (F1,
// section 2, with file:line citations). If any named class ever loses its
// definition, these pages go back to floating text with no background.
const AUDIT_CITED_FILES = [
  'src/pages/PageLayout.tsx',
  'src/pages/ApiDocsPage.tsx',
  'src/pages/PatchNotesPage.tsx',
  'src/pages/CaseStudiesPage.tsx',
  'src/pages/ServicesPage.tsx',
  'src/pages/ContactPage.tsx',
]

// Semantic role variables that must differ (or at least be re-declared) per
// theme so the five classes above render correctly in both.
const THEMED_ROLE_VARIABLES = [
  '--surface-0',
  '--surface-1',
  '--surface-2',
  '--border-soft',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent',
  '--accent-contrast',
  '--success',
  '--warning',
  '--danger',
] as const

/** The body of the first standalone `.className { ... }` rule (not a
 * `:hover`/`:focus` variant, and not a longer hyphenated class that merely
 * starts with the same name, e.g. `.surface-card` vs `.surface-card-strong`). */
function baseRuleFor(className: string): string {
  const selectorPattern = new RegExp(`\\.${className}(?![\\w-])\\s*\\{`)
  const match = selectorPattern.exec(TOKENS_CSS)
  if (!match) {
    throw new Error(`No base rule found for .${className} in ${TOKENS_CSS_PATH}`)
  }
  const openBrace = match.index + match[0].length - 1
  const closeBrace = TOKENS_CSS.indexOf('}', openBrace)
  return TOKENS_CSS.slice(openBrace + 1, closeBrace)
}

/** The body of the first `{ ... }` block following a given selector text. */
function blockFor(selectorSnippet: string): string {
  const selectorIndex = TOKENS_CSS.indexOf(selectorSnippet)
  if (selectorIndex === -1) {
    throw new Error(`Selector not found in tokens.css: ${selectorSnippet}`)
  }
  const openBrace = TOKENS_CSS.indexOf('{', selectorIndex)
  const closeBrace = TOKENS_CSS.indexOf('}', openBrace)
  return TOKENS_CSS.slice(openBrace + 1, closeBrace)
}

describe('tokens.css - named surface classes have real definitions (F1)', () => {
  it.each(NAMED_SURFACE_CLASSES)('.%s is defined with a fill or a border', (className) => {
    const body = baseRuleFor(className)
    const hasFill = /background(-color)?\s*:/.test(body)
    const hasBorder = /border(-color)?\s*:/.test(body)
    expect(hasFill || hasBorder).toBe(true)
  })

  it.each(NAMED_SURFACE_CLASSES)('.%s does not introduce a new !important rule', (className) => {
    const body = baseRuleFor(className)
    expect(body).not.toMatch(/!important/)
  })
})

describe('tokens.css - semantic roles are defined for both themes', () => {
  const darkBlock = blockFor('[data-theme="dark"]')
  const lightBlock = blockFor('[data-theme="light"]')

  it.each(THEMED_ROLE_VARIABLES)('%s has a value in the dark block', (variable) => {
    expect(darkBlock.includes(`${variable}:`)).toBe(true)
  })

  it.each(THEMED_ROLE_VARIABLES)('%s has a value in the light block', (variable) => {
    expect(lightBlock.includes(`${variable}:`)).toBe(true)
  })
})

describe('tokens.css is imported before index.css (cascade order)', () => {
  // tokens.css intentionally has no @layer wrapper (Tailwind's @layer
  // requires a matching @tailwind directive in the same PostCSS-processed
  // file, which broke both when tokens.css was inlined via a CSS @import
  // and when it was its own JS-imported module with its own @tailwind
  // directives). Instead, plain import order in main.tsx puts these rules
  // earlier in the final stylesheet than index.css's `@tailwind utilities`
  // expansion, so a same-specificity Tailwind utility placed alongside one
  // of the five classes still wins. If tokens.css were ever imported after
  // index.css, that guarantee would flip.
  it('main.tsx imports styles/tokens.css before index.css', () => {
    const mainSource = readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf-8')
    const tokensImportIndex = mainSource.indexOf("import './styles/tokens.css'")
    const indexCssImportIndex = mainSource.indexOf("import './index.css'")
    expect(tokensImportIndex).toBeGreaterThan(-1)
    expect(indexCssImportIndex).toBeGreaterThan(-1)
    expect(tokensImportIndex).toBeLessThan(indexCssImportIndex)
  })
})

describe('audit-cited pages (F1) use classes that now resolve to a real rule', () => {
  it.each(AUDIT_CITED_FILES)('%s references at least one named surface class, and it is defined', (relPath) => {
    const source = readFileSync(path.join(process.cwd(), relPath), 'utf-8')
    const usedClasses = NAMED_SURFACE_CLASSES.filter((className) =>
      new RegExp(`(^|[\\s"'\`])${className}(?![\\w-])`).test(source),
    )
    expect(usedClasses.length).toBeGreaterThan(0)
    for (const className of usedClasses) {
      expect(() => baseRuleFor(className)).not.toThrow()
    }
  })
})
