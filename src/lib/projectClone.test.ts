import { describe, expect, it } from 'vitest'
import {
  buildTemplate,
  buildTemplateFromStructure,
  cloneProjectSnapshot,
  instantiateTemplate,
  normalizeTemplateStructure,
  reviseTemplate,
  templateDeliverableCount,
  TEMPLATE_PROJECT_ACCOUNT_ID,
  TEMPLATE_SCRATCH_SOURCE,
  type CloneDeps,
  type CloneOptions,
  type ProjectSnapshot,
  type ProjectTemplate,
} from './projectClone'

const FIXED_NOW = '2026-07-19T12:00:00Z'

function makeDeps(): CloneDeps {
  let projects = 0, milestones = 0, deliverables = 0
  return {
    now: () => FIXED_NOW,
    ids: {
      project: () => `new-proj-${++projects}`,
      milestone: () => `new-ms-${++milestones}`,
      deliverable: () => `new-dlv-${++deliverables}`,
    },
  }
}

/** Two milestones deliberately out of sort order, three deliverables. */
function makeSnapshot(): ProjectSnapshot {
  return {
    project: {
      id: 'src-proj', account_id: 'acct-9', client_user_id: 'client-9',
      name: 'Source project', description: 'The original',
      status: 'active', budget: 12000,
      start_date: '2026-05-01', target_end_date: '2026-09-01',
      created_at: '2026-05-01T09:00:00Z', updated_at: '2026-06-01T09:00:00Z',
    },
    milestones: [
      {
        id: 'src-ms-b', project_id: 'src-proj', name: 'Build', description: 'Phase two',
        due_date: '2026-08-01', status: 'in_progress', sort_order: 1,
        created_at: '2026-05-01T09:00:00Z', updated_at: '2026-06-01T09:00:00Z',
      },
      {
        id: 'src-ms-a', project_id: 'src-proj', name: 'Discovery', description: null,
        due_date: '2026-06-01', status: 'completed', sort_order: 0,
        created_at: '2026-05-01T09:00:00Z', updated_at: '2026-06-01T09:00:00Z',
      },
    ],
    deliverables: [
      {
        id: 'src-dlv-1', milestone_id: 'src-ms-a', name: 'Audit report', description: null,
        status: 'accepted', estimated_hours: 8,
        created_at: '2026-05-02T09:00:00Z', updated_at: '2026-06-01T09:00:00Z',
      },
      {
        id: 'src-dlv-2', milestone_id: 'src-ms-b', name: 'Terraform baseline', description: 'IaC',
        status: 'in_progress', estimated_hours: 14,
        created_at: '2026-05-03T09:00:00Z', updated_at: '2026-06-01T09:00:00Z',
      },
      {
        id: 'src-dlv-3', milestone_id: 'src-ms-b', name: 'Cutover runbook', description: null,
        status: 'in_review', estimated_hours: null,
        created_at: '2026-05-04T09:00:00Z', updated_at: '2026-06-01T09:00:00Z',
      },
    ],
  }
}

const ALL_OPTIONS: CloneOptions = {
  newName: 'The copy',
  includeMilestones: true,
  includeDeliverables: true,
  resetStatuses: true,
}

