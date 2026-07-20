/**
 * ContactPage.tsx text-colour theme-coverage test (v1.18.3 QA follow-up).
 *
 * PR #36 shipped two opacity-suffixed Tailwind text-colour classes on
 * ContactPage.tsx's referral panel - `text-emerald-200/80` and
 * `text-emerald-200/70` - with no `[data-theme="light"]` override anywhere
 * in src/index.css. Tailwind emits an opacity-suffixed class as a SEPARATE
 * selector from its bare counterpart, so `.text-emerald-200` already having
 * a light-theme override (index.css:305 at the time of the finding) gave
 * the opacity variants no protection at all: on the near-white light
 * `surface-card` background the un-overridden dark-mode colour composited
 * to roughly a 1.1-1.3:1 contrast ratio - functionally invisible. This is
 * the "ghost class invisible in one theme" defect class the v1.18 UX theme
 * (docs/design/V1_18_UX_THEME.md) exists to eliminate. Found by QA
 * adversarial review of merged PR #36.
 *
 * This generalises past the two literal class strings: it extracts EVERY
 * opacity-suffixed Tailwind text-colour utility actually used in
 * ContactPage.tsx and requires each one to already have a light-theme
 * override, so the next opacity-suffixed ghost class added to this file
 * fails CI before merge instead of shipping invisible.
 *
 * Deliberately scoped to:
 *  - ContactPage.tsx only (the file the finding was against), and
 *  - `text-*` classes only, and only the OPACITY-SUFFIXED ones.
 *
 * Both narrowings were checked, not assumed. Widening the colour-prefix
 * scan to `bg-*`/`border-*` was tried against this same file while writing
 * this test and immediately surfaced a much larger, pre-existing, and
 * WIDELY SHARED gap: `border-amber-400/30` and `border-amber-400/60` (the
 * primary CTA button's border/hover-border) and `bg-emerald-500/10` are
 * each used across a dozen-plus other pages and components, so "fixing"
 * them here would silently recolour CTA buttons and success banners
 * site-wide - a far bigger, riskier change than this file's regression, and
 * squarely the kind of debt tokens.test.ts's "103 light-mode selectors
 * deliberately remain" guard already protects as the v1.18.4 exit
 * criterion, not something to force early from a QA follow-up on one page.
 * Those findings are filed in the portfolio backlog's `## Bugs` section
 * instead of fixed here. Bare (non-opacity) `text-*` classes were also
 * checked and excluded: they are covered by a separate, long-standing
 * systematic block (index.css's "Text overrides" section), and the one gap
 * found there (`text-zinc-600`, also used in 14 other files) already
 * renders at roughly 7.7:1 on the light background without any override,
 * so it is not a contrast defect at all - just an unrelated omission from a
 * different, already-working mechanism.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CONTACT_PAGE_SRC = readFileSync(path.join(ROOT, 'src/pages/ContactPage.tsx'), 'utf-8')
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

describe('ContactPage.tsx opacity-suffixed text colours are covered in light mode', () => {
  const usedClasses = opacityTextClassesIn(CONTACT_PAGE_SRC)

  it('finds at least the two classes named in the QA finding (scanner self-check)', () => {
    // Guards the scanner itself: if the extraction regex ever silently
    // stops matching, the it.each below would run over zero cases and pass
    // vacuously, exactly the inert-check failure mode preflight.sh guards
    // against for its own checks.
    expect(usedClasses).toEqual(expect.arrayContaining(['text-emerald-200/80', 'text-emerald-200/70']))
  })

  it.each(usedClasses)('%s has a [data-theme="light"] override in index.css', (className) => {
    expect(
      hasLightOverride(className),
      `.${className} is used in ContactPage.tsx with no light-theme override in src/index.css - this ` +
        'composites to near-invisible text on the light surface-card background. Add ' +
        `[data-theme="light"] .${className.replace(/\//g, '\\/')} { color: ... !important; } next to the ` +
        'other opacity-modified overrides.',
    ).toBe(true)
  })

  it('the scanner can fail: an undefined class/opacity combination is correctly reported as uncovered', () => {
    // Negative control (no component uses this exact colour/opacity pair).
    expect(hasLightOverride('text-cyan-500/33')).toBe(false)
  })
})
