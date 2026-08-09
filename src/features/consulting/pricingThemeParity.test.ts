// @vitest-environment jsdom
/**
 * v1.26.2 (ROADMAP.md D-24): one theming mechanism, not three.
 *
 * This app has three ways a colour can reach the screen, and v1.26 exists
 * because nothing could check them all:
 *
 *   1. the semantic tokens in src/styles/tokens.css, which carry BOTH themes
 *      by construction (`--text-primary`, `--surface-1`, `--border-soft`, ...);
 *   2. the `[data-theme="light"]` override sheet in src/index.css, which
 *      patches a dark-authored Tailwind palette utility for light;
 *   3. per-component JS branching on `useTheme()`, which passes through
 *      NEITHER of the other two.
 *
 * Mechanism 3 had exactly two consumers left, PricingFaq.tsx and
 * PricingTrustStrip.tsx, and they were the only two files in the repo carrying
 * *light*-authored palette utilities. That is not a coincidence: their colours
 * never went through the override sheet, so nothing forced them to be
 * dark-authored, and any scanner that assumes "a class is applied in both
 * themes" reports false positives on them. D-24 retires the mechanism instead
 * of teaching every future scanner to model it.
 *
 * WHY A RENDER AND NOT A GREP (L-033, and the ROADMAP's own done-when says so
 * in as many words). "`isLight` is gone" is satisfiable by renaming the
 * variable, and "the file has no useTheme import" is satisfiable by reading the
 * context directly. The property that actually matters is behavioural: mount
 * the real component under each theme and get byte-identical markup. So the
 * source scan below is the cheap half and these render comparisons are the
 * real gate.
 *
 * WHY THE HARNESS CHECKS ITSELF FIRST. A parity assertion is the kind that
 * passes for the wrong reason: if the harness never actually switched themes,
 * or never actually read the class attributes, every comparison below would be
 * `[] === []` forever. `ThemeBranchingProbe` is a permanent POSITIVE control -
 * a component that deliberately still branches on the theme - and the first
 * suite asserts the harness SEES it differ. A bar nothing can fail is not a
 * bar. (Same discipline as lightForegroundContrast.test.ts's permanent
 * "all six raw values must still measure < 2:1" control.)
 *
 * Nothing here transcribes a class list. The palette vocabulary that decides
 * "is this a raw Tailwind colour utility" is imported from the installed
 * `tailwindcss` package (L-044, the route v1.26.1's gate took), and the file
 * list for the repo-wide scan is glob-discovered with a hard failure on an
 * empty scan (L-031).
 */
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import colors from 'tailwindcss/colors.js'
import { ThemeProvider } from '../layout/ThemeContext'
import { useTheme } from '../layout/useTheme'
import { PricingFaq } from './PricingFaq'
import { PricingTrustStrip } from './PricingTrustStrip'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ROOT = process.cwd()

/* -------------------------------------------------------------------------
 * Render harness
 * ---------------------------------------------------------------------- */

let container: HTMLDivElement
let root: Root | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  unmountIfMounted()
  container.remove()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

function unmountIfMounted(): void {
  if (!root) return
  const current = root
  act(() => current.unmount())
  root = null
}

/**
 * ThemeProvider seeds its state from localStorage on mount and mirrors it onto
 * `document.documentElement`, so both the React-visible theme and the
 * CSS-visible one are set the same way the real app sets them.
 *
 * Each call is a FRESH mount, and that is load-bearing rather than tidiness:
 * re-rendering into a live root keeps the previous ThemeProvider instance (its
 * `useState` initialiser, which is what reads localStorage, runs once per
 * mount) and keeps every child's state too - so a second render would have
 * carried the first theme AND an already-expanded FAQ row that the next click
 * would then collapse. Both were observed while writing this file, and both
 * would have made the comparison below measure the wrong pair of trees.
 */
function renderUnderTheme(theme: 'dark' | 'light', child: ReactNode): void {
  unmountIfMounted()
  localStorage.setItem('theme', theme)
  const fresh = createRoot(container)
  root = fresh
  act(() => {
    fresh.render(createElement(ThemeProvider, null, child))
  })
}

/** Every class attribute in the rendered subtree, in document order. */
function renderedClasses(): string[] {
  return [...container.querySelectorAll<HTMLElement>('*')].map(
    (element) => element.getAttribute('class') ?? '',
  )
}

