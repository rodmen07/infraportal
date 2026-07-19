import { describe, expect, it } from 'vitest'
import { createProjectsStore } from './projectsStore.mock'
import {
  DELIVERABLE_STATUSES,
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
} from './projectStatusVocabulary'

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
    snap!.milestones[0].status = 'pending'
    expect(store.listProjects()[0].name).toBe('Cloud Migration - Acme Corp')
    expect(store.listMilestones('proj-001')[0].status).toBe('completed')
    expect(store.snapshot('proj-nope')).toBeNull()
  })

  it('seeds only statuses the projects-service spec allows (v1.16.5 PR2 reconciliation)', () => {
    const store = createProjectsStore()
    for (const project of store.listProjects()) {
      expect(PROJECT_STATUSES).toContain(project.status)
      for (const milestone of store.listMilestones(project.id)) {
        expect(MILESTONE_STATUSES).toContain(milestone.status)
        for (const deliverable of store.listDeliverables(milestone.id)) {
          expect(DELIVERABLE_STATUSES).toContain(deliverable.status)
        }
      }
    }
    // The seed still demonstrates the full deliverable lifecycle, including
    // the review state that replaced the old off-spec "blocked" value.
    const allDeliverableStatuses = new Set(
      store.listProjects()
        .flatMap(p => store.listMilestones(p.id))
        .flatMap(m => store.listDeliverables(m.id))
        .map(d => d.status),
    )
    expect([...allDeliverableStatuses].sort()).toEqual([...DELIVERABLE_STATUSES].sort())
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
    expect(clonedDeliverables.every(d => d.status === 'not_started')).toBe(true)

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
      expect(created.every(d => d.status === 'not_started')).toBe(true)
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

  it('getTemplate returns an isolated copy, and null for unknown ids', () => {
    const store = createProjectsStore()
    const template = store.getTemplate('tpl-001')
    expect(template).toMatchObject({ id: 'tpl-001', name: 'Standard consulting engagement' })
    template!.name = 'Mutated'
    template!.milestones[0].deliverables.push({ name: 'Injected' })
    expect(store.getTemplate('tpl-001')).toMatchObject({ name: 'Standard consulting engagement' })
    expect(store.getTemplate('tpl-001')!.milestones[0].deliverables).toHaveLength(2)
    expect(store.getTemplate('tpl-nope')).toBeNull()
  })

  it('listTemplates copies nested structure so callers cannot mutate the store', () => {
    const store = createProjectsStore()
    store.listTemplates()[0].milestones.pop()
    expect(store.getTemplate('tpl-001')!.milestones).toHaveLength(3)
  })
})

describe('projectsStore template CRUD (v1.16.5 PR2)', () => {
  it('createTemplate builds a scratch template that instantiates like any other', () => {
    const store = createProjectsStore({ now: () => FIXED_NOW })
    const template = store.createTemplate(' Onboarding track ', [
      { name: ' Setup ', deliverables: [' Access checklist ', ''] },
      { name: '', deliverables: ['dropped with its row'] },
      { name: 'Launch', deliverables: ['Go-live review'] },
    ])

    expect(template).toMatchObject({
      name: 'Onboarding track',
      source_project_name: 'scratch',
      created_at: FIXED_NOW,
    })
    expect(template!.milestones).toEqual([
      { name: 'Setup', sort_order: 0, deliverables: [{ name: 'Access checklist' }] },
      { name: 'Launch', sort_order: 1, deliverables: [{ name: 'Go-live review' }] },
    ])
    expect(store.listTemplates()).toHaveLength(2)

    const project = store.createFromTemplate(template!.id, 'First client onboarding')
    expect(project).toMatchObject({ name: 'First client onboarding', status: 'planning' })
    const milestones = store.listMilestones(project!.id)
    expect(milestones.map(m => m.name)).toEqual(['Setup', 'Launch'])
    expect(store.listDeliverables(milestones[0].id).map(d => d.status)).toEqual(['not_started'])
  })

  it('createTemplate rejects unusable drafts without touching the library', () => {
    const store = createProjectsStore()
    expect(store.createTemplate('   ', [{ name: 'Setup', deliverables: [] }])).toBeNull()
    expect(store.createTemplate('Named', [{ name: '  ', deliverables: ['x'] }])).toBeNull()
    expect(store.listTemplates()).toHaveLength(1)
  })

  it('updateTemplate renames and restructures in place, keeping id and provenance', () => {
    const store = createProjectsStore({ now: () => FIXED_NOW })
    const renamed = store.updateTemplate('tpl-001', { name: ' Consulting v2 ' })
    expect(renamed).toMatchObject({ id: 'tpl-001', name: 'Consulting v2', source_project_name: 'Starter' })
    expect(renamed!.milestones.map(m => m.name)).toEqual(['Discovery', 'Build', 'Handover'])

    const restructured = store.updateTemplate('tpl-001', {
      milestones: [{ name: 'Single phase', deliverables: [' Everything ', ' '] }],
    })
    expect(restructured!.name).toBe('Consulting v2')
    expect(restructured!.milestones).toEqual([
      { name: 'Single phase', sort_order: 0, deliverables: [{ name: 'Everything' }] },
    ])
    expect(store.getTemplate('tpl-001')).toEqual(restructured)
    expect(store.listTemplates()).toHaveLength(1) // edited, not duplicated
  })

  it('updateTemplate returns null and leaves the template untouched for unknown ids and unusable edits', () => {
    const store = createProjectsStore()
    const before = store.getTemplate('tpl-001')
    expect(store.updateTemplate('tpl-nope', { name: 'X' })).toBeNull()
    expect(store.updateTemplate('tpl-001', { name: '   ' })).toBeNull()
    expect(store.updateTemplate('tpl-001', { milestones: [] })).toBeNull()
    expect(store.getTemplate('tpl-001')).toEqual(before)
  })
})

