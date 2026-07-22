/**
 * Token integrity test (v1.18.1 PR1, widened repo-wide in PR2).
 *
 * Finding F1 of the v1.18 UX audit (docs/design/V1_18_UX_THEME.md section 2):
 * `surface-card` and `surface-card-strong` were used across pages but
 * defined nowhere; `forge-panel`, `forge-grid`, and `interactive-card`
 * existed only as [data-theme="light"] overrides with no dark-mode base
 * style, so panels using them rendered with no background and no border in
 * dark mode.
 *
 * PR1 gave the five named classes real, token-built definitions and asserted
 * that over the handful of files the audit cited. PR2 widens the scan to
 * every src/**\/*.tsx: any class in a design-system namespace that appears in
 * a component must resolve to a real rule in the CSS source, so a ghost class
 * can never ship again - including one nobody has written yet.
 *
 * It also locks in the PR2 strangler-rule deletions (F2): the override-sheet
 * rules for the surfaces migrated onto tokens are gone and must not come
 * back, and `.interactive-card` may never again be declared twice for light
 * mode (the sheet contradicting itself, with the later sky-blue rule winning
 * against the amber system in D4).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TOKENS_CSS_PATH = path.join(ROOT, 'src/styles/tokens.css')
const INDEX_CSS_PATH = path.join(ROOT, 'src/index.css')
const TOKENS_CSS = readFileSync(TOKENS_CSS_PATH, 'utf-8')
const INDEX_CSS = readFileSync(INDEX_CSS_PATH, 'utf-8')

/** CSS with `/* ... *\/` comments removed, so a selector *named* in a
 * "deleted in PR2" comment is never mistaken for a live declaration. */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '')
const TOKENS_CSS_RULES = stripComments(TOKENS_CSS)
const INDEX_CSS_RULES = stripComments(INDEX_CSS)

/** Every stylesheet a class definition may legitimately live in. */
const CSS_SOURCES: Array<{ label: string; source: string }> = [
  { label: 'src/styles/tokens.css', source: TOKENS_CSS_RULES },
  { label: 'src/index.css', source: INDEX_CSS_RULES },
]

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
// theme so the classes and token utilities render correctly in both.
const THEMED_ROLE_VARIABLES = [
  '--surface-0',
  '--surface-1',
  '--surface-2',
  '--control-bg',
  '--surface-hover',
  '--border-soft',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent',
  '--accent-contrast',
  '--accent-soft',
  '--accent-soft-hover',
  '--accent-line',
  '--accent-line-hover',
  '--accent-text',
  '--focus-ring',
  '--grid-line-x',
  '--grid-line-y',
  '--field-bg',
  '--field-placeholder',
  '--neutral-bg',
  '--neutral-border',
  '--chip-bg',
  '--chip-border',
  '--success',
  '--warning',
  '--danger',
  // v1.18.4: status soft/line/text triples the Badge primitive consumes.
  '--success-soft',
  '--success-line',
  '--success-text',
  '--warning-soft',
  '--warning-line',
  '--warning-text',
  '--danger-soft',
  '--danger-line',
  '--danger-text',
  '--caution',
  '--caution-soft',
  '--caution-line',
  '--caution-text',
  '--info',
  '--info-soft',
  '--info-line',
  '--info-text',
] as const

/**
 * Class-name namespaces this design system owns. Any class in a component
 * whose name starts with one of these prefixes is ours, not a Tailwind
 * utility, so it must have a CSS rule somewhere. Adding a namespace here is
 * how a future family of semantic classes joins the guarantee.
 */
const OWNED_CLASS_PREFIXES = [
  'forge-',
  'surface-card',
  'interactive-card',
  'fx-',
  'btn-',
  'field-',
  'glow-',
  'about-fact-',
] as const

/**
 * Classes matching an owned prefix that are deliberately not CSS rules.
 * `field-*` is also a Tailwind-ish word in a few places, so anything listed
 * here is an explicit, reviewed exception rather than a silent miss.
 */
const OWNED_PREFIX_EXCEPTIONS = new Set<string>([])

/** The body of the first standalone `.className { ... }` rule in `source`
 * (not a `:hover`/`:focus` variant, and not a longer hyphenated class that
 * merely starts with the same name, e.g. `.surface-card` vs
 * `.surface-card-strong`). Returns null when there is no such rule. */
