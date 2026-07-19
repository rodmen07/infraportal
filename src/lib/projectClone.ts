// ---------------------------------------------------------------------------
// Pure project clone + template engine (v1.16.5).
//
// No I/O and no store access: everything operates on plain snapshots and is
// deterministic given the injected id factory and clock, so Vitest can cover
// deep-copy correctness, id regeneration, and status resets in node.
//
// Record shapes mirror the projects-service DTOs (microservices repo,
// projects-service/openapi.yaml) as rendered by the admin Projects tab.
// Milestone statuses follow the admin UI vocabulary (pending / in_progress /
// completed / blocked). Deliverables may additionally carry the
// projects-service API enum (not_started / in_review / accepted) since the
// v1.17.2 API playground writes spec-vocabulary records into the same demo
// dataset; the seed data keeps the admin vocabulary.
//
// Consumed by the marked mock boundary in `src/lib/projectsStore.mock.ts`;
// nothing here talks to a backend.
// ---------------------------------------------------------------------------

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

/**
 * Deliverable status: the admin demo vocabulary (TaskStatus) plus the
 * projects-service OpenAPI enum values it does not share. Seed data uses the
 * admin vocabulary; records written through the API playground's demo adapter
 * use the spec enum verbatim.
 */
export type DeliverableStatus = TaskStatus | 'not_started' | 'in_review' | 'accepted'

/** Status a cloned or templated project starts in when statuses are reset. */
export const RESET_PROJECT_STATUS: ProjectStatus = 'planning'
/** Status cloned or templated milestones and deliverables reset to. */
export const RESET_TASK_STATUS: TaskStatus = 'pending'

/** Demo account a template-created project is filed under (no live CRM). */
export const TEMPLATE_PROJECT_ACCOUNT_ID = 'acct-demo'

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
  status: TaskStatus
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
  /** Reset the project to planning and every milestone/deliverable to pending. */
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
        status: options.resetStatuses ? RESET_TASK_STATUS : milestone.status,
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
          status: options.resetStatuses ? RESET_TASK_STATUS : deliverable.status,
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
 * project in planning, and every milestone/deliverable pending.
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
      status: RESET_TASK_STATUS,
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
        status: RESET_TASK_STATUS,
        estimated_hours: null,
        created_at: timestamp,
        updated_at: timestamp,
      })
    }
  })

  return { project, milestones, deliverables }
}
