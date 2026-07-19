// ---------------------------------------------------------------------------
// Pure project clone + template engine (v1.16.5).
//
// No I/O and no store access: everything operates on plain snapshots and is
// deterministic given the injected id factory and clock, so Vitest can cover
// deep-copy correctness, id regeneration, and status resets in node.
//
// Record shapes mirror the projects-service DTOs (microservices repo,
// projects-service/openapi.yaml) as rendered by the admin Projects tab.
// Since v1.16.5 PR2 every status field uses the spec vocabulary from
// `projectStatusVocabulary.ts` (guard-tested against the committed spec
// snapshot), so nothing built on this engine can present a status the
// service would reject.
//
// Consumed by the marked mock boundary in `src/lib/projectsStore.mock.ts`;
// nothing here talks to a backend.
// ---------------------------------------------------------------------------

import {
  RESET_DELIVERABLE_STATUS,
  RESET_MILESTONE_STATUS,
  RESET_PROJECT_STATUS,
  type DeliverableStatus,
  type MilestoneStatus,
  type ProjectStatus,
} from './projectStatusVocabulary'

// Re-exported so existing importers keep a single import site for the
// engine's record shapes plus their status unions.
export {
  RESET_DELIVERABLE_STATUS,
  RESET_MILESTONE_STATUS,
  RESET_PROJECT_STATUS,
  type DeliverableStatus,
  type MilestoneStatus,
  type ProjectStatus,
}

/** Demo account a template-created project is filed under (no live CRM). */
export const TEMPLATE_PROJECT_ACCOUNT_ID = 'acct-demo'

/** source_project_name for templates authored from scratch in the editor. */
export const TEMPLATE_SCRATCH_SOURCE = 'scratch'

export interface DemoProject {
  id: string
  account_id: string
  client_user_id: string | null
  name: string
  description: string | null
  status: ProjectStatus
  budget: number | null
  start_date: string | null
  target_end_date: string | null
  created_at: string
  updated_at: string
}