describe('cloneProjectSnapshot', () => {
  it('copies project fields onto a fresh unassigned record with a new id, name, and timestamps', () => {
    const source = makeSnapshot()
    const clone = cloneProjectSnapshot(source, { ...ALL_OPTIONS, newName: '  The copy  ' }, makeDeps())

    expect(clone.project).toMatchObject({
      id: 'new-proj-1',
      name: 'The copy', // trimmed
      account_id: 'acct-9',
      client_user_id: null, // the copy starts unassigned
      description: 'The original',
      budget: 12000,
      start_date: '2026-05-01',
      target_end_date: '2026-09-01',
      created_at: FIXED_NOW,
      updated_at: FIXED_NOW,
    })
  })

  it('regenerates every id and re-parents children onto the new ids', () => {
    const source = makeSnapshot()
    const clone = cloneProjectSnapshot(source, ALL_OPTIONS, makeDeps())

    const sourceIds = new Set([
      source.project.id,
      ...source.milestones.map(m => m.id),
      ...source.deliverables.map(d => d.id),
    ])
    const cloneIds = [
      clone.project.id,
      ...clone.milestones.map(m => m.id),
      ...clone.deliverables.map(d => d.id),
    ]
    expect(new Set(cloneIds).size).toBe(cloneIds.length) // all unique
    for (const id of cloneIds) expect(sourceIds.has(id)).toBe(false) // all new

    const cloneMilestoneIds = new Set(clone.milestones.map(m => m.id))
    for (const milestone of clone.milestones) expect(milestone.project_id).toBe(clone.project.id)
    for (const deliverable of clone.deliverables) expect(cloneMilestoneIds.has(deliverable.milestone_id)).toBe(true)

    // Milestones come out ordered by sort_order and keep their grouping:
    // Discovery (sort 0) has one deliverable, Build (sort 1) has two.
    expect(clone.milestones.map(m => m.name)).toEqual(['Discovery', 'Build'])
    expect(clone.milestones.map(m => m.sort_order)).toEqual([0, 1])
    const byMilestone = (id: string) => clone.deliverables.filter(d => d.milestone_id === id).map(d => d.name)
    expect(byMilestone(clone.milestones[0].id)).toEqual(['Audit report'])
    expect(byMilestone(clone.milestones[1].id)).toEqual(['Terraform baseline', 'Cutover runbook'])
  })

  it('resets each record to its spec vocabulary initial state when resetStatuses is true', () => {
    const clone = cloneProjectSnapshot(makeSnapshot(), ALL_OPTIONS, makeDeps())
    expect(clone.project.status).toBe('planning')
    expect(clone.milestones.every(m => m.status === 'pending')).toBe(true)
    // Deliverables have their own vocabulary: they reset to not_started.
    expect(clone.deliverables.every(d => d.status === 'not_started')).toBe(true)
  })

  it('preserves statuses when resetStatuses is false', () => {
    const clone = cloneProjectSnapshot(makeSnapshot(), { ...ALL_OPTIONS, resetStatuses: false }, makeDeps())
    expect(clone.project.status).toBe('active')
    expect(clone.milestones.map(m => m.status)).toEqual(['completed', 'in_progress'])
    expect(clone.deliverables.map(d => d.status)).toEqual(['accepted', 'in_progress', 'in_review'])
  })

  it('shares no object references with the source in either direction', () => {
    const source = makeSnapshot()
    const clone = cloneProjectSnapshot(source, { ...ALL_OPTIONS, resetStatuses: false }, makeDeps())

    expect(Object.is(clone.project, source.project)).toBe(false)
    for (const milestone of clone.milestones) {
      for (const original of source.milestones) expect(Object.is(milestone, original)).toBe(false)
    }
    for (const deliverable of clone.deliverables) {
      for (const original of source.deliverables) expect(Object.is(deliverable, original)).toBe(false)
    }

    // Mutating the source afterwards must not leak into the clone...
    source.project.name = 'Renamed source'
    source.milestones[1].name = 'Renamed milestone'
    source.deliverables[0].status = 'not_started'
    source.milestones.push({ ...source.milestones[0], id: 'src-ms-extra' })
    expect(clone.project.name).toBe('The copy')
    expect(clone.milestones.map(m => m.name)).toEqual(['Discovery', 'Build'])
    expect(clone.deliverables[0].status).toBe('accepted')
    expect(clone.milestones).toHaveLength(2)

    // ...and mutating the clone must not leak back into the source.
    clone.deliverables[1].name = 'Edited in the clone'
    expect(source.deliverables.map(d => d.name)).toContain('Terraform baseline')
    expect(source.deliverables.map(d => d.name)).not.toContain('Edited in the clone')
  })

  it('honors the include options', () => {
    const withoutMilestones = cloneProjectSnapshot(makeSnapshot(), { ...ALL_OPTIONS, includeMilestones: false }, makeDeps())
    expect(withoutMilestones.milestones).toHaveLength(0)
    expect(withoutMilestones.deliverables).toHaveLength(0)

    const withoutDeliverables = cloneProjectSnapshot(makeSnapshot(), { ...ALL_OPTIONS, includeDeliverables: false }, makeDeps())
    expect(withoutDeliverables.milestones).toHaveLength(2)
    expect(withoutDeliverables.deliverables).toHaveLength(0)
  })
})

