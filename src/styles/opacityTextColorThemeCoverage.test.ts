/**
 * Repo-wide opacity-suffixed text-colour theme-coverage test (v1.18.3 QA
 * follow-up, generalised beyond ContactPage.tsx per PR #37 adversarial
 * review).
 *
 * PR #36 shipped two opacity-suffixed Tailwind text-colour classes on
 * ContactPage.tsx's referral panel - `text-emerald-200/80` and
 * `text-emerald-200/70` - with no `[data-theme="light"]` override anywhere
 * in src/index.css. Tailwind emits an opacity-suffixed class as a SEPARATE
 * selector from its bare counterpart, so `.text-emerald-200` already having
 * a light-theme override gave the opacity variants no protection at all: on
 * the near-white light `surface-card` background the un-overridden
 * dark-mode colour composited to roughly a 1.1-1.3:1 contrast ratio -
 * functionally invisible. This is the "ghost class invisible in one theme"
 * defect class the v1.18 UX theme (docs/design/V1_18_UX_THEME.md) exists to
 * eliminate. Found by QA adversarial review of merged PR #36.
 *
 * This test previously (this file's first cut, in
 * src/pages/contactPageThemeCoverage.test.ts) only read ContactPage.tsx, so
 * despite its docstring's claim to "generalise past the two literal class
 * strings" it only generalised to future ghost classes added to that ONE
 * file - a third ghost class added tomorrow to any other page or component
 * would never be read by this test and would ship with zero coverage. A
 * second adversarial review of the same PR proved this is not hypothetical:
 * the identical defect already existed, live, elsewhere in the repo -
 * `text-amber-300/80` in AboutHero.tsx, `text-emerald-200/90` in
 * ContactCTA.tsx, `text-zinc-400/70` in IntegrationsSection.tsx (whose five
 * sibling colours on adjacent lines DO have overrides - this one was
 * missed), `text-amber-200/80` and `text-emerald-200/60` in
 * LeadMagnetPage.tsx, and `text-amber-300/90` / `text-red-100/90` across
 * roughly ten more page files. This file now scans every src/**\/*.tsx (the
 * same `allComponentFiles()` sweep tokens.test.ts uses for owned-class
 * ghosts), and every one of those real gaps has been given a light-theme
 * override in src/index.css alongside this widened test so the suite is
 * green because the defects are fixed, not because the scan still can't see
 * them.
 *
 * Deliberately still scoped to:
 *  - `text-*` classes only, and only the OPACITY-SUFFIXED ones.
 *
 * Both narrowings were checked, not assumed, when this file was ContactPage
 * only, and still hold repo-wide. Widening the colour-prefix scan to
 * `bg-*`/`border-*` surfaces a much larger, pre-existing, and WIDELY SHARED
 * gap: `border-amber-400/30` and `border-amber-400/60` (the primary CTA
 * button's border/hover-border) and `bg-emerald-500/10` are each used across
 * a dozen-plus other pages and components, so "fixing" them here would
 * silently recolour CTA buttons and success banners site-wide - a far
 * bigger, riskier change than a text-colour contrast fix, and squarely the
 * kind of debt tokens.test.ts's "103 light-mode selectors deliberately
 * remain" guard already protects as the v1.18.4 exit criterion. That finding
 * is filed in the portfolio backlog's `## Bugs` section instead of fixed
 * here. Bare (non-opacity) `text-*` classes are also still excluded: they
 * are covered by a separate, long-standing systematic block (index.css's
 * "Text overrides" section), and the repo-wide sweep this file now does
 * turned up bare gaps there too (`text-red-200`, `text-green-400`) that are
 * a different, already-working mechanism's omission, not this test's
 * concern - filed in the backlog rather than fixed here.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const INDEX_CSS_RULES = readFileSync(path.join(ROOT, 'src/index.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')

const TAILWIND_PALETTE_NAMES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const

// Only `text-{palette}-{shade}/{opacity}`: see the file header for why bare
// classes and non-text prefixes are deliberately out of scope here.
const OPACITY_TEXT_CLASS_PATTERN = new RegExp(
  `^text-(${TAILWIND_PALETTE_NAMES.join('|')})-[0-9]{2,3}/[0-9]{1,3}$`,
)

/** Every .tsx file under src/, relative to the repo root, sorted. Mirrors
 * tokens.test.ts's allComponentFiles() so both ghost-class sweeps cover
 * exactly the same file set. `.tsx` only (not `.ts`) naturally excludes this
 * suite's own `.test.ts` file - a `.test.ts` string literal used as a
 * negative-control argument, like `text-cyan-500/33` below, must never be
 * picked up as "used in a component". */
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