export interface DemoMilestone {
  id: string
  project_id: string
  name: string
  description: string | null
  due_date: string | null
  status: MilestoneStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DemoDeliverable {
  id: string
  milestone_id: string
  name: string
  description: string | null
  status: DeliverableStatus
  estimated_hours: number | null
  created_at: string
  updated_at: string
}

/** One project plus everything under it, as flat arrays. */
export interface ProjectSnapshot {
  project: DemoProject
  milestones: DemoMilestone[]
  deliverables: DemoDeliverable[]
}

export interface CloneOptions {
  /** Name of the copy. Trimmed before use. */
  newName: string
  includeMilestones: boolean
  /** Only honored when milestones are included (deliverables need parents). */
  includeDeliverables: boolean
  /**
   * Reset every status to its vocabulary's initial state: project to
   * planning, milestones to pending, deliverables to not_started.
   */
  resetStatuses: boolean
}

export interface CloneIdFactory {
  project(): string
  milestone(): string
  deliverable(): string
}

export interface CloneDeps {
  ids: CloneIdFactory
  now: () => string
}

/**
 * Deep-copies a project snapshot into a brand-new one: every record gets a
 * freshly generated id, children are re-parented onto the new ids, and no
 * object reference is shared with the source. The copy starts unassigned
 * (client_user_id is cleared) so two projects never silently point at the
 * same portal client.
 */
export function cloneProjectSnapshot(
  source: ProjectSnapshot,
  options: CloneOptions,
  deps: CloneDeps,
): ProjectSnapshot {
  const timestamp = deps.now()
  const project: DemoProject = {
    ...source.project,
    id: deps.ids.project(),
    name: options.newName.trim(),
    client_user_id: null,
    status: options.resetStatuses ? RESET_PROJECT_STATUS : source.project.status,
    created_at: timestamp,
    updated_at: timestamp,
  }

  const milestones: DemoMilestone[] = []
  const deliverables: DemoDeliverable[] = []
  if (options.includeMilestones) {
    const ordered = [...source.milestones].sort((a, b) => a.sort_order - b.sort_order)
    for (const milestone of ordered) {
      const milestoneId = deps.ids.milestone()
      milestones.push({
        ...milestone,
        id: milestoneId,
        project_id: project.id,
        status: options.resetStatuses ? RESET_MILESTONE_STATUS : milestone.status,
        created_at: timestamp,
        updated_at: timestamp,
      })
      if (!options.includeDeliverables) continue
      for (const deliverable of source.deliverables) {
        if (deliverable.milestone_id !== milestone.id) continue
        deliverables.push({
          ...deliverable,
          id: deps.ids.deliverable(),
          milestone_id: milestoneId,
          status: options.resetStatuses ? RESET_DELIVERABLE_STATUS : deliverable.status,
          created_at: timestamp,
          updated_at: timestamp,
        })
      }
    }
  }

  return { project, milestones, deliverables }
}

// ---------------------------------------------------------------------------
// Templates: structure only. A template stores milestone/deliverable titles
// and their ordering; statuses, dates, hours, and assignments are never kept,
// so every project created from a template starts from a clean slate.
// ---------------------------------------------------------------------------

export interface TemplateDeliverable {
  name: string
}

export interface TemplateMilestone {
  name: string
  sort_order: number
  deliverables: TemplateDeliverable[]
}

export interface ProjectTemplate {
  id: string
  name: string
  /** Name of the project the structure was captured from. */
  source_project_name: string
  created_at: string
  milestones: TemplateMilestone[]
}

export interface TemplateDeps {
  id: () => string
  now: () => string
}

/** Total deliverable titles across all of a template's milestones. */
export function templateDeliverableCount(template: ProjectTemplate): number {
  return template.milestones.reduce((count, milestone) => count + milestone.deliverables.length, 0)
}

/**
 * Captures a snapshot's structure as a named template. Milestones are
 * ordered by sort_order and renumbered 0..n-1; only titles survive.
 */
export function buildTemplate(
  source: ProjectSnapshot,
  templateName: string,
  deps: TemplateDeps,
): ProjectTemplate {
  const ordered = [...source.milestones].sort((a, b) => a.sort_order - b.sort_order)
  return {
    id: deps.id(),
    name: templateName.trim(),
    source_project_name: source.project.name,
    created_at: deps.now(),
    milestones: ordered.map((milestone, index) => ({
      name: milestone.name,
      sort_order: index,
      deliverables: source.deliverables
        .filter(deliverable => deliverable.milestone_id === milestone.id)
        .map(deliverable => ({ name: deliverable.name })),
    })),
  }
}

/**
 * Creates a fresh project snapshot from a template: new ids throughout, the
 * project in planning, milestones pending, deliverables not started.
 */
export function instantiateTemplate(
  template: ProjectTemplate,
  projectName: string,
  deps: CloneDeps,
): ProjectSnapshot {
  const timestamp = deps.now()
  const project: DemoProject = {
    id: deps.ids.project(),
    account_id: TEMPLATE_PROJECT_ACCOUNT_ID,
    client_user_id: null,
    name: projectName.trim(),
    description: `Created from template "${template.name}"`,
    status: RESET_PROJECT_STATUS,
    budget: null,
    start_date: null,
    target_end_date: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  const milestones: DemoMilestone[] = []
  const deliverables: DemoDeliverable[] = []
  const ordered = [...template.milestones].sort((a, b) => a.sort_order - b.sort_order)
  ordered.forEach((templateMilestone, index) => {
    const milestoneId = deps.ids.milestone()
    milestones.push({
      id: milestoneId,
      project_id: project.id,
      name: templateMilestone.name,
      description: null,
      due_date: null,
      status: RESET_MILESTONE_STATUS,
      sort_order: index,
      created_at: timestamp,
      updated_at: timestamp,
    })
    for (const templateDeliverable of templateMilestone.deliverables) {
      deliverables.push({
        id: deps.ids.deliverable(),
        milestone_id: milestoneId,
        name: templateDeliverable.name,
        description: null,
        status: RESET_DELIVERABLE_STATUS,
        estimated_hours: null,
        created_at: timestamp,
        updated_at: timestamp,
      })
    }
  })

  return { project, milestones, deliverables }
}

// ---------------------------------------------------------------------------
// Template drafts: what the editor produces when a template is written or
// edited by hand instead of captured from a project. Normalization is pure so
// the store and the editor agree on exactly what survives a save.
// ---------------------------------------------------------------------------

/** One editor row: a milestone title plus its deliverable titles, in order. */
export interface TemplateDraftMilestone {
  name: string
  deliverables: string[]
}

/**
 * Turns editor rows into template structure: titles are trimmed, deliverables
 * with empty titles are dropped, milestones with empty titles are dropped
 * (together with their deliverables), and the survivors are renumbered
 * 0..n-1 in the order given.
 */
export function normalizeTemplateStructure(rows: TemplateDraftMilestone[]): TemplateMilestone[] {
  return rows
    .map(row => ({
      name: row.name.trim(),
      deliverables: row.deliverables
        .map(title => title.trim())
        .filter(title => title !== '')
        .map(title => ({ name: title })),
    }))
    .filter(row => row.name !== '')
    .map((row, index) => ({ name: row.name, sort_order: index, deliverables: row.deliverables }))
}

/**
 * Builds a from-scratch template out of editor rows. Returns null when the
 * draft is not a usable template: blank name, or no milestone survives
 * normalization (a template's whole value is its structure).
 */
export function buildTemplateFromStructure(
  templateName: string,
  rows: TemplateDraftMilestone[],
  deps: TemplateDeps,
): ProjectTemplate | null {
  const name = templateName.trim()
  const milestones = normalizeTemplateStructure(rows)
  if (name === '' || milestones.length === 0) return null
  return {
    id: deps.id(),
    name,
    source_project_name: TEMPLATE_SCRATCH_SOURCE,
    created_at: deps.now(),
    milestones,
  }
}

/** Editable template fields; undefined fields keep their stored values. */
export interface TemplateChanges {
  name?: string
  milestones?: TemplateDraftMilestone[]
}

/**
 * Applies an edit to a template, returning a new record (id, provenance, and
 * created_at are preserved). Returns null when the edit would leave the
 * template unusable: a provided name that trims to empty, or a provided
 * structure with no surviving milestone.
 */
export function reviseTemplate(
  template: ProjectTemplate,
  changes: TemplateChanges,
): ProjectTemplate | null {
  const name = changes.name === undefined ? template.name : changes.name.trim()
  const milestones =
    changes.milestones === undefined
      ? template.milestones.map(milestone => ({
          ...milestone,
          deliverables: milestone.deliverables.map(deliverable => ({ ...deliverable })),
        }))
      : normalizeTemplateStructure(changes.milestones)
  if (name === '' || milestones.length === 0) return null
  return { ...template, name, milestones }
}