/** One class token, variant prefixes (`hover:`, `sm:`, `focus:`) stripped. */
function classTokens(): string[] {
  return renderedClasses()
    .flatMap((value) => value.split(/\s+/))
    .filter(Boolean)
    .map((token) => token.slice(token.lastIndexOf(':') + 1))
}

function classesFor(theme: 'dark' | 'light', child: ReactNode): string[] {
  renderUnderTheme(theme, child)
  return renderedClasses()
}

/** Expands the first collapsible row so the answer paragraph - the one
 *  binding that is not in the initial tree - is covered too. */
function expandFirstRow(): void {
  const button = container.querySelector<HTMLButtonElement>('button[aria-expanded]')
  if (!button) throw new Error('no collapsible row rendered; the harness is measuring the wrong tree')
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/* -------------------------------------------------------------------------
 * The permanent positive control
 * ---------------------------------------------------------------------- */

/**
 * Still branches on the theme, deliberately and forever. It is not shipped
 * markup; it is the proof that the harness above can tell two themes apart.
 * The two class strings are intentionally NOT Tailwind utilities, so this file
 * cannot emit a colour class into the production bundle by naming one
 * (TAILWIND-TESTPROSE-LEAK-1: tailwind.config.js's content glob includes
 * `*.test.ts` and the extractor reads comments as well as code).
 */
function ThemeBranchingProbe(): ReactElement {
  const { theme } = useTheme()
  return createElement('span', {
    className: theme === 'light' ? 'probe-branch-light' : 'probe-branch-dark',
  })
}

describe('the harness can see a theme difference at all (positive control)', () => {
  it('reports different classes for a component that still branches on theme', () => {
    const dark = classesFor('dark', createElement(ThemeBranchingProbe))
    const light = classesFor('light', createElement(ThemeBranchingProbe))

    expect(dark).toEqual(['probe-branch-dark'])
    expect(light).toEqual(['probe-branch-light'])
    expect(
      dark,
      'the harness reported identical classes for a component that branches on theme, ' +
        'so every parity assertion in this file would pass vacuously',
    ).not.toEqual(light)
  })

  it('actually switches the document theme attribute, not just the React context', () => {
    renderUnderTheme('light', createElement(ThemeBranchingProbe))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    renderUnderTheme('dark', createElement(ThemeBranchingProbe))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

/* -------------------------------------------------------------------------
 * The gate: identical markup in both themes
 * ---------------------------------------------------------------------- */

const MIGRATED: ReadonlyArray<{ name: string; render: () => ReactElement; expand: boolean }> = [
  { name: 'PricingFaq', render: () => createElement(PricingFaq), expand: true },
  { name: 'PricingTrustStrip', render: () => createElement(PricingTrustStrip), expand: false },
]

describe('the migrated pricing components render the same in both themes', () => {
  it.each(MIGRATED)('$name emits identical classes under dark and light', ({ render, expand }) => {
    renderUnderTheme('dark', render())
    if (expand) expandFirstRow()
    const dark = renderedClasses()

    renderUnderTheme('light', render())
    if (expand) expandFirstRow()
    const light = renderedClasses()

    expect(dark.length).toBeGreaterThan(0)
    expect(light).toEqual(dark)
  })

  it('PricingFaq really does render its answer paragraph once expanded', () => {
    // Guards the guard: if the click stopped opening the row, the parity
    // assertion above would silently stop covering the answer binding.
    renderUnderTheme('dark', createElement(PricingFaq))
    const collapsed = renderedClasses().length
    expandFirstRow()
    expect(renderedClasses().length).toBeGreaterThan(collapsed)
    expect(container.querySelector('button[aria-expanded="true"]')).not.toBeNull()
  })
})

/* -------------------------------------------------------------------------
 * No raw palette utility survives in either theme
 * ---------------------------------------------------------------------- */

/**
 * The Tailwind hue vocabulary, read from the installed package rather than
 * transcribed, so this cannot disagree with what Tailwind compiles. The three
 * keyword colours are dropped: they name no theme and a transparent foreground
 * is not a theming decision. `black` and `white` stay - a bare white heading
 * colour was one of the exact bindings this slice retired.
 */
const PALETTE_HUES = Object.keys(colors).filter(
  (name) => !['inherit', 'current', 'transparent'].includes(name),
)

/**
 * A raw palette utility is one whose SECOND segment is a Tailwind hue and whose
 * third is a shade (or absent, for `black`/`white`):
 *
 *   bg-zinc-800/40      -> [bg, zinc, 800/40]      flagged
 *   text-white          -> [text, white]           flagged
 *   text-text-primary   -> [text, text, primary]   not a hue
 *   bg-surface-1        -> [bg, surface, 1]        not a hue
 *   bg-neutral-bg       -> [bg, neutral, bg]       hue name, but `bg` is not a
 *                                                  shade - this repo's own
 *                                                  neutral-bg/-border token
 *   text-base, border-b, divide-y, rounded-2xl     not a hue
 *
 * Deriving it this way instead of listing colour PREFIXES is not stylistic. The
 * first draft spelled the prefixes out as one `|`-separated alternation, and
 * Tailwind's extractor - which scans this very file - lifted one of those bare
 * prefixes out of the alternation as a class candidate, because it happens to
 * be a complete utility on its own, and emitted a brand new 263-byte rule for
 * it into the production stylesheet. Caught by diffing the built bundle against
 * the deployed one, not by reading the code (TAILWIND-TESTPROSE-LEAK-1; the PR
 * body names the class, which is why this comment does not).
 */
const HUE = new Set(PALETTE_HUES)
const SHADE = /^\d+(?:\/\d+)?$/

function isPaletteUtility(token: string): boolean {
  const [, hue, shade, ...rest] = token.split('-')
  if (!hue || !HUE.has(hue) || rest.length > 0) return false
  return shade === undefined || SHADE.test(shade)
}

describe('the migrated components emit no raw Tailwind palette colour', () => {
  it('the hue vocabulary was actually loaded', () => {
    // Without this the regex below degenerates and matches nothing, which
    // reads exactly like a clean component.
    expect(PALETTE_HUES.length).toBeGreaterThan(15)
    expect(PALETTE_HUES).toContain('zinc')
    expect(PALETTE_HUES).toContain('amber')
    expect(PALETTE_HUES).toContain('white')
  })

  it('the matcher recognises the shapes this slice retired, and spares the ones it kept', () => {
    // Derived, not decorative: both directions are asserted so a regex typo
    // cannot make the suite below pass by matching nothing.
    //
    // The retired class names are ASSEMBLED rather than written out, because
    // tailwind.config.js's content glob covers `./src/**/*.{ts,tsx}` - this
    // file included - so spelling one of them here would emit it straight back
    // into the production stylesheet that the slice just removed it from
    // (TAILWIND-TESTPROSE-LEAK-1). The extractor sees `'bg'` and `'zinc'`,
    // neither of which is a utility; `String.join` sees the real class.
    const retiredShapes = [
      ['bg', 'zinc', '50'],
      ['border', 'zinc', '200'],
      ['text', 'amber', '600'],
      ['text', 'white'],
      ['bg', 'zinc', '800/40'],
    ].map((parts) => parts.join('-'))
    for (const retired of retiredShapes) {
      expect(isPaletteUtility(retired), `${retired} should be flagged`).toBe(true)
    }
    for (const kept of [
      'text-text-primary',
      'bg-surface-1',
      'border-border-soft',
      'text-accent',
      'text-base',
      'divide-y',
      'border-b',
      'rounded-2xl',
      'bg-neutral-bg',
    ]) {
      expect(isPaletteUtility(kept), `${kept} should NOT be flagged`).toBe(false)
    }
  })

  it.each(MIGRATED)('$name uses semantic tokens only ($name, both themes)', ({ render, expand }) => {
    for (const theme of ['dark', 'light'] as const) {
      renderUnderTheme(theme, render())
      if (expand) expandFirstRow()
      const offenders = classTokens().filter(isPaletteUtility)
      expect(
        offenders,
        offenders.length === 0
          ? ''
          : `raw palette utilities reached the DOM in the ${theme} theme: ${offenders.join(', ')}. ` +
            'Use the semantic token utilities instead (bg-surface-*, border-border-*, text-text-*, accent-*).',
      ).toEqual([])
    }
  })
})

/* -------------------------------------------------------------------------
 * The source-level half: the mechanism itself is gone
 * ---------------------------------------------------------------------- */

/**
 * `.tsx` plus non-test `.ts` (SWEEP-TSX-ONLY-1; was `.tsx`-only until
 * 2026-08-08). The mechanism this scan retires — deriving a colour from a
 * light/dark boolean — fits a plain-.ts hook or helper just as well as a
 * component, so the corpus is every non-test source file. Test files stay
 * excluded by the explicit filter below rather than by the extension
 * coincidence the previous revision leaned on.
 */
function allSourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...allSourceFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found
}

const SOURCE_FILES = allSourceFiles()

describe('the JS theming mechanism is retired repo-wide (D-24 done-when)', () => {
  it('finds source files to scan, including the non-test .ts half', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(40)
    // The widened half's own non-vacuity floor (SWEEP-TSX-ONLY-1, mirroring
    // colorThemeCoverage.test.ts): a filter edit that silently drops plain
    // .ts modules must fail here, not narrow the sweep quietly.
    expect(SOURCE_FILES.filter((rel) => rel.endsWith('.ts') && !rel.endsWith('.tsx')).length).toBeGreaterThan(0)
  })

  it('the corpus really does exclude test files ("excluding tests" is the ROADMAP done-when)', () => {
    // Until 2026-08-08 this asserted the repo held no `.test.tsx` files,
    // because the scan excluded tests by the COINCIDENCE that every test was
    // `.test.ts` and the corpus was `.tsx`-only. The corpus now excludes
    // `.test.ts(x)` by explicit filter; this re-checks the OUTPUT list so a
    // future filter regression that lets a test file's own prose satisfy or
    // break the scan below fails loudly here first.
    expect(SOURCE_FILES.filter((rel) => /\.test\.tsx?$/.test(rel))).toEqual([])
  })

  it('no component derives a colour from a light/dark boolean', () => {
    const offenders = SOURCE_FILES.filter((rel) =>
      /\bisLight\b/.test(readFileSync(path.join(ROOT, rel), 'utf-8')),
    )
    expect(
      offenders,
      offenders.length === 0
        ? ''
        : `${offenders.join(', ')} still branch on a light/dark boolean. Colour belongs to the ` +
          'semantic tokens (both themes) or to the [data-theme="light"] override sheet, not to JS.',
    ).toEqual([])
  })

  it('neither migrated component reads the theme any more', () => {
    for (const rel of [
      'src/features/consulting/PricingFaq.tsx',
      'src/features/consulting/PricingTrustStrip.tsx',
    ]) {
      const source = readFileSync(path.join(ROOT, rel), 'utf-8')
      expect(source, `${rel} still imports useTheme`).not.toMatch(/from '\.\.\/layout\/useTheme'/)
    }
  })
})

/* -------------------------------------------------------------------------
 * DIVIDE-COLOR-INERT-1: divider colour rides the divide utility
 * ---------------------------------------------------------------------- */

/**
 * PricingTrustStrip's divider colour used to sit on the flex CONTAINER as a
 * border-colour utility while `divide-y` / `sm:divide-x` put their
 * border-WIDTH on the CHILDREN - and border-color is not inherited, so the
 * children painted Tailwind's preflight default in both themes (bright
 * hairlines on a dark card). The characterisation block that PINNED that
 * wrong behaviour (L-052, `known_gap_divide_color_is_inert`) was deleted when
 * the class was fixed, per its own instructions; these two suites replace it:
 *
 *   1. a rendering assertion that the real container now carries the
 *      `divide-` spelling of the colour and no longer the container-level
 *      border-colour form;
 *   2. the bug entry's "worth a sweep when taken", executed on every run
 *      rather than run by hand once: any class-string literal in non-test
 *      source that names a positive divide WIDTH must name a divide COLOUR
 *      in the same literal, otherwise its dividers silently render the
 *      preflight default - the exact shape that shipped here.
 *
 * The `divide` word is interpolated into the regex sources below so no whole
 * width/style class token appears contiguously in this file's raw text
 * (TAILWIND-TESTPROSE-LEAK-1). `divide-border-soft` and the token spelled by
 * the rendering assertion are live classes with non-test consumers, so naming
 * them cannot resurrect a retired rule.
 */

const DIVIDE = 'divide'
// Width: the x/y utilities with an optional numeric or px suffix. A zero
// width paints nothing and must not demand a colour by itself; -reverse only
// flips which sibling carries the border. (This comment names no whole class
// token: its first draft spelled the bare x-axis one and the extractor
// emitted a fresh rule for it into production CSS - the leak's exact shape.)
const DIVIDE_WIDTH = new RegExp(`^${DIVIDE}-(x|y)(-(\\d+|px))?$`)
const DIVIDE_ZERO = new RegExp(`^${DIVIDE}-(x|y)-0$`)
const DIVIDE_ORDER = new RegExp(`^${DIVIDE}-(x|y)-reverse$`)
const DIVIDE_STYLE = new RegExp(`^${DIVIDE}-(solid|dashed|dotted|double|none)$`)

/** Drops variant prefixes (`sm:`, `hover:`) from a token; mirrors classTokens() above. */
function stripVariants(token: string): string {
  return token.slice(token.lastIndexOf(':') + 1)
}

function isDivideWidth(token: string): boolean {
  return DIVIDE_WIDTH.test(token) && !DIVIDE_ZERO.test(token)
}

function isDivideColour(token: string): boolean {
  if (!token.startsWith(`${DIVIDE}-`)) return false
  return !DIVIDE_WIDTH.test(token) && !DIVIDE_ORDER.test(token) && !DIVIDE_STYLE.test(token)
}

/**
 * Every quoted string literal in a source file, template literals included.
 * A character walker rather than a regex because comments must be SKIPPED: a
 * doc comment naming `a-utility` in backticks reads exactly like a template
 * literal to a pattern over raw text, and this guard's first draft flagged
 * the fixed component's own header comment that way.
 */
function stringLiteralsIn(source: string): string[] {
  const literals: string[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i)
      i = end === -1 ? source.length : end + 1
    } else if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
    } else if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1
      literals.push(source.slice(i + 1, j))
      i = j + 1
    } else {
      i += 1
    }
  }
  return literals
}