describe('projectsStore direct CRUD (v1.17.2 playground adapter surface)', () => {
  it('creates, reads, patches, and removes a project; budget starts null', () => {
    const store = createProjectsStore({ now: () => FIXED_NOW })
    const created = store.createProject({ account_id: 'acct-900', name: 'Direct build' })
    expect(created).toMatchObject({
      account_id: 'acct-900', name: 'Direct build', status: 'active',
      client_user_id: null, description: null, budget: null,
      created_at: FIXED_NOW, updated_at: FIXED_NOW,
    })
    expect(store.getProject(created.id)).toMatchObject({ name: 'Direct build' })
    expect(store.getProject('proj-nope')).toBeNull()

    const patched = store.updateProject(created.id, { status: 'on_hold', name: undefined })
    expect(patched).toMatchObject({ name: 'Direct build', status: 'on_hold' })
    expect(store.updateProject('proj-nope', { name: 'x' })).toBeNull()

    expect(store.removeProject(created.id)).toBe(true)
    expect(store.removeProject(created.id)).toBe(false)
    expect(store.listProjects()).toHaveLength(3)
  })

  it('creates milestones and deliverables only under existing parents', () => {
    const store = createProjectsStore({ now: () => FIXED_NOW })
    expect(store.createMilestone('proj-nope', { name: 'Orphan' })).toBeNull()

    const milestone = store.createMilestone('proj-003', { name: 'Launch prep', sort_order: 9 })
    expect(milestone).toMatchObject({
      project_id: 'proj-003', name: 'Launch prep', status: 'pending', sort_order: 9,
    })
    expect(store.getMilestone(milestone!.id)).not.toBeNull()

    expect(store.createDeliverable('ms-nope', { name: 'Orphan' })).toBeNull()
    const deliverable = store.createDeliverable(milestone!.id, { name: 'Checklist' })
    // Direct creates default to the projects-service API enum vocabulary.
    expect(deliverable).toMatchObject({ status: 'not_started', estimated_hours: null })
    expect(store.getDeliverable(deliverable!.id)).not.toBeNull()

    expect(store.updateDeliverable(deliverable!.id, { status: 'in_review' })).toMatchObject({
      status: 'in_review',
    })
    expect(store.updateMilestone(milestone!.id, { status: 'completed' })).toMatchObject({
      status: 'completed',
    })
    expect(store.removeDeliverable(deliverable!.id)).toBe(true)
    expect(store.removeMilestone(milestone!.id)).toBe(true)
    expect(store.removeMilestone(milestone!.id)).toBe(false)
  })

  it('removeProject does not cascade: children stay until removed explicitly', () => {
    const store = createProjectsStore()
    expect(store.removeProject('proj-003')).toBe(true)
    // The no-cascade contract leaves the orphaned milestones queryable.
    expect(store.listMilestones('proj-003')).toHaveLength(2)
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
    store.updateTemplate(template!.id, { name: 'Migration track v2' })
    const scratch = store.createTemplate('Scratch track', [{ name: 'Only phase', deliverables: [] }])
    store.removeTemplate(template!.id)
    store.removeTemplate(scratch!.id)
    expect(calls).toBe(7)

    // Failed operations do not notify.
    store.cloneProject('proj-nope', ALL_OPTIONS)
    store.saveTemplate('proj-nope', 'Nope')
    store.createFromTemplate('tpl-nope', 'Nope')
    store.createTemplate('  ', [])
    store.updateTemplate('tpl-nope', { name: 'X' })
    store.updateTemplate('tpl-001', { name: '  ' })
    store.removeTemplate('tpl-nope')
    expect(calls).toBe(7)

    unsubscribe()
    store.reset()
    expect(calls).toBe(7)
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
