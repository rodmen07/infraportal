// @vitest-environment jsdom
/**
 * Wiring tests for the template library (v1.16.5 PR2): renders the real
 * TemplateLibrary against an injected fresh demo store and drives the full
 * CRUD surface through DOM events. Create from an existing project, create
 * from scratch and edit via the TemplateEditorModal, delete behind the inline
 * confirm, and start a project from a template. Pure normalization and store
 * semantics are covered in the node-env suites; this file covers the DOM
 * wiring in the repo's jsdom style (see TryItPanel.test.ts).
 */

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createProjectsStore, type ProjectsStore } from '../lib/projectsStore.mock'
import { TemplateLibrary } from './TemplateLibrary'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let store: ProjectsStore

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  store = createProjectsStore({ now: () => '2026-07-19T12:00:00Z' })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(): void {
  const projects = store.listProjects().map((p) => ({ id: p.id, name: p.name }))
  act(() => {
    root.render(createElement(TemplateLibrary, { projects, store }))
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

function buttonByLabel(label: string): HTMLButtonElement {
  const match = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(match, `button labeled "${label}" not found`).not.toBeNull()
  return match!
}

function fieldByLabel<T extends HTMLInputElement | HTMLSelectElement>(label: string): T {
  const match = container.querySelector<T>(`[aria-label="${label}"]`)
  expect(match, `field labeled "${label}" not found`).not.toBeNull()
  return match!
}

/** React reads values through the native setter; go around it, then notify. */
function setValue(field: HTMLInputElement | HTMLSelectElement, value: string): void {
  const prototype = field instanceof HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
  act(() => {
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}

describe('TemplateLibrary CRUD wiring', () => {
  it('shows the demo badge and an empty state naming both creation paths', () => {
    store.removeTemplate('tpl-001')
    render()
    expect(container.textContent).toContain('Demo data')
    expect(container.textContent).toContain('No templates yet')
    expect(container.textContent).toContain('New template')
  })

  it('saves a template from an existing project and reports it', () => {
    render()
    setValue(fieldByLabel('Project to save as template'), 'proj-002')
    setValue(fieldByLabel('Template name'), 'SOC 2 track')
    click(buttonByText('Save template'))

    expect(store.listTemplates().map((t) => t.name)).toContain('SOC 2 track')
    expect(container.textContent).toContain('Saved template "SOC 2 track" from SOC 2 Readiness - Globex.')
  })

  it('deletes only after the inline confirm, and cancel disarms it', () => {
    render()
    click(buttonByLabel('Delete template Standard consulting engagement'))
    expect(container.textContent).toContain('This cannot be undone')
    click(buttonByText('Cancel'))
    expect(store.listTemplates()).toHaveLength(1)

    click(buttonByLabel('Delete template Standard consulting engagement'))
    click(buttonByText('Delete template'))
    expect(store.listTemplates()).toHaveLength(0)
    expect(container.textContent).toContain('Deleted template "Standard consulting engagement".')
    expect(container.textContent).toContain('No templates yet')
  })

  it('creates a planning project from a template through the inline form', () => {
    render()
    click(buttonByText('New project'))
    const nameField = fieldByLabel<HTMLInputElement>('New project name')
    expect(nameField.value).toBe('Standard consulting engagement project')
    click(buttonByText('Create project'))

    const projects = store.listProjects()
    expect(projects).toHaveLength(4)
    expect(projects[3]).toMatchObject({
      name: 'Standard consulting engagement project',
      status: 'planning',
    })
    expect(container.textContent).toContain('It now appears in the projects list.')
  })

  it('creates a template from scratch in the editor, honoring reorder and validation', () => {
    render()
    click(buttonByText('New template'))
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.textContent).toContain('Demo mode')

    // Unusable drafts cannot be saved.
    expect(buttonByText('Create template').disabled).toBe(true)
    setValue(container.querySelector<HTMLInputElement>('#template-editor-name')!, 'Onboarding track')
    expect(buttonByText('Create template').disabled).toBe(true) // milestone still unnamed
    setValue(fieldByLabel('Milestone 1 name'), 'Phase A')
    expect(buttonByText('Create template').disabled).toBe(false)

    setValue(fieldByLabel('Milestone 1 deliverable 1 name'), 'Access checklist')
    click(buttonByText('+ Milestone'))
    setValue(fieldByLabel('Milestone 2 name'), 'Phase B')
    click(buttonByLabel('Move milestone 2 up'))
    click(buttonByText('Create template'))

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    const created = store.listTemplates().find((t) => t.name === 'Onboarding track')
    expect(created).toMatchObject({ source_project_name: 'scratch' })
    expect(created!.milestones.map((m) => m.name)).toEqual(['Phase B', 'Phase A'])
    expect(created!.milestones[1].deliverables).toEqual([{ name: 'Access checklist' }])
    expect(container.textContent).toContain('from scratch')
    expect(container.textContent).toContain('Created template "Onboarding track" from scratch.')
  })

  it('edits an existing template in place through the editor', () => {
    render()
    click(buttonByLabel('Edit template Standard consulting engagement'))
    const nameField = container.querySelector<HTMLInputElement>('#template-editor-name')!
    expect(nameField.value).toBe('Standard consulting engagement')
    expect(fieldByLabel<HTMLInputElement>('Milestone 1 name').value).toBe('Discovery')

    setValue(nameField, 'Standard v2')
    click(buttonByLabel('Remove milestone 3'))
    click(buttonByText('Save changes'))

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(store.listTemplates()).toHaveLength(1) // edited, not duplicated
    const updated = store.getTemplate('tpl-001')!
    expect(updated.name).toBe('Standard v2')
    expect(updated.milestones.map((m) => m.name)).toEqual(['Discovery', 'Build'])
    expect(container.textContent).toContain('Updated template "Standard v2".')
  })
})