function baseRuleIn(source: string, className: string): string | null {
  const selectorPattern = new RegExp(`(^|[\\s,>+~])\\.${className}(?![\\w-])\\s*(,[^{]*)?\\{`, 'm')
  const match = selectorPattern.exec(source)
  if (!match) return null
  const openBrace = match.index + match[0].length - 1
  const closeBrace = source.indexOf('}', openBrace)
  return source.slice(openBrace + 1, closeBrace)
}

/** The body of the first standalone rule for `className` in tokens.css. */
function baseRuleFor(className: string): string {
  const body = baseRuleIn(TOKENS_CSS, className)
  if (body === null) {
    throw new Error(`No base rule found for .${className} in ${TOKENS_CSS_PATH}`)
  }
  return body
}

/** Which stylesheet, if any, defines `className`. */
function definitionSourceFor(className: string): string | null {
  for (const { label, source } of CSS_SOURCES) {
    if (baseRuleIn(source, className) !== null) return label
  }
  return null
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

/** Every .tsx file under src/, relative to the repo root, sorted. */
function allComponentFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allComponentFiles(relPath))
    else if (entry.name.endsWith('.tsx')) found.push(relPath)
  }
  return found.sort()
}

const COMPONENT_FILES = allComponentFiles()

/**
 * Class-like tokens used by a component. Reads every string and template
 * literal, splits on whitespace, and keeps only well-formed class names, so
 * an interpolated fragment (`reveal-delay-${n}`) is dropped rather than
 * reported as an undefined class.
 */
function classTokensIn(source: string): Set<string> {
  const tokens = new Set<string>()
  const literalPattern = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g
  let match: RegExpExecArray | null
  while ((match = literalPattern.exec(source)) !== null) {
    const literal = match[1] ?? match[2] ?? match[3] ?? ''
    for (const raw of literal.split(/[\s]+/)) {
      // Strip Tailwind variant prefixes (hover:, sm:, [data-x]:) so
      // `hover:btn-accent` is judged as `btn-accent`.
      const candidate = raw.slice(raw.lastIndexOf(':') + 1)
      if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(candidate)) tokens.add(candidate)
    }
  }
  return tokens
}

/** Owned (design-system) class names a component references. */
function ownedClassesIn(source: string): string[] {
  return [...classTokensIn(source)].filter(
    (token) =>
      OWNED_CLASS_PREFIXES.some((prefix) => token.startsWith(prefix)) &&
      !OWNED_PREFIX_EXCEPTIONS.has(token),
  )
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
  // of the classes still wins. If tokens.css were ever imported after
  // index.css, that guarantee would flip.
  it('main.tsx imports styles/tokens.css before index.css', () => {
    const mainSource = readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf-8')
    const tokensImportIndex = mainSource.indexOf("import './styles/tokens.css'")
    const indexCssImportIndex = mainSource.indexOf("import './index.css'")
    expect(tokensImportIndex).toBeGreaterThan(-1)
    expect(indexCssImportIndex).toBeGreaterThan(-1)
    expect(tokensImportIndex).toBeLessThan(indexCssImportIndex)
  })
})

describe('audit-cited pages (F1) use classes that now resolve to a real rule', () => {
  it.each(AUDIT_CITED_FILES)('%s references at least one named surface class, and it is defined', (relPath) => {
    const source = readFileSync(path.join(ROOT, relPath), 'utf-8')
    const usedClasses = NAMED_SURFACE_CLASSES.filter((className) =>
      new RegExp(`(^|[\\s"'\`])${className}(?![\\w-])`).test(source),
    )
    expect(usedClasses.length).toBeGreaterThan(0)
    for (const className of usedClasses) {
      expect(() => baseRuleFor(className)).not.toThrow()
    }
  })
})