describe('templates', () => {
  const templateDeps = { id: () => 'tpl-test', now: () => FIXED_NOW }

  it('buildTemplate captures structure only, ordered and renumbered', () => {
    const template = buildTemplate(makeSnapshot(), '  Migration playbook  ', templateDeps)

    expect(template).toMatchObject({
      id: 'tpl-test',
      name: 'Migration playbook', // trimmed
      source_project_name: 'Source project',
      created_at: FIXED_NOW,
    })
    expect(template.milestones).toEqual([
      { name: 'Discovery', sort_order: 0, deliverables: [{ name: 'Audit report' }] },
      { name: 'Build', sort_order: 1, deliverables: [{ name: 'Terraform baseline' }, { name: 'Cutover runbook' }] },
    ])
    expect(templateDeliverableCount(template)).toBe(3)
    // Structure only: no statuses, dates, hours, or ids survive.
    for (const milestone of template.milestones) {
      expect(Object.keys(milestone).sort()).toEqual(['deliverables', 'name', 'sort_order'])
      for (const deliverable of milestone.deliverables) {
        expect(Object.keys(deliverable)).toEqual(['name'])
      }
    }
  })

  it('instantiateTemplate creates a fresh planning project with reset work items', () => {
    const template = buildTemplate(makeSnapshot(), 'Migration playbook', templateDeps)
    const created = instantiateTemplate(template, 'New client migration', makeDeps())

    expect(created.project).toMatchObject({
      id: 'new-proj-1',
      name: 'New client migration',
      account_id: TEMPLATE_PROJECT_ACCOUNT_ID,
      client_user_id: null,
      status: 'planning',
      budget: null,
      start_date: null,
      target_end_date: null,
      created_at: FIXED_NOW,
    })
    expect(created.milestones.map(m => m.name)).toEqual(['Discovery', 'Build'])
    expect(created.milestones.map(m => m.sort_order)).toEqual([0, 1])
    expect(created.milestones.every(m => m.status === 'pending')).toBe(true)
    expect(created.deliverables.every(d => d.status === 'not_started')).toBe(true)
    for (const milestone of created.milestones) expect(milestone.project_id).toBe(created.project.id)
    const milestoneIds = new Set(created.milestones.map(m => m.id))
    for (const deliverable of created.deliverables) expect(milestoneIds.has(deliverable.milestone_id)).toBe(true)
  })

  it('round-trips: save, apply, then save again yields the same structure', () => {
    const original = buildTemplate(makeSnapshot(), 'Migration playbook', templateDeps)
    const applied = instantiateTemplate(original, 'Round-trip project', makeDeps())
    const rebuilt = buildTemplate(applied, 'Migration playbook', templateDeps)

    expect(rebuilt.milestones).toEqual(original.milestones)
    expect(rebuilt.source_project_name).toBe('Round-trip project')
  })
})

