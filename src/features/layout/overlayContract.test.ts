/**
 * Overlay contract guard (v1.24.3; ROADMAP "v1.24 - Reachable without a
 * mouse", decisions D-15 and D-16).
 *
 * WHAT WENT WRONG. `useFocusTrap` shipped in v1.18.2 PR1 for audit finding F11
 * with Escape, a Tab/Shift+Tab trap, focus-in and focus-return-to-trigger. For
 * six milestones exactly ONE of eight `role="dialog"` surfaces called it, while
 * five of the other seven declared `aria-modal="true"` - a promise to assistive
 * technology that the page behind them is inert - with per-file Escape,
 * `.focus()` and `'Tab'` counts all zero. v1.24.1 (PR #134) and v1.24.2
 * (PR #135) adopted the seam on all seven. Nothing yet stops the NEXT overlay
 * from re-opening the gap, which is what this file is for.
 *
 * WHY THIS SHAPE (D-15). The only prior guard was `navigation.test.ts`'s
 * "SlideOver uses the focus trap and is a labelled dialog" case: four
 * assertions pinned by NAME to the one file that had already adopted the hook,
 * so all seven non-adopters and every future modal were invisible to it. That
 * is the L-031 failure shape - a hand-named scan degrades silently instead of
 * failing - so this increment DELETES that case and subsumes its four
 * assertions here, over a glob-discovered file set with a zero-match hard
 * failure (contract A).
 *
 * THE CONTRACT (D-16), scoped by what a dialog IS rather than by an allowlist,
 * because v1.23 D-12 deleted this repo's last exemption mechanism on the
 * grounds that an empty allowlist is an invitation:
 *
 *   1. `role="dialog"` WITH `aria-modal="true"`  =>  the file must call
 *      `useFocusTrap`, at least once per such dialog.
 *   2. `role="dialog"` with NO `aria-modal`      =>  the file must handle the
 *      Escape key itself. `GuidedTour` is a deliberate non-modal floating card
 *      per NF-2 and lands here because of what it IS, with no allowlist entry.
 *   3. EVERY `role="dialog"`                     =>  `aria-label` or
 *      `aria-labelledby`.
 *
 * WHAT THIS GUARD IS NOT. It is a SOURCE scan, so clause 1 proves ADOPTION and
 * never BEHAVIOUR - a grep is satisfiable by a comment or an unused import
 * (L-033). Two things close that gap. The paired behaviour proof is
 * `modalFocusTrap.test.ts`, which renders all eight real overlays under jsdom
 * and drives the whole keyboard contract. And this file's own executable
 * control is contract E: the classifier must REDDEN on a fixture for each of
 * the three clauses and stay SILENT on the compliant shape of each, so it can
 * neither pass everything nor reject everything (L-001, L-034). Contract E also
 * pins the L-033 shape directly: an import-only `useFocusTrap` does not satisfy
 * clause 1.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

/** Block comments and whole-line `//` comments removed, so a component's
 * documentation header - which legitimately quotes `aria-modal="true"` and
 * `'Escape'` to explain what it adopted, and does so in six of the nine files
 * scanned here - is never mistaken for live markup. Same stripper as
 * `navigation.test.ts` and `tokens.test.ts`; contract A exercises it. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

/** Every non-test `.ts`/`.tsx` under `src/`, discovered by a directory walk
 * with no hand-maintained list, so a dialog added in a new module is covered
 * the day it lands (L-031). `.ts` is scanned as well as `.tsx` so a dialog
 * authored inside a template string cannot hide from the sweep. */
function componentFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...componentFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found
}

/**
 * Every JSX opening tag in `source`, verbatim from `<Name` to the `>` that
 * closes it. The forward scan skips quoted strings and treats `{...}` as
 * opaque, so an expression attribute containing `>` (a generic, an arrow
 * function, a nested element) cannot truncate a tag and hide its attributes.
 * A `<` reached at depth zero means this was never a tag - a comparison, or a
 * TypeScript generic that swallowed the rest of a line - so the candidate is
 * dropped and the scan resumes just after it rather than skipping ahead.
 */
