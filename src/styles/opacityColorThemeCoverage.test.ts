/**
 * Repo-wide opacity-suffixed colour theme-coverage test (v1.18.3 QA
 * follow-up, generalised beyond ContactPage.tsx per PR #37 adversarial
 * review; widened from text- only to also cover bg- and border- in v1.18.4).
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
 * eliminate.
 *
 * This file (formerly src/pages/contactPageThemeCoverage.test.ts, then
 * src/styles/opacityTextColorThemeCoverage.test.ts) was widened twice:
 *
 * 1. PR #37 round 2 generalised the file scan from ContactPage.tsx alone to
 *    every src/**\/*.tsx, which surfaced 14 more real, live, un-overridden
 *    `text-*` ghost classes repo-wide - all fixed alongside that widening.
 * 2. v1.18.4 (this change) generalises the COLOUR-PREFIX scan from `text-*`
 *    only to `text-*`/`bg-*`/`border-*`. That gap was deliberately left open
 *    by PR #37's own docstring, which named the two exact repo-wide bugs it
 *    would surface - `border-amber-400/30` and `border-amber-400/60` (the
 *    primary CTA button's border and hover-border, used across a dozen-plus
 *    files) and `bg-emerald-500/10` (used in 16 files) - and deferred them
 *    to "the v1.18.4 exit criterion" rather than fix them inline. Both are
 *    now fixed in src/index.css alongside this widening, plus every other
 *    genuine `bg-*`/`border-*` gap the wider scan turned up.
 *
 * Deliberately still scoped to:
 *  - `text-*`/`bg-*`/`border-*` classes only, and only the OPACITY-SUFFIXED
 *    ones. Bare (non-opacity) classes of any of these three prefixes are
 *    covered by the separate, long-standing systematic overrides in
 *    index.css's "Text overrides" / "Background overrides" / "Border
 *    overrides" sections - a different, already-working mechanism.
 *  - Other opacity-bearing prefixes this repo also uses (`ring-`, `divide-`,
 *    `from-`/`via-`/`to-` gradient stops, `hover:` variants of any of the
 *    above) are NOT scanned here. Each is a real, separately-decided
 *    narrowing: `ring-`/`divide-`/gradient-stop ghost classes are a smaller,
 *    largely-covered surface (spot-checked, not exhaustively swept) and
 *    `hover:` variants only change colour on an already-visible element
 *    (never invisible-by-default, the specific failure mode this test
 *    exists to catch), so widening further is a candidate for a future
 *    pass, not this one.
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

const OPACITY_COLOR_PREFIXES = ['text', 'bg', 'border'] as const

// `{prefix}-{palette}-{shade}/{opacity}`: see the file header for why bare
// classes and other prefixes (ring-, divide-, gradient stops, hover:) are
// deliberately out of scope here.
const OPACITY_COLOR_CLASS_PATTERN = new RegExp(
  `^(${OPACITY_COLOR_PREFIXES.join('|')})-(${TAILWIND_PALETTE_NAMES.join('|')})-[0-9]{2,3}/[0-9]{1,3}$`,
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

/** Every opacity-suffixed Tailwind text/bg/border-colour class token
 * referenced in a component's string/template literals. Deliberately keeps
 * the `/NN` suffix, unlike tokens.test.ts's `classTokensIn` (scoped to bare
 * owned-namespace classes), which would otherwise collapse
 * `bg-emerald-500/10` and `bg-emerald-500` into the same token and miss
 * exactly the defect this test exists to catch. */
function opacityColorClassesIn(source: string): string[] {
  const tokens = new Set<string>()
  const literalPattern = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g
  let match: RegExpExecArray | null
  while ((match = literalPattern.exec(source)) !== null) {
    const literal = match[1] ?? match[2] ?? match[3] ?? ''
    for (const raw of literal.split(/\s+/)) {
      const candidate = raw.slice(raw.lastIndexOf(':') + 1) // strip hover:/sm:/etc variants
      if (OPACITY_COLOR_CLASS_PATTERN.test(candidate)) tokens.add(candidate)
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

describe('every src/**/*.tsx file - opacity-suffixed text/bg/border colours are covered in light mode', () => {
  it('finds components to scan', () => {
    // Guards the file sweep itself, same shape as tokens.test.ts's
    // equivalent check: if allComponentFiles() ever silently returned an
    // empty or tiny list, the it.each below would pass vacuously.
    expect(COMPONENT_FILES.length).toBeGreaterThan(40)
  })

  it.each(COMPONENT_FILES)('%s uses only opacity-suffixed text/bg/border classes that have a light override', (relPath) => {
    const source = readFileSync(path.join(ROOT, relPath), 'utf-8')
    const usedClasses = opacityColorClassesIn(source)
    const uncovered = usedClasses.filter((className) => !hasLightOverride(className))
    expect(
      uncovered,
      uncovered.length === 0
        ? ''
        : uncovered
            .map(
              (className) =>
                `.${className} is used in ${relPath} with no light-theme override in src/index.css - this ` +
                'composites to near-invisible colour on the light surface-card background. Add ' +
                `[data-theme="light"] .${className.replace(/\//g, '\\/')} { ... !important; } next to the ` +
                'other opacity-modified overrides.',
            )
            .join('\n'),
    ).toEqual([])
  })

  it('finds at least the three classes named in the v1.18.4 repo-wide contrast finding (scanner self-check)', () => {
    // Regression anchor for the two named repo-wide bugs (portfolio backlog
    // `## Bugs`): if the extraction regex ever silently stops matching
    // bg-*/border-* prefixes, this catches it even though the it.each sweep
    // above no longer names any file specially.
    const heroSource = readFileSync(path.join(ROOT, 'src/features/site/HeroSection.tsx'), 'utf-8')
    expect(opacityColorClassesIn(heroSource)).toEqual(
      expect.arrayContaining(['border-amber-400/60']),
    )
    const apiExplorerSource = readFileSync(path.join(ROOT, 'src/features/apiDocs/ApiSpecExplorer.tsx'), 'utf-8')
    expect(opacityColorClassesIn(apiExplorerSource)).toEqual(
      expect.arrayContaining(['bg-emerald-500/10']),
    )
  })

  it('the scanner actually finds opacity-suffixed classes across the codebase (not just zero)', () => {
    // Guards against the regex silently breaking repo-wide: if it stopped
    // matching entirely, every it.each case above would pass vacuously.
    const total = COMPONENT_FILES.reduce(
      (count, relPath) => count + opacityColorClassesIn(readFileSync(path.join(ROOT, relPath), 'utf-8')).length,
      0,
    )
    expect(total).toBeGreaterThan(20)
  })

  it('the scanner covers all three prefixes, not just text- (regression guard for the v1.18.4 widening)', () => {
    const allTokens = COMPONENT_FILES.flatMap((relPath) =>
      opacityColorClassesIn(readFileSync(path.join(ROOT, relPath), 'utf-8')),
    )
    expect(allTokens.some((t) => t.startsWith('bg-'))).toBe(true)
    expect(allTokens.some((t) => t.startsWith('border-'))).toBe(true)
    expect(allTokens.some((t) => t.startsWith('text-'))).toBe(true)
  })

  it('the scanner can fail: an undefined class/opacity combination is correctly reported as uncovered', () => {
    // Negative control (no component uses this exact colour/opacity pair).
    expect(hasLightOverride('text-cyan-500/33')).toBe(false)
    expect(hasLightOverride('bg-cyan-500/33')).toBe(false)
    expect(hasLightOverride('border-cyan-500/33')).toBe(false)
  })
})
