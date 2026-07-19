// ---------------------------------------------------------------------------
// Project status vocabulary: the single source of truth for every status
// value the projects UI (admin Projects tab, template library, clone flow,
// API playground adapter) may present or write.
//
// The values mirror the enums in the committed projects-service OpenAPI
// snapshot (src/api-specs/projects-service.json, synced from the
// microservices repo by `npm run sync-specs`). They are written out as
// literal tuples rather than derived from the JSON at runtime so TypeScript
// gets literal union types and the admin bundle does not have to ship the
// full spec snapshot; the guard test in `projectStatusVocabulary.test.ts`
// fails the suite if these tuples ever drift from the committed spec file.
//
// Do not add values here that the spec does not allow: the point of this
// module (v1.16.5 PR2) is that the UI can never present a status the
// service would reject. Before v1.16.5 PR2 the admin tab carried a
// "blocked" milestone/deliverable status and used pending/completed for
// deliverables; none of those exist in the service contract.
// ---------------------------------------------------------------------------

/** Project.status enum, exactly as the projects-service spec declares it. */
export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const

/** Milestone.status enum. Note: the service has no "blocked" milestone state. */
export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed'] as const

/**
 * Deliverable.status enum. Deliverables do not share the milestone
 * vocabulary: work starts "not_started" (not "pending") and finishes
 * "accepted" (not "completed").
 */
export const DELIVERABLE_STATUSES = ['not_started', 'in_progress', 'in_review', 'accepted'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number]

/** Status a cloned or templated project starts in when statuses are reset. */
export const RESET_PROJECT_STATUS: ProjectStatus = 'planning'
/** Status cloned or templated milestones reset to. */
export const RESET_MILESTONE_STATUS: MilestoneStatus = 'pending'
/** Status cloned or templated deliverables reset to (the spec's initial state). */
export const RESET_DELIVERABLE_STATUS: DeliverableStatus = 'not_started'

/**
 * Human copy for what a status reset does, shared by the clone modal and the
 * template library so the two surfaces cannot describe the reset differently.
 */
export const STATUS_RESET_DESCRIPTION =
  'project to planning, milestones to pending, deliverables to not started'

/** "in_progress" -> "in progress" for pills and option labels. */
export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}