describe('normalizeTemplateStructure', () => {
  it('trims titles, drops empty rows, and renumbers survivors in order', () => {
    const normalized = normalizeTemplateStructure([
      { name: '  Discovery  ', deliverables: ['  Kickoff notes ', '', '   '] },
      { name: '   ', deliverables: ['Orphaned deliverable'] }, // dropped with its children
      { name: 'Build', deliverables: [] },
    ])

    expect(normalized).toEqual([
      { name: 'Discovery', sort_order: 0, deliverables: [{ name: 'Kickoff notes' }] },
      { name: 'Build', sort_order: 1, deliverables: [] },
    ])
  })

  it('returns an empty array when nothing survives', () => {
    expect(normalizeTemplateStructure([])).toEqual([])
    expect(normalizeTemplateStructure([{ name: ' ', deliverables: ['kept nowhere'] }])).toEqual([])
  })
})

describe('buildTemplateFromStructure', () => {
  const deps = { id: () => 'tpl-scratch', now: () => FIXED_NOW }

  it('builds a scratch-sourced template from normalized editor rows', () => {
    const template = buildTemplateFromStructure('  Onboarding track ', [
      { name: 'Setup', deliverables: [' Access checklist ', ''] },
      { name: ' ', deliverables: [] },
      { name: 'Launch', deliverables: ['Go-live review'] },
    ], deps)

    expect(template).toEqual({
      id: 'tpl-scratch',
      name: 'Onboarding track',
      source_project_name: TEMPLATE_SCRATCH_SOURCE,
      created_at: FIXED_NOW,
      milestones: [
        { name: 'Setup', sort_order: 0, deliverables: [{ name: 'Access checklist' }] },
        { name: 'Launch', sort_order: 1, deliverables: [{ name: 'Go-live review' }] },
      ],
    })
  })

  it('returns null for a blank name or a structure with no surviving milestone', () => {
    expect(buildTemplateFromStructure('   ', [{ name: 'Setup', deliverables: [] }], deps)).toBeNull()
    expect(buildTemplateFromStructure('Named', [], deps)).toBeNull()
    expect(buildTemplateFromStructure('Named', [{ name: '  ', deliverables: ['x'] }], deps)).toBeNull()
  })
})

describe('reviseTemplate', () => {
  function makeTemplate(): ProjectTemplate {
    return {
      id: 'tpl-1',
      name: 'Original',
      source_project_name: 'Source project',
      created_at: FIXED_NOW,
      milestones: [
        { name: 'Discovery', sort_order: 0, deliverables: [{ name: 'Audit report' }] },
        { name: 'Build', sort_order: 1, deliverables: [] },
      ],
    }
  }

  it('renames without touching structure, preserving id, provenance, and created_at', () => {
    const original = makeTemplate()
    const revised = reviseTemplate(original, { name: '  Renamed  ' })

    expect(revised).toMatchObject({
      id: 'tpl-1',
      name: 'Renamed',
      source_project_name: 'Source project',
      created_at: FIXED_NOW,
    })
    expect(revised!.milestones).toEqual(original.milestones)
    // The structure is copied, not aliased: mutating the revision leaves the
    // original alone.
    revised!.milestones[0].deliverables.push({ name: 'Injected' })
    expect(original.milestones[0].deliverables).toEqual([{ name: 'Audit report' }])
  })

  it('replaces structure through the same normalization as creation', () => {
    const revised = reviseTemplate(makeTemplate(), {
      milestones: [
        { name: ' Handover ', deliverables: [' Docs pack ', ' '] },
        { name: '', deliverables: ['dropped'] },
      ],
    })

    expect(revised!.name).toBe('Original')
    expect(revised!.milestones).toEqual([
      { name: 'Handover', sort_order: 0, deliverables: [{ name: 'Docs pack' }] },
    ])
  })

  it('returns null when the edit would leave the template unusable', () => {
    expect(reviseTemplate(makeTemplate(), { name: '   ' })).toBeNull()
    expect(reviseTemplate(makeTemplate(), { milestones: [] })).toBeNull()
    expect(reviseTemplate(makeTemplate(), { milestones: [{ name: ' ', deliverables: [] }] })).toBeNull()
  })
})
