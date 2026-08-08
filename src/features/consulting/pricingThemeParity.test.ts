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

function allComponentFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...allComponentFiles(rel))
    else if (entry.name.endsWith('.tsx')) found.push(rel)
  }
  return found
}

const COMPONENT_FILES = allComponentFiles()

describe('the JS theming mechanism is retired repo-wide (D-24 done-when)', () => {
  it('finds components to scan', () => {
    expect(COMPONENT_FILES.length).toBeGreaterThan(40)
  })

  it('scanning .tsx really is the same thing as "excluding tests"', () => {
    // The ROADMAP's done-when says "excluding tests" and this scan implements
    // that by extension: every test file in this repo is `.test.ts`, never
    // `.test.tsx`. The day that stops being true, this fails loudly instead of
    // letting a test file's own prose satisfy or break the scan below.
    expect(COMPONENT_FILES.filter((rel) => rel.endsWith('.test.tsx'))).toEqual([])
  })

  it('no component derives a colour from a light/dark boolean', () => {
    const offenders = COMPONENT_FILES.filter((rel) =>
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
 * Characterisation test for a defect this slice deliberately did NOT fix
 * ---------------------------------------------------------------------- */

describe('known_gap_divide_color_is_inert (DIVIDE-COLOR-INERT-1)', () => {
  /**
   * PricingTrustStrip puts a border-colour utility on the flex CONTAINER while
   * `divide-y` / `sm:divide-x` put their border-WIDTH on the children, and
   * border-color is not inherited - so that class has never coloured a divider,
   * in either theme, and did not before this migration either. It is carried
   * across unchanged (`border-border-soft`) rather than corrected to
   * `divide-border-soft`, because this slice's claim is that nothing renders
   * differently; fixing it is a visual change and gets its own increment.
   *
   * This test PINS THE WRONG BEHAVIOUR (L-052) so the bug cannot be quietly
   * lost: when someone fixes DIVIDE-COLOR-INERT-1 this suite fails, which is
   * the signal to delete it and close the bug.
   */
  it('the divider colour still sits on the container, which carries no border width', () => {
    renderUnderTheme('dark', createElement(PricingTrustStrip))
    const divider = container.querySelector<HTMLElement>('[class*="divide-y"]')
    expect(divider).not.toBeNull()
    const classes = divider!.getAttribute('class') ?? ''
    expect(classes).toMatch(/\bborder-border-soft\b/)
    expect(classes).not.toMatch(/\bdivide-border-soft\b/)
    expect(classes).not.toMatch(/\bborder(?:-[trblxy])?\b(?!-)/)
  })
})
