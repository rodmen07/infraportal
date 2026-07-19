// @vitest-environment jsdom
/**
 * Wiring test for the clone flow end to end (v1.16.5 PR2): renders the real
 * ProjectCloneModal against an injected fresh demo store and drives
 * configure -> review -> clone through DOM events, with fake timers standing
 * in for the staged progress delays. The clone engine itself is covered in
 * the node-env suites; this file proves the modal wiring lands the copy in
 * the store and reports it honestly.
 */

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectsStore, type ProjectsStore } from '../lib/projectsStore.mock'
import { ProjectCloneModal } from './ProjectCloneModal'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let store: ProjectsStore
let closed: boolean

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  store = createProjectsStore({ now: () => '2026-07-19T12:00:00Z' })
  closed = false
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function render(initialSourceId?: string): void {
  const projects = store.listProjects().map((p) => ({ id: p.id, name: p.name }))
  act(() => {
    root.render(
      createElement(ProjectCloneModal, {
        projects,
        initialSourceId,
        store,
        onClose: () => { closed = true },
      }),
    )
  })
}

function click(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function buttonByText(text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )
  expect(match, `button "${text}" not found`).toBeDefined()
  return match!
}

describe('ProjectCloneModal wiring', () => {
  it('walks configure -> review -> clone and lands the copy in the store', async () => {
    render('proj-001')
    expect(container.textContent).toContain('Demo mode')

    const nameInput = container.querySelector<HTMLInputElement>('#clone-name')!
    expect(nameInput.value).toBe('Cloud Migration - Acme Corp (copy)')

    click(buttonByText('Review clone'))
    // The confirm summary spells out the spec-vocabulary reset per record type.
    expect(container.textContent).toContain('Includes 3 milestones and 7 deliverables')
    expect(container.textContent).toContain(
      'Statuses reset: project to planning, milestones to pending, deliverables to not started',
    )
    expect(container.textContent).toContain('The copy starts unassigned')

    click(buttonByText('Clone project'))
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    const projects = store.listProjects()
    expect(projects).toHaveLength(4)
    const copy = projects[3]
    expect(copy).toMatchObject({
      name: 'Cloud Migration - Acme Corp (copy)',
      status: 'planning',
      client_user_id: null,
    })
    const milestones = store.listMilestones(copy.id)
    expect(milestones).toHaveLength(3)
    expect(milestones.every((m) => m.status === 'pending')).toBe(true)
    const deliverables = milestones.flatMap((m) => store.listDeliverables(m.id))
    expect(deliverables).toHaveLength(7)
    expect(deliverables.every((d) => d.status === 'not_started')).toBe(true)

    expect(container.textContent).toContain(
      'Created Cloud Migration - Acme Corp (copy) with 3 milestones and 7 deliverables.',
    )
    click(buttonByText('Close'))
    expect(closed).toBe(true)
  })

  it('can step back from review, and cancel closes without cloning', () => {
    render()
    click(buttonByText('Review clone'))
    click(buttonByText('Back'))
    expect(container.querySelector('#clone-name')).not.toBeNull()

    click(buttonByText('Cancel'))
    expect(closed).toBe(true)
    expect(store.listProjects()).toHaveLength(3)
  })
})
