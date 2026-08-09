// @vitest-environment jsdom
/**
 * v1.27.2 (ROADMAP.md D-28): one way to spell focus.
 *
 * Before this slice a focused form control in this app could be told apart from
 * an unfocused one in four different ways, none of them the app's own focus
 * token:
 *
 *   focus:border-amber-400/50   2.08:1 light, 15 files
 *   focus:border-amber-500/60   2.41:1 light,  6 files
 *   focus:ring-amber-400/20     1.10:1 light,  2 files
 *   focus:ring-amber-500/30     1.24:1 light,  4 files
 *   focus:ring-amber-500/40     1.33:1 light,  1 file
 *
 * Every one of those is below the 3:1 bar WCAG 1.4.11 sets for a boundary that
 * identifies a control's STATE, which is exactly what a focus indicator is, and
 * v1.27's whole point is that the keyboard path v1.24 guaranteed has to be
 * visible in the light theme.
 *
 * WHAT ACTUALLY MADE THEM LOAD-BEARING, and it is not what D-28 assumed. The
 * app already has one correct focus indicator for every form control, in
 * src/index.css:
 *
 *   input:focus-visible, textarea:focus-visible, select:focus-visible {
 *     outline: 2px solid var(--focus-ring); outline-offset: 1px;
 *   }
 *
 * v1.27.1 moved light `--focus-ring` to #b45309, which clears 3:1 on all three
 * surfaces. But 25 of the 43 call sites also carried `focus:outline-none`, and
 * `.focus\:outline-none:focus` has specificity (0,2,0) against that rule's
 * (0,1,1) - so on those controls the token outline was overridden to
 * `2px solid transparent` and the ONLY surviving focus signal was the 2.08:1
 * border. The fix is therefore not "add a fourth spelling"; it is to delete the
 * palette utilities, delete the `focus:ring-{1,2}` widths that only existed to
 * give those colours a shape, and demote `focus:outline-none` to the
 * unconditional `outline-none` (0,1,0) that LOSES to the app rule. One
 * indicator, declared once, in one place.
 *
 * WHY THE COUNT IS NOT THE TEST. "Zero palette focus utilities" is satisfied
 * perfectly by deleting the classes and shipping no focus indicator at all, so
 * contract A is only the cheap half. Contract D mounts the real components and
 * reads the class attribute off the real control; contract E proves the rule
 * that replaces them exists, is spelled `:focus-visible`, and clears 3:1
 * computed rather than transcribed; contract F is a permanent positive control
 * that watches the specificity fact above stay true; and contract G proves the
 * `focus:` -> `focus-visible:` behaviour change by running the real Tailwind
 * compiler over both class lists, because that difference is a difference in
 * emitted SELECTORS and nothing short of the compiler is authority on it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import {
  INDEX_CSS,
  SOURCE_ENTRIES,
  SURFACE_NAMES,
  colorUtilitiesIn,
  compositeOver,
  consumersOf,
  contrastRatio,
  cssVariable,
  parseCssColor,
  surfaceBackdrop,
} from '../../scripts/lib/themeContrast'
import { SupportRequestPanel } from '../features/support/SupportRequestPanel'
import { OnboardingChecklist } from '../features/onboarding/OnboardingChecklist'
import { INPUT_CLS } from '../features/crm/ui'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** The five palette focus utilities D-28 retires. Kept here as data because
 * every contract below has to name them; nothing reads this list to DISCOVER
 * work, so it cannot hide a sixth one - contract A discovers those. */
const RETIRED = [
  'focus:border-amber-400/50',
  'focus:border-amber-500/60',
  'focus:ring-amber-400/20',
  'focus:ring-amber-500/30',
  'focus:ring-amber-500/40',
] as const

/** Ring WIDTHS are not colour utilities, so contract A cannot see them, and a
 * width left behind after its colour is deleted is worse than either: Tailwind
 * falls back to its DEFAULT `--tw-ring-color` (blue-500/50), so the app would
 * paint a stock blue ring on focus. They went out with the colours. */