describe('no ghost classes anywhere in src/**/*.tsx (F1, repo-wide)', () => {
  it('finds components to scan', () => {
    expect(COMPONENT_FILES.length).toBeGreaterThan(40)
  })

  it.each(COMPONENT_FILES)('%s uses only design-system classes that have a CSS rule', (relPath) => {
    const source = readFileSync(path.join(ROOT, relPath), 'utf-8')
    const undefinedClasses = ownedClassesIn(source).filter(
      (className) => definitionSourceFor(className) === null,
    )
    expect(
      undefinedClasses,
      undefinedClasses.length === 0
        ? ''
        : `Ghost class in ${relPath}: ${undefinedClasses
            .map((className) => `.${className}`)
            .join(', ')} - used in the component but not defined in ` +
          `${CSS_SOURCES.map((entry) => entry.label).join(' or ')}. Either add a ` +
          `token-built rule (preferred) or stop using the class.`,
    ).toEqual([])
  })

  it('the design system actually owns some classes in components', () => {
    const total = COMPONENT_FILES.reduce(
      (count, relPath) => count + ownedClassesIn(readFileSync(path.join(ROOT, relPath), 'utf-8')).length,
      0,
    )
    // Guards the scanner itself: if the extraction regex ever silently stops
    // matching, this drops to zero and the suite above would pass vacuously.
    expect(total).toBeGreaterThan(50)
  })
})