/** Every opacity-suffixed Tailwind text-colour class token referenced in a
 * component's string/template literals. Deliberately keeps the `/NN`
 * suffix, unlike tokens.test.ts's `classTokensIn` (scoped to bare
 * owned-namespace classes), which would otherwise collapse
 * `text-emerald-200/80` and `text-emerald-200` into the same token and miss
 * exactly the defect this test exists to catch. */
function opacityTextClassesIn(source: string): string[] {
  const tokens = new Set<string>()
  const literalPattern = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g
  let match: RegExpExecArray | null
  while ((match = literalPattern.exec(source)) !== null) {
    const literal = match[1] ?? match[2] ?? match[3] ?? ''
    for (const raw of literal.split(/\s+/)) {
      const candidate = raw.slice(raw.lastIndexOf(':') + 1) // strip hover:/sm:/etc variants
      if (OPACITY_TEXT_CLASS_PATTERN.test(candidate)) tokens.add(candidate)
    }
  }
  return [...tokens]
}

/** True when `[data-theme="light"] .className` is declared anywhere in
 * index.css, accounting for the literal backslash Tailwind (and every
 * existing override in this file) uses to escape `/` in a CSS selector,
 * e.g. `.text-emerald-200\/80`. Plain substring search, not a regex, so no
 * escaping of `.`/other characters is needed for the class name itself. */
function hasLightOverride(className: string): boolean {
  const selector = `[data-theme="light"] .${className.replace(/\//g, '\\/')}`
  let searchFrom = 0
  for (;;) {
    const idx = INDEX_CSS_RULES.indexOf(selector, searchFrom)
    if (idx === -1) return false
    const nextChar = INDEX_CSS_RULES[idx + selector.length]
    if (nextChar === undefined || !/[\w-]/.test(nextChar)) return true
    searchFrom = idx + 1
  }
}

describe('every src/**/*.tsx file - opacity-suffixed text colours are covered in light mode', () => {
  it('finds components to scan', () => {
    // Guards the file sweep itself, same shape as tokens.test.ts's
    // equivalent check: if allComponentFiles() ever silently returned an
    // empty or tiny list, the it.each below would pass vacuously.
    expect(COMPONENT_FILES.length).toBeGreaterThan(40)
  })

  it.each(COMPONENT_FILES)('%s uses only opacity-suffixed text classes that have a light override', (relPath) => {
    const source = readFileSync(path.join(ROOT, relPath), 'utf-8')
    const usedClasses = opacityTextClassesIn(source)
    const uncovered = usedClasses.filter((className) => !hasLightOverride(className))
    expect(
      uncovered,
      uncovered.length === 0
        ? ''
        : uncovered
            .map(
              (className) =>
                `.${className} is used in ${relPath} with no light-theme override in src/index.css - this ` +
                'composites to near-invisible text on the light surface-card background. Add ' +
                `[data-theme="light"] .${className.replace(/\//g, '\\/')} { color: ... !important; } next to the ` +
                'other opacity-modified overrides.',
            )
            .join('\n'),
    ).toEqual([])
  })

  it('finds at least the two classes named in the original QA finding (scanner self-check)', () => {
    // Regression anchor for the defect this file was first written against:
    // if the extraction regex ever silently stops matching ContactPage.tsx,
    // this catches it even though the sweep above no longer names that file
    // specially.
    const contactPageSource = readFileSync(path.join(ROOT, 'src/pages/ContactPage.tsx'), 'utf-8')
    expect(opacityTextClassesIn(contactPageSource)).toEqual(
      expect.arrayContaining(['text-emerald-200/80', 'text-emerald-200/70']),
    )
  })

  it('the scanner actually finds opacity-suffixed classes across the codebase (not just zero)', () => {
    // Guards against the regex silently breaking repo-wide: if it stopped
    // matching entirely, every it.each case above would pass vacuously.
    const total = COMPONENT_FILES.reduce(
      (count, relPath) => count + opacityTextClassesIn(readFileSync(path.join(ROOT, relPath), 'utf-8')).length,
      0,
    )
    expect(total).toBeGreaterThan(20)
  })

  it('the scanner can fail: an undefined class/opacity combination is correctly reported as uncovered', () => {
    // Negative control (no component uses this exact colour/opacity pair).
    expect(hasLightOverride('text-cyan-500/33')).toBe(false)
  })
})