const RETIRED_RING_WIDTHS = ['focus:ring-1', 'focus:ring-2'] as const

/**
 * `focus:outline-none` survivors, pinned so the set can only shrink.
 *
 * The first three are deliberate and stay: all three are programmatic focus
 * targets (`tabIndex={-1}`) that receive focus from a skip link or a dialog
 * opening, where a 2px ring around a whole page region is noise rather than
 * information. The last two are FOCUS-OUTLINE-SUPPRESSED-1 in the backlog: real
 * form controls whose token outline is suppressed exactly the way the 25
 * migrated call sites' was. They are out of D-28's scope (they carry none of
 * the five palette utilities) and are filed rather than fixed here.
 */
const OUTLINE_NONE_ALLOWED = [
  'src/App.tsx', // <main tabIndex={-1}>, skip-link target
  'src/features/apiDocs/tryIt/TryItPanel.tsx', // FOCUS-OUTLINE-SUPPRESSED-1
  'src/features/commandPalette/CommandPalette.tsx', // FOCUS-OUTLINE-SUPPRESSED-1
  'src/features/tour/GuidedTour.tsx', // <div tabIndex={-1}>, dialog card
  'src/pages/PageLayout.tsx', // <main tabIndex={-1}>, skip-link target
] as const

/* -------------------------------------------------------------------------
 * A. The census, executed rather than grepped.
 * ---------------------------------------------------------------------- */

describe('A. no palette colour utility carries a focus variant', () => {
  const census = new Map<string, ReturnType<typeof colorUtilitiesIn>[number]>()
  for (const { source } of SOURCE_ENTRIES) {
    for (const utility of colorUtilitiesIn(source)) census.set(utility.token, utility)
  }
  const all = [...census.values()]

  it('scanned a real corpus (vacuity guard)', () => {
    // A scan that found nothing reports exactly what a clean tree reports, so
    // the size of the corpus is asserted before anything is concluded from it.
    expect(SOURCE_ENTRIES.length).toBeGreaterThan(100)
    expect(all.length).toBeGreaterThan(150)
    expect(all.filter((u) => u.kind === 'hairline').length).toBeGreaterThan(40)
  })

  it('reports ZERO focus-variant utilities, and names any it finds', () => {
    const focusVariant = all
      .filter((u) => /(^|:)focus(-visible)?:/.test(u.token))
      .map((u) => `${u.token} (${u.kind})`)
      .sort()
    expect(focusVariant).toEqual([])
  })

  it('needs no new VARIANT_SELECTOR_SUFFIX entry, and that is measured not assumed', () => {
    // D-28's done-when adds `focus-visible` to that map IF the migration puts
    // the variant on a colour utility. It does not: the migration REMOVES
    // colour utilities and leans on an element-selector rule in index.css, and
    // the recipe elsewhere in the app spells the colour as the arbitrary value
    // `outline-[var(--focus-ring)]`, which is not a palette utility at all.
    const focusVisibleColourUtilities = all.filter((u) => /focus-visible:/.test(u.token))
    expect(focusVisibleColourUtilities).toEqual([])
  })
})

/* -------------------------------------------------------------------------
 * B + C. The retired spellings, and the pinned survivors.
 * ---------------------------------------------------------------------- */

describe('B. the retired spellings have no consumers left', () => {
  it.each(RETIRED)('%s is gone from every source file', (token) => {
    expect(consumersOf(token)).toEqual([])
  })

  it.each(RETIRED_RING_WIDTHS)('%s went out with the colour it shaped', (token) => {
    expect(consumersOf(token)).toEqual([])
  })

  it('the shared CRM input class - 51 controls - carries none of them', () => {
    // Read off the exported constant, not copied into this file.
    for (const token of [...RETIRED, ...RETIRED_RING_WIDTHS]) {
      expect(INPUT_CLS.split(' ')).not.toContain(token)
    }
    expect(INPUT_CLS.split(' ')).toContain('outline-none')
  })
})

