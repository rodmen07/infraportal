import { describe, expect, it } from 'vitest'
import { createProjectsStore } from './projectsStore.mock'

const FIXED_NOW = '2026-07-19T12:00:00Z'

const ALL_OPTIONS = {
  newName: 'The copy',
  includeMilestones: true,
  includeDeliverables: true,
  resetStatuses: true,
}

describe('projectsStore seed', () => {
  it('is seeded with three linked projects and one starter template', () => {
    const store = createProjectsStore()
    const projects = store.listProjects()

    expect(projects).toHaveLength(3)
    expect(projects.map(p => p.id)).toEqual(['proj-001', 'proj-002', 'proj-003'])
    expect(projects[0]).toMatchObject({
      name: 'Cloud Migration - Acme Corp', status: 'active', budget: 24000,
    })

    // Every project has milestones; every milestone has deliverables and a
    // valid parent; deliverables always resolve to a seeded milestone.
    for (const project of projects) {
      const milestones = store.listMilestones(project.id)
      expect(milestones.length).toBeGreaterThanOrEqual(2)
      milestones.forEach((milestone, index) => {
        expect(milestone.project_id).toBe(project.id)
        expect(milestone.sort_order).toBe(index) // returned in sort order
        expect(store.listDeliverables(milestone.id).length).toBeGreaterThanOrEqual(1)
      })
    }

    const templates = store.listTemplates()
    expect(templates).toHaveLength(1)
    expect(templates[0]).toMatchObject({ id: 'tpl-001', name: 'Standard consulting engagement' })
    expect(templates[0].milestones.map(m => m.name)).toEqual(['Discovery', 'Build', 'Handover'])
  })

  it('returns list snapshots that do not expose internal state', () => {
    const store = createProjectsStore()
    store.listProjects().pop()
    store.listMilestones('proj-001').pop()
    store.listTemplates().pop()
    expect(store.listProjects()).toHaveLength(3)
    expect(store.listMilestones('proj-001')).toHaveLength(3)
    expect(store.listTemplates()).toHaveLength(1)
  })

  it('snapshot copies records so callers cannot mutate the store', () => {
    const store = createProjectsStore()
    const snap = store.snapshot('proj-001')
    expect(snap).not.toBeNull()
    snap!.project.name = 'Mutated'
    snap!.milestones[0].status = 'blocked'
    expect(store.listProjects()[0].name).toBe('Cloud Migration - Acme Corp')
    expect(store.listMilestones('proj-001')[0].status).toBe('completed')
    expect(store.snapshot('proj-nope')).toBeNull()
  })
})

describe('projectsStore cloning', () => {
  it('clones a project with milestones and deliverables and appends it to the list', () => {
    const store = createProjectsStore({ now: () => FIXED_NOW })
    const sourceMilestones = store.listMilestones('proj-001')
    const sourceDeliverableCount = sourceMilestones
      .reduce((n, m) => n + store.listDeliverables(m.id).length, 0)

    const clone = store.cloneProject('proj-001', ALL_OPTIONS)

    expect(clone).not.toBeNull()
    expect(clone).toMatchObject({
      name: 'The copy', status: 'planning', client_user_id: null, created_at: FIXED_NOW,
    })
    const projects = store.listProjects()
    expect(projects).toHaveLength(4)
    expect(projects[3].id).toBe(clone!.id)

    const clonedMilestones = store.listMilestones(clone!.id)
    expect(clonedMilestones).toHaveLength(sourceMilestones.length)
    expect(clonedMilestones.map(m => m.name)).toEqual(sourceMilestones.map(m => m.name))
    expect(clonedMilestones.every(m => m.status === 'pending')).toBe(true)
    const clonedDeliverables = clonedMilestones.flatMap(m => store.listDeliverables(m.id))
    expect(clonedDeliverables).toHaveLength(sourceDeliverableCount)
    expect(clonedDeliverables.every(d => d.status === 'pending')).toBe(true)

    // The source keeps its ids and statuses.
    expect(store.listMilestones('proj-001').map(m => m.status)).toEqual(['completed', 'in_progress', 'pending'])
  })

  it('clones project details only when milestones are excluded', () => {
    const store = createProjectsStore()
    const clone = store.cloneProject('proj-002', { ...ALL_OPTIONS, includeMilestones: false })
    expect(clone).not.toBeNull()
    expect(store.listMilestones(clone!.id)).toHaveLength(0)
  })

  it('returns null for an unknown source project', () => {
    const store = createProjectsStore()
    expect(store.cloneProject('proj-nope', ALL_OPTIONS)).toBeNull()
    expect(store.listProjects()).toHaveLength(3)
  })
})

