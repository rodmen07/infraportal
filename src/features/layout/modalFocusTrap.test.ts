// @vitest-environment jsdom
/**
 * v1.24.1 (ROADMAP "v1.24 - Reachable without a mouse", decision D-14):
 * behaviour proof that the five previously zero-behaviour modals really adopted
 * `useFocusTrap`, not just imported it.
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

function press(key: string, shiftKey = false): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))
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