describe('DIVIDE-COLOR-INERT-1 stays fixed (rendering half)', () => {
  it('the trust-strip divider container colours its dividers with the divide utility', () => {
    renderUnderTheme('dark', createElement(PricingTrustStrip))
    const divider = container.querySelector<HTMLElement>(`[class*="${DIVIDE}-y"]`)
    expect(divider).not.toBeNull()
    const classes = (divider!.getAttribute('class') ?? '').split(/\s+/)
    expect(classes).toContain('divide-border-soft')
    // The inert form: a border-COLOUR utility on the container, which has no
    // border width of its own for the colour to apply to.
    expect(classes).not.toContain('border-border-soft')
  })
})

describe('DIVIDE-COLOR-INERT-1 stays fixed (repo-wide sweep)', () => {
  it('the classifier tells the divide families apart, both directions', () => {
    expect(isDivideWidth(stripVariants(`sm:${DIVIDE}-x`))).toBe(true)
    expect(isDivideWidth(`${DIVIDE}-y`)).toBe(true)
    expect(isDivideWidth([DIVIDE, 'y', '2'].join('-'))).toBe(true)
    expect(isDivideWidth([DIVIDE, 'y', '0'].join('-'))).toBe(false)
    expect(isDivideColour('divide-border-soft')).toBe(true)
    expect(isDivideColour([DIVIDE, 'zinc', '700/20'].join('-'))).toBe(true)
    expect(isDivideColour([DIVIDE, 'dotted'].join('-'))).toBe(false)
    expect(isDivideColour([DIVIDE, 'y', 'reverse'].join('-'))).toBe(false)
    expect(isDivideWidth([DIVIDE, 'y', 'reverse'].join('-'))).toBe(false)
    expect(isDivideWidth('border-b')).toBe(false)
    expect(isDivideColour('border-border-soft')).toBe(false)
  })

  it('every divide-width literal in non-test source names its divider colour', () => {
    const withWidth: string[] = []
    const offenders: string[] = []
    for (const rel of SOURCE_FILES) {
      const source = readFileSync(path.join(ROOT, rel), 'utf-8')
      for (const literal of stringLiteralsIn(source)) {
        const tokens = literal.split(/\s+/).filter(Boolean).map(stripVariants)
        if (!tokens.some(isDivideWidth)) continue
        withWidth.push(`${rel}: "${literal}"`)
        if (!tokens.some(isDivideColour)) offenders.push(`${rel}: "${literal}"`)
      }
    }
    // Vacuity floor (L-031): the corpus is known to hold divide consumers
    // (DataTable, ActivityFeed, the trust strip, the case-study tables).
    expect(withWidth.length).toBeGreaterThanOrEqual(3)
    expect(
      offenders,
      offenders.length === 0
        ? ''
        : 'these class strings set a divider WIDTH with no divide COLOUR in the same literal, ' +
          'so their dividers render the Tailwind preflight default (gray-200) in BOTH themes - ' +
          'the DIVIDE-COLOR-INERT-1 shape. Add the matching divide colour to the same class ' +
          'string (this repo spells it divide-border-soft for hairlines).',
    ).toEqual([])
  })
})