function openingTags(source: string): string[] {
  const tags: string[] = []
  const re = /<[A-Za-z][\w.]*/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const start = match.index
    let i = re.lastIndex
    let depth = 0
    let end = -1
    while (i < source.length) {
      const ch = source[i]
      if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch
        i++
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\') i++
          i++
        }
      } else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (depth === 0 && ch === '<') break
      else if (depth === 0 && ch === '>') {
        end = i
        break
      }
      i++
    }
    if (end >= 0) {
      tags.push(source.slice(start, end + 1))
      re.lastIndex = end + 1
    }
  }
  return tags
}

const DIALOG_ROLE = /role="dialog"/
const ARIA_MODAL_TRUE = /aria-modal=(?:"true"|'true'|\{true\})/
const ACCESSIBLE_NAME = /aria-label(?:ledby)?=/
/** A key comparison against Escape. Asserted on the comparison shape rather
 * than on the bare word, so an unrelated string mentioning Escape cannot
 * satisfy clause 2 (L-034: pin the guard's own distinctive wording). */
const ESCAPE_HANDLER = /\.(?:key|code)\s*===?\s*['"]Escape['"]/

/** Calls of the seam, not mentions of it: an `import { useFocusTrap }` line has
 * no call parens and is deliberately NOT counted (the L-033 shape). */
const countFocusTrapCalls = (source: string) =>
  (source.match(/useFocusTrap\s*(?:<[^<>]*>)?\s*\(/g) ?? []).length

/** The `role="dialog"` opening tags in a source, comments removed. */
const dialogTags = (rawSource: string) =>
  openingTags(stripComments(rawSource)).filter((tag) => DIALOG_ROLE.test(tag))

type Clause = 'trap' | 'escape' | 'name'

interface OverlayViolation {
  clause: Clause
  /** The offending opening tag, single-lined for a readable failure message. */
  tag: string
}

const excerpt = (tag: string) => tag.replace(/\s+/g, ' ').slice(0, 110)

/**
 * The whole D-16 contract as one pure function over a file's source, so the
 * real sweep (contracts B, C, D) and the executable control (contract E) run
 * the SAME classifier rather than two implementations that can drift.
 */
function auditOverlays(rawSource: string): OverlayViolation[] {
  const source = stripComments(rawSource)
  const dialogs = openingTags(source).filter((tag) => DIALOG_ROLE.test(tag))
  if (dialogs.length === 0) return []

  const violations: OverlayViolation[] = []
  const modal = dialogs.filter((tag) => ARIA_MODAL_TRUE.test(tag))
  const nonModal = dialogs.filter((tag) => !ARIA_MODAL_TRUE.test(tag))

  // Clause 1, COUNTED rather than merely present: a file declaring two modal
  // dialogs while calling the hook once has covered exactly one of them, and a
  // presence check would call that clean.
  for (const tag of modal.slice(countFocusTrapCalls(source))) {
    violations.push({ clause: 'trap', tag: excerpt(tag) })
  }

  // Clause 2. Scoped to the file because a single window-level listener can
  // legitimately serve several non-modal dialogs in one module.
  if (nonModal.length > 0 && !ESCAPE_HANDLER.test(source)) {
    for (const tag of nonModal) violations.push({ clause: 'escape', tag: excerpt(tag) })
  }

  // Clause 3.
  for (const tag of dialogs) {
    if (!ACCESSIBLE_NAME.test(tag)) violations.push({ clause: 'name', tag: excerpt(tag) })
  }

  return violations
}

const FILES = componentFiles()
const SCANNED = FILES.map((rel) => {
  const source = read(rel)
  return { rel, dialogs: dialogTags(source), violations: auditOverlays(source) }
})
const WITH_DIALOGS = SCANNED.filter((f) => f.dialogs.length > 0)
const ALL_DIALOGS = WITH_DIALOGS.flatMap((f) => f.dialogs)

/** Offenders for one clause, formatted `path: <tag excerpt>`. */
const offenders = (clause: Clause) =>
  SCANNED.flatMap((f) => f.violations.filter((v) => v.clause === clause).map((v) => `${f.rel}: ${v.tag}`))

describe('contract A: the overlay set is discovered, not hand-listed (L-031)', () => {
  it('the source walk finds files, and the tag scan finds dialogs', () => {
    // Zero-match hard failure, both halves. A broken walk, a renamed
    // convention, or a tag scanner that stopped parsing must fail LOUDLY here
    // rather than sweep nothing and report the repo clean - which is exactly
    // how the pinned SlideOver case this guard replaces could have rotted.
    expect(FILES.length, 'the src/** walk must find source files').toBeGreaterThan(0)
    expect(ALL_DIALOGS.length, 'the scan must find role="dialog" overlays').toBeGreaterThan(0)
  })

  it('both D-16 classes are populated, so neither branch of the contract is dead', () => {
    // Token presence, never an owning file (L-031): the assertion is that a
    // modal dialog and a non-modal dialog each EXIST somewhere in src/**, so a
    // module split or a rename cannot quietly leave a branch unexercised.
    expect(ALL_DIALOGS.filter((tag) => ARIA_MODAL_TRUE.test(tag)).length).toBeGreaterThan(0)
    expect(ALL_DIALOGS.filter((tag) => !ARIA_MODAL_TRUE.test(tag)).length).toBeGreaterThan(0)
  })

  it('the seam clause 1 requires is the symbol useFocusTrap.ts actually exports', () => {
    // Pins the guard's vocabulary to the artifact that defines it, so renaming
    // the hook reddens here instead of silently hollowing out clause 1.
    expect(read('src/features/layout/useFocusTrap.ts')).toMatch(/export function useFocusTrap/)
  })

  it('a dialog that exists only in a comment is not counted', () => {
    // The stripper is load-bearing: six of the nine scanned files quote
    // `aria-modal="true"` in a doc header, and a raw scan would classify those
    // mentions as overlays.
    const source = [
      '// <div role="dialog" aria-modal="true"> in a line comment',
      '/* <div role="dialog"> in a block comment */',
      'export const NotAComponent = 1',
    ].join('\n')
    expect(dialogTags(source)).toEqual([])
    expect(auditOverlays(source)).toEqual([])
  })

  it('an expression attribute containing ">" does not truncate the tag', () => {
    // Guards the scanner itself: if `{...}` were not opaque, the tag would be
    // cut before its attributes and a real modal would read as unclassified.
    const source = `<div role="dialog" onKeyDown={(e) => close(e)} aria-modal="true" aria-label="X" ref={r}>`
    const [tag] = dialogTags(source)
    expect(tag).toBeDefined()
    expect(ARIA_MODAL_TRUE.test(tag)).toBe(true)
    expect(ACCESSIBLE_NAME.test(tag)).toBe(true)
  })
})

describe('contract B (D-16 clause 1): every aria-modal dialog adopts useFocusTrap', () => {
  it('finds zero modal dialogs whose file does not call the seam', () => {
    expect(
      offenders('trap'),
      'a container declaring aria-modal="true" tells assistive technology the page behind it is inert; ' +
        'without useFocusTrap the keyboard walks straight out of it. Call useFocusTrap(open, onClose) and ' +
        'attach the returned ref to the overlay\'s outermost element (see SlideOver.tsx)',
    ).toEqual([])
  })
})

describe('contract C (D-16 clause 2): every non-modal dialog handles Escape', () => {
  it('finds zero non-modal dialogs whose file has no Escape key handler', () => {
    expect(
      offenders('escape'),
      'a role="dialog" without aria-modal is exempt from the focus trap (the GuidedTour shape) but still ' +
        'owes the user a way out: handle event.key === \'Escape\' in the component',
    ).toEqual([])
  })
})

describe('contract D (D-16 clause 3): every dialog carries an accessible name', () => {
  it('finds zero dialogs with neither aria-label nor aria-labelledby', () => {
    expect(
      offenders('name'),
      'a dialog with no accessible name is announced as an unnamed group; add aria-label, or ' +
        'aria-labelledby pointing at the heading the overlay already renders',
    ).toEqual([])
  })
})

// The executable control D-15 demands (L-001). Each clause gets a fixture that
// must REDDEN and the compliant variant of the same fixture that must pass, so
// the guard is proven neither vacuous nor indiscriminate (L-034).
const MODAL_NO_TRAP = `
import { useState } from 'react'
export function Offender({ onClose }: { onClose: () => void }) {
  const [x] = useState(0)
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="offender-title">
      <h2 id="offender-title">{x}</h2>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  )
}
`

describe('contract E: the classifier reddens on each clause and passes its fix (L-001, L-034)', () => {
  it('flags a modal dialog whose file never calls the seam', () => {
    const found = auditOverlays(MODAL_NO_TRAP)
    expect(found.map((v) => v.clause)).toEqual(['trap'])
    expect(found[0].tag).toContain('aria-modal="true"')
  })

  it('IMPORTING the seam without calling it does not satisfy clause 1 (the L-033 shape)', () => {
    const importOnly = `import { useFocusTrap } from '../layout/useFocusTrap'\n${MODAL_NO_TRAP}`
    expect(auditOverlays(importOnly).map((v) => v.clause)).toEqual(['trap'])
  })

  it('accepts the same modal once the seam is actually called', () => {
    const fixed = MODAL_NO_TRAP.replace(
      'const [x] = useState(0)',
      'const [x] = useState(0)\n  const ref = useFocusTrap<HTMLDivElement>(true, onClose)',
    )
    expect(fixed).toContain('useFocusTrap<HTMLDivElement>(true, onClose)')
    expect(auditOverlays(fixed)).toEqual([])
  })

  it('counts calls, so a second modal dialog in the same file is not covered by one call', () => {
    const twoModals = `
const ref = useFocusTrap<HTMLDivElement>(true, onClose)
<div role="dialog" aria-modal="true" aria-label="First" ref={ref} />
<div role="dialog" aria-modal="true" aria-label="Second" />
`
    const found = auditOverlays(twoModals)
    expect(found.map((v) => v.clause)).toEqual(['trap'])
    expect(found[0].tag).toContain('Second')
  })

  it('flags a non-modal dialog with no Escape handler, and accepts one that has it', () => {
    const noEscape = `<div role="dialog" aria-label="Tour">{step}</div>`
    expect(auditOverlays(noEscape).map((v) => v.clause)).toEqual(['escape'])

    const withEscape = `
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
<div role="dialog" aria-label="Tour">{step}</div>
`
    expect(auditOverlays(withEscape)).toEqual([])
  })

  it('a bare mention of the word Escape does not satisfy clause 2', () => {
    // The distinctive shape is the key comparison, not the word (L-034).
    const prose = `
const copy = 'Press Escape to leave the tour'
<div role="dialog" aria-label="Tour">{copy}</div>
`
    expect(auditOverlays(prose).map((v) => v.clause)).toEqual(['escape'])
  })

  it('flags an unnamed dialog, and accepts either naming attribute', () => {
    const unnamed = `
const ref = useFocusTrap<HTMLDivElement>(true, onClose)
<div role="dialog" aria-modal="true" ref={ref}>x</div>
`
    expect(auditOverlays(unnamed).map((v) => v.clause)).toEqual(['name'])

    const labelled = unnamed.replace('ref={ref}>', 'aria-label="Named" ref={ref}>')
    expect(auditOverlays(labelled)).toEqual([])

    const labelledBy = unnamed.replace('ref={ref}>', 'aria-labelledby="t" ref={ref}>')
    expect(auditOverlays(labelledBy)).toEqual([])
  })

  it('reports every failing clause of one dialog rather than stopping at the first', () => {
    const worstCase = `<div role="dialog" aria-modal="true">x</div>`
    expect(auditOverlays(worstCase).map((v) => v.clause).sort()).toEqual(['name', 'trap'])
  })

  it('ignores markup that is not a dialog, so the guard is not rejecting everything', () => {
    const notADialog = `
<div className="fixed inset-0 pointer-events-none" />
<section role="region" aria-label="Status">ok</section>
`
    expect(auditOverlays(notADialog)).toEqual([])
  })
})