describe('strangler rule: override-sheet rules for tokenized surfaces stay deleted (F2)', () => {
  // v1.18.1 PR2 migrated these surfaces onto tokens and removed their
  // [data-theme="light"] copies. Re-adding one would mean a surface is being
  // patched by class name again instead of reading a role.
  const DELETED_OVERRIDE_SELECTORS = [
    '[data-theme="light"] .forge-grid',
    '[data-theme="light"] .interactive-card',
    '[data-theme="light"] nav',
    '[data-theme="light"] aside',
    '[data-theme="light"] .btn-accent',
    '[data-theme="light"] .btn-neutral',
    '[data-theme="light"] .fx-chip',
    '[data-theme="light"] input:focus-visible',
  ]

  it.each(DELETED_OVERRIDE_SELECTORS)('index.css no longer declares `%s`', (selector) => {
    const declarationPattern = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,{:]`,
    )
    expect(declarationPattern.test(INDEX_CSS_RULES)).toBe(false)
  })

  it('.interactive-card is themed only by tokens.css (F2 self-conflict)', () => {
    // tokens.css owns the one base rule (plus its :hover variant). index.css
    // may still reference the class in the prefers-reduced-motion selector
    // list, but must not paint it: two competing light-mode paint rules with
    // the later sky-blue one winning is exactly the F2 conflict this
    // resolves.
    const paintRules = (source: string) =>
      [...source.matchAll(/\.interactive-card(?![\w-])[^{]*\{([^}]*)\}/g)].filter(({ 1: body }) =>
        /(background|border-color|border\s*:)/.test(body),
      ).length
    expect(paintRules(TOKENS_CSS_RULES)).toBe(2) // base rule + :hover
    expect(paintRules(INDEX_CSS_RULES)).toBe(0)
  })

  it('the parallel --fx-* variable set (F2 mechanism 3) is gone', () => {
    expect(/--fx-[a-z-]+\s*:/.test(INDEX_CSS_RULES)).toBe(false)
    expect(/var\(--fx-/.test(INDEX_CSS_RULES)).toBe(false)
  })

  it('override-sheet status: real but partial progress in v1.18.4, not yet zero', () => {
    // Renamed from "the remaining override sheet is not deleted early" now
    // that we ARE in v1.18.4: that framing only made sense as a guard
    // against jumping the gun in v1.18.1-.3.
    //
    // v1.18.4 made two kinds of real, verified progress on this sheet:
    //  1. DELETIONS: the four dead "Pricing card highlight" gradient/ring
    //     rules (.from-amber-400\/10, .via-orange-300\/6, .to-amber-200\/8,
    //     .ring-amber-300\/20) were confirmed to have zero remaining
    //     consumers anywhere in src/**\/*.tsx (PricingCard.tsx, their only
    //     ever consumer, migrated onto the Badge/Button primitives) and
    //     deleted.
    //  2. ADDITIONS: fixing the two named repo-wide contrast bugs
    //     (`border-amber-400/30`/`/60`, `bg-emerald-500/10`) plus the
    //     ~80-class sweep widening src/styles/opacityColorThemeCoverage.test.ts
    //     to bg-*/border-* surfaced required MORE override rules, not
    //     fewer: those classes are still raw Tailwind utilities in roughly
    //     40 case-study/admin/portal files that have not been migrated onto
    //     semantic tokens, so a CSS-level override is the only fix that
    //     does not touch (and risk regressing) every one of those files in
    //     the same change. The sheet is measurably LARGER after v1.18.4
    //     than before it as a direct, deliberate result.
    //
    // Net effect: this count is expected to stay above zero after v1.18.4.
    // Full deletion needs a follow-up that migrates those ~40 files'
    // raw-utility colour classes onto the surface-*/text-*/border-*/accent-*
    // tokens (see docs/design/V1_18_UX_THEME.md's v1.18.6 milestone and the
    // portfolio backlog's v1.18.4 entry) - a large, cross-cutting change
    // deliberately out of this milestone's safely reviewable scope. This
    // test's job is only to keep that state honest: it fails if the count
    // either regresses to zero (claiming a deletion that did not happen) or
    // drops to a value inconsistent with genuine progress. The sibling test
    // below is what actually enforces the count does not silently climb.
    const remaining = (INDEX_CSS_RULES.match(/\[data-theme="light"\]/g) ?? []).length
    expect(remaining).toBeGreaterThan(0)
  })

  it('override-sheet size is ratcheted: growing past the ceiling requires a deliberate, reviewed bump', () => {
    // Pre-merge QA finding on v1.18.4 PR2: the design doc's PR2 "done when"
    // bar (docs/design/V1_18_UX_THEME.md section 5) called for "a
    // grep-style Vitest gate: ... no new `[data-theme="light"] .`
    // utility-keyed overrides", but no such gate existed anywhere - the
    // test above only ever asserted `remaining > 0`, never an upper bound,
    // so nothing in CI would have stopped a future PR from adding still
    // more override rules indefinitely.
    //
    // A literal zero-tolerance reading of that gate ("no new overrides,
    // ever") is incompatible with v1.18.4 PR2's own real fix: 25 further
    // `[data-theme="light"] .hover\:...`/`.focus\:...`/`.open\:...` rules
    // were genuinely required to close a bug the bare-class overrides could
    // never fix (see opacityColorThemeCoverage.test.ts's file header) - a
    // correctness fix, not sprawl, and zero-tolerance would have blocked it.
    // What the design doc actually needed, and what this test provides, is
    // a RATCHET: growth is not silently free, but it is possible when a
    // human deliberately raises the ceiling in the same PR and explains why
    // (exactly as this PR does, immediately below).
    //
    // Ceiling history: 124 after v1.18.3 QA -> 209 after v1.18.4 PR2's
    // initial bg-*/border-* widening -> 229 after that fix's 25 variant
    // (hover:/focus:/open:) overrides, verified against a real `tailwindcss`
    // CLI build so every added selector is confirmed to match a real
    // compiled class, not guessed -> 230 after the QA scanner-blindspot fix
    // added one override for `bg-emerald-500/5` (OnboardingChecklist's
    // done-row tint), a genuine light-mode ghost that was invisible to this
    // suite until opacityColorThemeCoverage's ternary-in-template-literal
    // extraction bug was fixed in the same PR. A single correctness override,
    // not sprawl.
    const CEILING = 230
    const remaining = (INDEX_CSS_RULES.match(/\[data-theme="light"\]/g) ?? []).length
    expect(remaining).toBeLessThanOrEqual(CEILING)
  })
})

describe('migrated chrome carries no dark-authored colour utilities', () => {
  // The chrome moved onto semantic token utilities in v1.18.1 PR2 and no
  // longer has a [data-theme="light"] safety net, so a zinc-* colour utility
  // reappearing here would be a dark island in light mode by construction.
  // SideNav.tsx was retired in v1.18.2 PR1 (D3): TopNav is the one navigation
  // system on every route, so there is no longer a drawer to keep zinc-free.
  const MIGRATED_CHROME_FILES = [
    'src/features/layout/TopNav.tsx',
    'src/features/site/SlideOver.tsx',
    'src/pages/PageLayout.tsx',
  ]

  it.each(MIGRATED_CHROME_FILES)('%s uses no zinc-* colour utility', (relPath) => {
    const source = readFileSync(path.join(ROOT, relPath), 'utf-8')
    const offenders = [...classTokensIn(source)].filter((token) =>
      /^(bg|text|border|from|via|to|divide|ring|placeholder)-zinc-/.test(token),
    )
    expect(
      offenders,
      offenders.length === 0
        ? ''
        : `${relPath} reintroduces dark-authored utilities: ${offenders.join(', ')}. ` +
          'Use the semantic token utilities instead (bg-surface-*, border-border-*, text-text-*, accent-*).',
    ).toEqual([])
  })
})