describe('C. focus:outline-none survives only where it is documented to', () => {
  it('the inventory matches the allowlist exactly', () => {
    const found = SOURCE_ENTRIES.filter(({ source }) => source.includes('focus:outline-none'))
      .map(({ rel }) => rel)
      .sort()
    expect(found).toEqual([...OUTLINE_NONE_ALLOWED].sort())
  })
})

/* -------------------------------------------------------------------------
 * D. What the real components actually render.
 * ---------------------------------------------------------------------- */

let container: HTMLDivElement
let root: Root | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root !== null) {
    const current = root
    root = null
    act(() => current.unmount())
  }
  container.remove()
  localStorage.clear()
})

function mount(element: ReturnType<typeof createElement>): HTMLElement[] {
  root = createRoot(container)
  act(() => root!.render(element))
  return [...container.querySelectorAll('input, select, textarea')] as HTMLElement[]
}

describe('D. the rendered controls emit the migrated recipe', () => {
  /** Which tag names src/index.css actually grants the token outline to, read
   * out of the sheet rather than assumed. */
  const guardedTags = new Set<string>()
  for (const rule of INDEX_CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/outline:[^;]*var\(--focus-ring\)/.test(rule[2])) continue
    for (const selector of rule[1].split(',')) {
      const tag = selector.trim().replace(/:focus-visible$/, '')
      // Bare tag selectors only: `.btn-accent:focus-visible` is a class rule
      // covering styled buttons, not the form-control rule under test here.
      if (/^[a-z]+$/.test(tag)) guardedTags.add(tag)
    }
  }

  it('index.css grants the outline to the three form-control tags', () => {
    expect([...guardedTags].sort()).toEqual(['input', 'select', 'textarea'])
  })

  it.each([
    ['SupportRequestPanel (the focus:ring-* and focus:border-400 family)', () =>
      createElement(SupportRequestPanel, { projectId: 'focus-spelling-probe' })],
    ['OnboardingChecklist (the widthless focus:ring-500/40 family)', () =>
      createElement(OnboardingChecklist, { projectId: 'focus-spelling-probe' })],
  ])('%s renders controls the app rule covers, with no retired spelling', (_label, build) => {
    const controls = mount(build())
    // Vacuity: a component that rendered no control proves nothing at all.
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) {
      const classes = (control.getAttribute('class') ?? '').split(/\s+/)
      for (const token of [...RETIRED, ...RETIRED_RING_WIDTHS, 'focus:outline-none']) {
        expect(classes).not.toContain(token)
      }
      expect(guardedTags).toContain(control.tagName.toLowerCase())
    }
  })
})

/* -------------------------------------------------------------------------
 * E. The indicator that replaces them.
 * ---------------------------------------------------------------------- */

describe('E. the one remaining indicator is spelled focus-visible and clears 3:1', () => {
  const declaration = /input:focus-visible[^{]*\{[^}]*\}/.exec(INDEX_CSS)?.[0] ?? ''

  it('index.css declares it on :focus-visible, never bare :focus', () => {
    expect(declaration).not.toBe('')
    expect(declaration).toContain('var(--focus-ring)')
    // The distinction the whole slice turns on: a bare `:focus` selector would
    // paint on a mouse click too, which is the behaviour D-28 deliberately
    // changes. `input:focus` must not appear anywhere in this rule's selector.
    const selector = declaration.slice(0, declaration.indexOf('{'))
    expect(selector).not.toMatch(/:focus(?![-a-z])/)
    expect(selector.match(/:focus-visible/g)?.length).toBe(3)
  })

  it.each(SURFACE_NAMES)('clears 3:1 against --%s in the light theme', (surface) => {
    const ring = parseCssColor(cssVariable('light', 'focus-ring'))
    const ratio = contrastRatio(compositeOver(ring, surfaceBackdrop('light', surface)), surfaceBackdrop('light', surface))
    expect(ratio).toBeGreaterThanOrEqual(3)
  })
})