describe('projectsStore templates', () => {
  it('saves a template from a project and creates a matching project from it', () => {
    const store = createProjectsStore({ now: () => FIXED_NOW })
    const sourceMilestones = store.listMilestones('proj-002')

    const template = store.saveTemplate('proj-002', 'SOC 2 track')
    expect(template).toMatchObject({ name: 'SOC 2 track', source_project_name: 'SOC 2 Readiness - Globex' })
    expect(store.listTemplates()).toHaveLength(2)
    expect(template!.milestones.map(m => m.name)).toEqual(sourceMilestones.map(m => m.name))

    const project = store.createFromTemplate(template!.id, 'SOC 2 - New client')
    expect(project).toMatchObject({ name: 'SOC 2 - New client', status: 'planning', created_at: FIXED_NOW })
    expect(store.listProjects()).toHaveLength(4)

    const createdMilestones = store.listMilestones(project!.id)
    expect(createdMilestones.map(m => m.name)).toEqual(sourceMilestones.map(m => m.name))
    expect(createdMilestones.every(m => m.status === 'pending')).toBe(true)
    createdMilestones.forEach((milestone, index) => {
      const created = store.listDeliverables(milestone.id)
      const source = store.listDeliverables(sourceMilestones[index].id)
      expect(created.map(d => d.name)).toEqual(source.map(d => d.name))
      expect(created.every(d => d.status === 'pending')).toBe(true)
    })
  })

  it('returns null for unknown projects and templates, and removes templates by id', () => {
    const store = createProjectsStore()
    expect(store.saveTemplate('proj-nope', 'Nope')).toBeNull()
    expect(store.createFromTemplate('tpl-nope', 'Nope')).toBeNull()
    expect(store.removeTemplate('tpl-001')).toBe(true)
    expect(store.removeTemplate('tpl-001')).toBe(false)
    expect(store.listTemplates()).toHaveLength(0)
  })
})

describe('projectsStore notifications and reset', () => {
  it('notifies subscribers on every mutation and honors unsubscribe', () => {
    const store = createProjectsStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => { calls += 1 })

    store.cloneProject('proj-001', ALL_OPTIONS)
    const template = store.saveTemplate('proj-001', 'Migration track')
    store.createFromTemplate(template!.id, 'From template')
    store.removeTemplate(template!.id)
    expect(calls).toBe(4)

    // Failed operations do not notify.
    store.cloneProject('proj-nope', ALL_OPTIONS)
    store.saveTemplate('proj-nope', 'Nope')
    store.createFromTemplate('tpl-nope', 'Nope')
    store.removeTemplate('tpl-nope')
    expect(calls).toBe(4)

    unsubscribe()
    store.reset()
    expect(calls).toBe(4)
  })

  it('reset restores the seed after clones and template edits', () => {
    const store = createProjectsStore()
    const clone = store.cloneProject('proj-001', ALL_OPTIONS)
    store.saveTemplate('proj-001', 'Extra template')
    store.removeTemplate('tpl-001')
    expect(store.listProjects()).toHaveLength(4)

    store.reset()
    expect(store.listProjects().map(p => p.id)).toEqual(['proj-001', 'proj-002', 'proj-003'])
    expect(store.listTemplates().map(t => t.id)).toEqual(['tpl-001'])
    expect(store.listMilestones(clone!.id)).toHaveLength(0)

    // Ids stay unique across resets: a new clone never reuses a pre-reset id.
    const next = store.cloneProject('proj-001', ALL_OPTIONS)
    expect(next!.id).not.toBe(clone!.id)
  })
})
