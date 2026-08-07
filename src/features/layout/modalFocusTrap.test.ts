// @vitest-environment jsdom
/**
 * ROADMAP "v1.24 - Reachable without a mouse", decision D-14: behaviour proof
 * that the overlays which declare `aria-modal="true"` really adopted
 * `useFocusTrap`, not just imported it.
 *
 *   - v1.24.1 covered the five previously zero-behaviour modals (BulkEdit,
 *     BulkImport, ProjectClone, TemplateEditor, and crm/ui's shared Modal).
 *   - v1.24.2 adds the two surfaces that had their own behaviour to RECONCILE
 *     rather than to add: `ReportsPage`'s formerly unnamed overlay, which joins
 *     the table below because its shape is identical, and `CommandPalette`,
 *     which gets its own block at the bottom of this file because it is always
 *     mounted, opens on Cmd/Ctrl-K, and closes without unmounting.
 *
 * The milestone's done-when is explicit that the grep clause
 * (`grep -rln "useFocusTrap" src --include=*.tsx` listing six files) can be
 * satisfied by a comment or an unused import (L-033), so it is paired with this
 * file: each modal is RENDERED for real under jsdom and driven through the whole
 * modal keyboard contract the hook exists to provide.
 *
 * Four assertions per modal, and every one of them fails if the
 * `useFocusTrap(...)` call is deleted from that component:
 *   1. focus-in     - opening moves focus to the first focusable element inside
 *                     the overlay, instead of leaving it on the trigger behind it.
 *   2. Escape       - Escape closes the modal.
 *   3. Tab trap     - Tab from the last focusable wraps to the first, and
 *                     Shift+Tab from the first wraps to the last, so the keyboard
 *                     cannot walk out of a container that told assistive
 *                     technology (`aria-modal="true"`) that the page behind it
 *                     is inert.
 *   4. focus-return - closing (unmount, which is how every caller closes these)
 *                     returns focus to the element that opened the overlay.
 *
 * The focusable set is computed with the hook's own exported
 * FOCUSABLE_SELECTOR, so "the last focusable element" here means exactly what
 * the trap means by it rather than a second, driftable definition.
 */

import { act, createElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FOCUSABLE_SELECTOR } from './useFocusTrap'
import { BulkEditModal } from '../../components/BulkEditModal'
import { BulkImportModal } from '../../components/BulkImportModal'
import { ProjectCloneModal } from '../../components/ProjectCloneModal'
import { TemplateEditorModal } from '../../components/TemplateEditorModal'
import { createProjectsStore } from '../../lib/projectsStore.mock'
import { Modal } from '../crm/ui'
import { Modal as ReportsModal } from '../../pages/ReportsPage'
import { CommandPalette } from '../commandPalette/CommandPalette'
import { COMMANDS } from '../commandPalette/commands'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let trigger: HTMLButtonElement
let root: Root
let closed: number

beforeEach(() => {
  closed = 0
  // A real element outside the overlay, focused before the modal opens: this is
  // the "trigger" the contract says focus must come back to.
  trigger = document.createElement('button')
  trigger.textContent = 'Open'
  document.body.appendChild(trigger)
  trigger.focus()

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  trigger.remove()
})

function focusables(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
}

function press(key: string, shiftKey = false, ctrlKey = false): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, ctrlKey, bubbles: true }))
  })
}

const onClose = () => { closed += 1 }

/**
 * One entry per modal migrated in v1.24.1. Each renders the REAL component with
 * the minimum props it needs; nothing is mocked away, because the point is that
 * the shipped component wires the hook.
 */
const MODALS: { name: string; render: () => ReactElement }[] = [
  {
    name: 'BulkEditModal',
    render: () =>
      createElement(BulkEditModal, {
        entity: 'contacts',
        targets: [{ id: 'con-1', label: 'Ada Lovelace' }],
        onClose,
      }),
  },
  {
    name: 'BulkImportModal',
    render: () => createElement(BulkImportModal, { onClose }),
  },
  {
    name: 'ProjectCloneModal',
    render: () => {
      const store = createProjectsStore({ now: () => '2026-08-07T12:00:00Z' })
      return createElement(ProjectCloneModal, {
        projects: store.listProjects().map((p) => ({ id: p.id, name: p.name })),
        store,
        onClose,
      })
    },
  },
  {
    name: 'TemplateEditorModal',
    render: () =>
      createElement(TemplateEditorModal, {
        store: createProjectsStore({ now: () => '2026-08-07T12:00:00Z' }),
        onSaved: () => {},
        onClose,
      }),
  },
  {
    name: 'crm/ui Modal',
    render: () =>
      createElement(Modal, {
        title: 'New account',
        onClose,
        children: createElement('button', { type: 'button' }, 'Save'),
      }),
  },
  {
    // v1.24.2. Two children rather than one because this Modal, unlike crm/ui's,
    // renders no ✕ button of its own, and the real callers always pass a form
    // with several controls (ReportForm / ExportForm / the delete confirmation).
    name: 'ReportsPage Modal',
    render: () =>
      createElement(ReportsModal, {
        title: 'New Report',
        onClose,
        children: [
          createElement('button', { key: 'save', type: 'button' }, 'Save'),
          createElement('button', { key: 'cancel', type: 'button' }, 'Cancel'),
        ],
      }),
  },
]