/* -------------------------------------------------------------------------
 * F. Why focus:outline-none had to go - a permanent positive control.
 * ---------------------------------------------------------------------- */

describe('F. a class-plus-:focus rule outranks the element-plus-:focus-visible rule', () => {
  /** jsdom resolves the cascade for border-color and background-color (it does
   * not compute outline-color at all, which is why this control is written on
   * properties it does compute). The SHAPE of the two selectors is what is
   * under test, and it is identical to the real pair. Run in the suite's own
   * jsdom document rather than a second instance, so no `jsdom` import - and
   * therefore no `@types/jsdom` devDependency - is needed. */
  function focusedColour(css: string): string {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    const input = document.createElement('input')
    input.className = 'sut'
    container.appendChild(input)
    try {
      input.focus()
      return window.getComputedStyle(input).borderTopColor
    } finally {
      style.remove()
      input.remove()
    }
  }

  const APP_RULE = 'input:focus-visible { border-color: rgb(1, 2, 3); }'
  const UTILITY_RULE = '.sut:focus { border-color: rgb(9, 9, 9); }'

  it('BOTH halves: each rule wins on its own', () => {
    expect(focusedColour(APP_RULE)).toBe('rgb(1, 2, 3)')
    expect(focusedColour(UTILITY_RULE)).toBe('rgb(9, 9, 9)')
  })

  it('together, the utility wins even when declared FIRST - so it is specificity, not order', () => {
    expect(focusedColour(`${UTILITY_RULE}\n${APP_RULE}`)).toBe('rgb(9, 9, 9)')
  })
})

/* -------------------------------------------------------------------------
 * G. focus vs focus-visible, decided by the real compiler.
 * ---------------------------------------------------------------------- */

describe('G. the emitted selectors changed, proven by compiling both class lists', () => {
  /** The class string this component shipped BEFORE the migration, kept verbatim
   * as the positive control. If the assertion below could not see a `:focus`
   * colour rule, it would pass for every input including a broken one. */
  const BEFORE =
    'flex-1 rounded-xl border border-zinc-700/60 bg-surface-control px-4 py-2.5 text-sm ' +
    'text-text-primary placeholder-zinc-500 outline-none focus:border-amber-400/50 ' +
    'focus:ring-1 focus:ring-amber-400/20'

  const COLOUR_DECLARATION = /(^|;|\{)\s*(border-color|--tw-ring-color|outline-color|background-color|color)\s*:/

  async function focusColourSelectors(classNames: string): Promise<string[]> {
    const result = await postcss([
      tailwindcss({
        content: [{ raw: `<div class="${classNames}"></div>`, extension: 'html' }],
        corePlugins: { preflight: false },
      }),
    ]).process('@tailwind utilities;', { from: undefined })
    const selectors: string[] = []
    for (const rule of result.css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = rule[1].trim()
      // `:focus` but not `:focus-visible`/`:focus-within`.
      if (/:focus(?![-a-z])/.test(selector) && COLOUR_DECLARATION.test(rule[2])) {
        selectors.push(selector)
      }
    }
    return selectors.sort()
  }

  it('the OLD class list compiled two :focus colour rules (positive control)', async () => {
    expect(await focusColourSelectors(BEFORE)).toEqual([
      '.focus\\:border-amber-400\\/50:focus',
      '.focus\\:ring-amber-400\\/20:focus',
    ])
  }, 30_000)

  it('the class list the component renders today compiles ZERO of them', async () => {
    const controls = mount(createElement(SupportRequestPanel, { projectId: 'focus-spelling-probe' }))
    const textInput = controls.find((c) => c.tagName.toLowerCase() === 'input')
    expect(textInput).toBeDefined()
    expect(await focusColourSelectors(textInput!.getAttribute('class') ?? '')).toEqual([])
  }, 30_000)
})
