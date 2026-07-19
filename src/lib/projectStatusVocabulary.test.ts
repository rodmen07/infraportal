/**
 * Spec-drift guard for the project status vocabulary (v1.16.5 PR2).
 *
 * The UI's status tuples in `projectStatusVocabulary.ts` are hand-written
 * literals (so TypeScript gets literal unions and the admin bundle does not
 * ship the spec snapshot). This suite is what keeps them honest: it reads the
 * committed projects-service OpenAPI snapshot and fails if the tuples differ
 * from the spec's enums in content OR order, so `npm run sync-specs` pulling
 * a vocabulary change upstream breaks the build here instead of shipping a
 * UI that offers statuses the service would reject.
 */
import { describe, expect, it } from 'vitest'
import projectsServiceSpec from '../api-specs/projects-service.json'
import {
  DELIVERABLE_STATUSES,
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
  RESET_DELIVERABLE_STATUS,
  RESET_MILESTONE_STATUS,
  RESET_PROJECT_STATUS,
  statusLabel,
} from './projectStatusVocabulary'

/**
 * Every spec schema that carries a status enum, grouped by the vocabulary it
 * must match. Read + create + update requests are all listed so a partial
 * upstream change (e.g. only UpdateDeliverableRequest gains a value) still
 * fails the guard.
 */
const SCHEMAS_BY_VOCABULARY = {
  project: ['Project', 'CreateProjectRequest', 'UpdateProjectRequest'],
  milestone: ['Milestone', 'CreateMilestoneRequest', 'UpdateMilestoneRequest'],
  deliverable: ['Deliverable', 'CreateDeliverableRequest', 'UpdateDeliverableRequest'],
} as const

function specStatusEnum(schemaName: string): string[] {
  const spec = projectsServiceSpec as {
    components?: { schemas?: Record<string, { properties?: Record<string, { enum?: unknown }> }> }
  }
  const schema = spec.components?.schemas?.[schemaName]
  expect(schema, `schema ${schemaName} missing from projects-service.json`).toBeDefined()
  const statusEnum = schema?.properties?.status?.enum
  expect(
    Array.isArray(statusEnum),
    `schema ${schemaName} has no status enum in projects-service.json`,
  ).toBe(true)
  return statusEnum as string[]
}

describe('project status vocabulary is locked to the committed spec', () => {
  it.each(SCHEMAS_BY_VOCABULARY.project)('%s status enum matches PROJECT_STATUSES', (schema) => {
    expect(specStatusEnum(schema)).toEqual([...PROJECT_STATUSES])
  })

  it.each(SCHEMAS_BY_VOCABULARY.milestone)(
    '%s status enum matches MILESTONE_STATUSES',
    (schema) => {
      expect(specStatusEnum(schema)).toEqual([...MILESTONE_STATUSES])
    },
  )

  it.each(SCHEMAS_BY_VOCABULARY.deliverable)(
    '%s status enum matches DELIVERABLE_STATUSES',
    (schema) => {
      expect(specStatusEnum(schema)).toEqual([...DELIVERABLE_STATUSES])
    },
  )

  it('documents the drift the vocabulary exists to prevent', () => {
    // The pre-reconciliation admin vocabulary. If any of these ever appear in
    // the spec enums the assertions above will pick up the new values; this
    // test pins the current reality so the mapping choices in the demo seed
    // (blocked -> in_review, completed -> accepted, pending -> not_started)
    // stay explainable.
    expect([...MILESTONE_STATUSES]).not.toContain('blocked')
    expect([...DELIVERABLE_STATUSES]).not.toContain('blocked')
    expect([...DELIVERABLE_STATUSES]).not.toContain('pending')
    expect([...DELIVERABLE_STATUSES]).not.toContain('completed')
  })
})

describe('reset statuses', () => {
  it('are members of their spec vocabularies', () => {
    expect(PROJECT_STATUSES).toContain(RESET_PROJECT_STATUS)
    expect(MILESTONE_STATUSES).toContain(RESET_MILESTONE_STATUS)
    expect(DELIVERABLE_STATUSES).toContain(RESET_DELIVERABLE_STATUS)
  })

  it('reset to the initial state of each vocabulary', () => {
    expect(RESET_PROJECT_STATUS).toBe(PROJECT_STATUSES[0])
    expect(RESET_MILESTONE_STATUS).toBe(MILESTONE_STATUSES[0])
    expect(RESET_DELIVERABLE_STATUS).toBe(DELIVERABLE_STATUSES[0])
  })
})

describe('statusLabel', () => {
  it('replaces every underscore for display', () => {
    expect(statusLabel('not_started')).toBe('not started')
    expect(statusLabel('in_progress')).toBe('in progress')
    expect(statusLabel('active')).toBe('active')
  })
})