describe.each(MODALS)('$name keyboard contract (v1.24.1 D-14)', ({ render }) => {
  beforeEach(() => {
    act(() => root.render(render()))
  })

  it('declares aria-modal, so the trap is a promise it has to keep', () => {
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.getAttribute('aria-modal')).toBe('true')
  })

  it('carries an accessible name a screen reader can actually resolve', () => {
    // v1.24.2 (D-16): a dialog with no name is announced as "dialog" and
    // nothing else. `aria-labelledby` is only a name if the id it points at
    // exists and has text, so the reference is followed rather than counted.
    const dialog = container.querySelector('[role="dialog"]')!
    const labelledBy = dialog.getAttribute('aria-labelledby')
    if (labelledBy) {
      const label = container.querySelector(`#${labelledBy}`)
      expect(label, `aria-labelledby="${labelledBy}" points at no element`).not.toBeNull()
      expect(label!.textContent?.trim()).not.toBe('')
    } else {
      expect(dialog.getAttribute('aria-label')?.trim()).toBeTruthy()
    }
  })

  it('moves focus into the overlay when it opens', () => {
    const items = focusables()
    expect(items.length).toBeGreaterThan(1)
    expect(document.activeElement).toBe(items[0])
    expect(container.contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape', () => {
    expect(closed).toBe(0)
    press('Escape')
    expect(closed).toBe(1)
  })

  it('wraps Tab from the last focusable back to the first', () => {
    const items = focusables()
    const last = items[items.length - 1]
    act(() => last.focus())
    expect(document.activeElement).toBe(last)

    press('Tab')
    expect(document.activeElement).toBe(items[0])
  })

  it('wraps Shift+Tab from the first focusable back to the last', () => {
    const items = focusables()
    act(() => items[0].focus())
    expect(document.activeElement).toBe(items[0])

    press('Tab', true)
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('returns focus to the trigger when it closes', () => {
    expect(document.activeElement).not.toBe(trigger)
    act(() => root.render(null))
    expect(document.activeElement).toBe(trigger)
  })
})

/**
 * v1.24.2, the second of the two surfaces with existing behaviour to reconcile.
 *
 * `CommandPalette` does not fit the table above: it is mounted for the app's
 * whole life and renders null while closed, it opens on Cmd/Ctrl-K rather than
 * from a prop, and it closes by flipping its own state instead of unmounting.
 * It also arrived with three quarters of the contract hand-rolled (Escape bound
 * to the search input, focus-in, and a private restoreFocusRef) and no Tab trap
 * at all - which is the exact gap the milestone names: Tab off the last result
 * walked out of a container whose aria-modal="true" had just told assistive
 * technology the page behind it was inert.
 *
 * Every assertion here fails if the `useFocusTrap(open, close)` call is deleted
 * from CommandPalette.tsx, including the two that describe behaviour the old
 * hand-rolled code also had, because that code was deleted in the same change
 * rather than left to drift alongside the hook.
 */
describe('CommandPalette keyboard contract (v1.24.2 D-14)', () => {
  let scrollIntoView: unknown

  beforeEach(() => {
    // jsdom implements no layout, so Element.prototype.scrollIntoView does not
    // exist; the palette calls it to keep the highlighted row in view.
    scrollIntoView = (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
    ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = () => {}

    act(() => root.render(createElement(CommandPalette)))
    // Cmd/Ctrl-K is the palette's only keyboard entry point. Dispatching on
    // document also reaches the window listener it registers, since window is
    // the last node in a document-targeted event's propagation path.
    press('k', false, true)
  })

  afterEach(() => {
    ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = scrollIntoView
  })

  function palette(): HTMLElement {
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog, 'the palette did not open on Ctrl+K').not.toBeNull()
    return dialog!
  }

  it('opens as a named, aria-modal dialog with every command reachable', () => {
    const dialog = palette()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Command palette')
    // The result rows are the focusable set the trap has to hold, so an empty
    // list would make the wrap assertions below vacuously true.
    expect(container.querySelectorAll('[role="option"]').length).toBe(COMMANDS.length)
  })

  it('moves focus into the search input when it opens', () => {
    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!
    expect(document.activeElement).toBe(input)
  })

  it('traps Tab: tabbing off the last result stays inside the palette', () => {
    const items = focusables()
    const last = items[items.length - 1]
    expect(palette().contains(last)).toBe(true)

    act(() => last.focus())
    press('Tab')

    expect(document.activeElement).toBe(items[0])
    expect(palette().contains(document.activeElement)).toBe(true)
  })

  it('traps Shift+Tab: tabbing back off the search input stays inside', () => {
    const items = focusables()
    act(() => items[0].focus())
    press('Tab', true)

    expect(document.activeElement).toBe(items[items.length - 1])
    expect(palette().contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape from a result row, not only from the search input', () => {
    const items = focusables()
    const aResult = items[items.length - 1]
    act(() => aResult.focus())

    press('Escape')

    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('returns focus to whatever opened it', () => {
    expect(document.activeElement).not.toBe(trigger)
    press('Escape')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
