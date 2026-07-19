// ===========================================================================
// MOCK DATA BOUNDARY - NOT A LIVE BACKEND
//
// This module is the single in-memory dataset behind the admin Projects tab
// demo (v1.16.5). The platform backend (Cloud SQL + Cloud Run + Fly) was
// decommissioned to zero on 2026-06-04, so there is nothing to call: the
// projects, milestones, deliverables, and templates here live only in the
// browser tab and are never persisted or sent over the network.
//
// Who talks to it:
//   - The admin Projects tab (`CrmAdminPage.tsx`) reads projects, milestones,
//     and deliverables from it when VITE_PROJECTS_API_BASE_URL is unset.
//   - `ProjectCloneModal.tsx` clones projects through `cloneProject`.
//   - `TemplateLibrary.tsx` saves and applies structure templates through
//     `saveTemplate` / `createFromTemplate`.
//
// The clone and template logic itself is pure and lives in
// `src/lib/projectClone.ts`; this module only owns the data and wiring.
//
// To go live later: the store is only reached through the demo-mode branches
// in `CrmAdminPage.tsx` and the two components above. Reimplement those over
// fetch against projects-service (see openapi.yaml in the microservices repo)
// and delete this module; nothing else depends on it.
// ===========================================================================

import {
  buildTemplate,
  cloneProjectSnapshot,
  instantiateTemplate,
  type CloneOptions,
  type DemoDeliverable,
  type DemoMilestone,
  type DemoProject,
  type ProjectSnapshot,
  type ProjectTemplate,
} from './projectClone'

/**
 * Marker note re-exported so call sites can surface (in code review or UI)
 * that they render the in-memory demo dataset, not a live backend.
 */
export const PROJECTS_STORE_BOUNDARY =
  'projectsStore.mock: projects, milestones, deliverables, and templates shown here live in an in-memory demo dataset in the browser. The platform backend was decommissioned on 2026-06-04; nothing is persisted or sent over the network.' as const

export interface ProjectsStore {
  /** Snapshot of the current projects (insertion order). */
  listProjects(): DemoProject[]
  /** Milestones for a project, ordered by sort_order ascending. */
  listMilestones(projectId: string): DemoMilestone[]
  /** Deliverables for a milestone (insertion order). */
  listDeliverables(milestoneId: string): DemoDeliverable[]
  /**
   * Copy of one project plus everything under it, or null when the id is
   * unknown. Records are shallow-copied so callers cannot mutate the store.
   */
  snapshot(projectId: string): ProjectSnapshot | null
  /**
   * Deep-copies a project (new ids everywhere, children re-parented) and
   * inserts the copy. Returns the new project, or null for an unknown source.
   */
  cloneProject(sourceProjectId: string, options: CloneOptions): DemoProject | null
  /** Snapshot of the saved templates (insertion order). */
  listTemplates(): ProjectTemplate[]
  /**
   * Captures a project's structure (milestone/deliverable titles + ordering,
   * statuses never stored) as a named template. Null for an unknown project.
   */
  saveTemplate(projectId: string, templateName: string): ProjectTemplate | null
  /** Removes a template. Returns false when the id is unknown. */
  removeTemplate(templateId: string): boolean
  /**
   * Creates a fresh project from a template: planning status, pending
   * milestones and deliverables. Null for an unknown template.
   */
  createFromTemplate(templateId: string, projectName: string): DemoProject | null
  /** Notifies after every mutation (clone, template save/apply/remove, reset). */
  subscribe(listener: () => void): () => void
  /** Restores the seed dataset. */
  reset(): void
}

export interface ProjectsStoreOptions {
  /** Timestamp source for created_at / updated_at. Inject in tests. */
  now?: () => string
}

// ---------------------------------------------------------------------------
// Seed data: three realistic consulting engagements in different phases, so
// the demo shows completed, in-flight, blocked, and pending work at once.
// ---------------------------------------------------------------------------

const stamp = (date: string) => `${date}T09:00:00Z`

function seedProjects(): DemoProject[] {
  return [
    {
      id: 'proj-001', account_id: 'acct-101', client_user_id: 'client-acme-01',
      name: 'Cloud Migration - Acme Corp',
      description: 'Lift-and-shift of the legacy VM fleet to Cloud Run with IaC and observability.',
      status: 'active', budget: 24000,
      start_date: '2026-05-04', target_end_date: '2026-08-28',
      created_at: stamp('2026-05-04'), updated_at: stamp('2026-07-10'),
    },
    {
      id: 'proj-002', account_id: 'acct-102', client_user_id: 'client-globex-01',
      name: 'SOC 2 Readiness - Globex',
      description: 'Type I readiness: control mapping, policy drafting, and evidence automation.',
      status: 'active', budget: 18000,
      start_date: '2026-06-01', target_end_date: '2026-09-30',
      created_at: stamp('2026-06-01'), updated_at: stamp('2026-07-14'),
    },
    {
      id: 'proj-003', account_id: 'acct-103', client_user_id: null,
      name: 'Support Portal Revamp - Initech',
      description: 'Client portal refresh with SSO and a self-service knowledge base.',
      status: 'planning', budget: 9500,
      start_date: null, target_end_date: '2026-10-30',
      created_at: stamp('2026-07-06'), updated_at: stamp('2026-07-06'),
    },
  ]
}

type TaskRow = DemoMilestone['status']

function seedMilestones(): DemoMilestone[] {
  const rows: [string, string, string, string | null, TaskRow, number, string][] = [
    ['ms-001', 'proj-001', 'Discovery and audit', '2026-05-15', 'completed', 0, '2026-05-04'],
    ['ms-002', 'proj-001', 'Migration build-out', '2026-07-31', 'in_progress', 1, '2026-05-04'],
    ['ms-003', 'proj-001', 'Cutover and hardening', '2026-08-21', 'pending', 2, '2026-05-04'],
    ['ms-004', 'proj-002', 'Gap assessment', '2026-06-19', 'completed', 0, '2026-06-01'],
    ['ms-005', 'proj-002', 'Policy and evidence rollout', '2026-08-14', 'in_progress', 1, '2026-06-01'],
    ['ms-006', 'proj-002', 'Audit dry run', '2026-09-18', 'pending', 2, '2026-06-01'],
    ['ms-007', 'proj-003', 'Discovery workshop', '2026-08-07', 'pending', 0, '2026-07-06'],
    ['ms-008', 'proj-003', 'Design and prototype', '2026-09-11', 'pending', 1, '2026-07-06'],
  ]
  return rows.map(([id, project_id, name, due_date, status, sort_order, created]) => ({
    id, project_id, name, description: null, due_date, status, sort_order,
    created_at: stamp(created), updated_at: stamp(created),
  }))
}

function seedDeliverables(): DemoDeliverable[] {
  const rows: [string, string, string, TaskRow, number][] = [
    ['dlv-001', 'ms-001', 'Current-state architecture review', 'completed', 10],
    ['dlv-002', 'ms-001', 'Migration readiness report', 'completed', 6],
    ['dlv-003', 'ms-002', 'Terraform baseline for all environments', 'completed', 14],
    ['dlv-004', 'ms-002', 'Cloud Run service cutover', 'in_progress', 20],
    ['dlv-005', 'ms-002', 'Data migration dry run', 'pending', 12],
    ['dlv-006', 'ms-003', 'Production cutover runbook', 'pending', 8],
    ['dlv-007', 'ms-003', 'Post-migration observability dashboard', 'pending', 10],
    ['dlv-008', 'ms-004', 'Control gap matrix', 'completed', 12],
    ['dlv-009', 'ms-004', 'Remediation roadmap', 'completed', 6],
    ['dlv-010', 'ms-005', 'Security policy pack', 'in_progress', 16],
    ['dlv-011', 'ms-005', 'Evidence collection automation', 'blocked', 18],
    ['dlv-012', 'ms-006', 'Mock audit walkthrough', 'pending', 8],
    ['dlv-013', 'ms-007', 'Stakeholder interview notes', 'pending', 5],
    ['dlv-014', 'ms-007', 'UX audit of the current portal', 'pending', 8],
    ['dlv-015', 'ms-008', 'Clickable prototype', 'pending', 15],
  ]
  return rows.map(([id, milestone_id, name, status, estimated_hours]) => ({
    id, milestone_id, name, description: null, status, estimated_hours,
    created_at: stamp('2026-07-01'), updated_at: stamp('2026-07-01'),
  }))
}

function seedTemplates(): ProjectTemplate[] {
  return [
    {
      id: 'tpl-001',
      name: 'Standard consulting engagement',
      source_project_name: 'Starter',
      created_at: stamp('2026-07-01'),
      milestones: [
        { name: 'Discovery', sort_order: 0, deliverables: [{ name: 'Kickoff notes' }, { name: 'Current-state assessment' }] },
        { name: 'Build', sort_order: 1, deliverables: [{ name: 'Implementation plan' }, { name: 'Working increment' }] },
        { name: 'Handover', sort_order: 2, deliverables: [{ name: 'Documentation pack' }, { name: 'Handover session' }] },
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function createProjectsStore(options: ProjectsStoreOptions = {}): ProjectsStore {
  const now = options.now ?? (() => new Date().toISOString())
  const data = {
    projects: seedProjects(),
    milestones: seedMilestones(),
    deliverables: seedDeliverables(),
    templates: seedTemplates(),
  }
  const listeners = new Set<() => void>()
  // Starts above the seed range so ids stay unique across resets.
  let idCounter = 1000

  const notify = () => { listeners.forEach(listener => listener()) }
  const cloneDeps = {
    now,
    ids: {
      project: () => `proj-${idCounter++}`,
      milestone: () => `ms-${idCounter++}`,
      deliverable: () => `dlv-${idCounter++}`,
    },
  }

  function snapshot(projectId: string): ProjectSnapshot | null {
    const project = data.projects.find(p => p.id === projectId)
    if (!project) return null
    const milestones = data.milestones
      .filter(m => m.project_id === projectId)
      .sort((a, b) => a.sort_order - b.sort_order)
    const milestoneIds = new Set(milestones.map(m => m.id))
    const deliverables = data.deliverables.filter(d => milestoneIds.has(d.milestone_id))
    return {
      project: { ...project },
      milestones: milestones.map(m => ({ ...m })),
      deliverables: deliverables.map(d => ({ ...d })),
    }
  }

  function insertSnapshot(created: ProjectSnapshot): DemoProject {
    data.projects.push(created.project)
    data.milestones.push(...created.milestones)
    data.deliverables.push(...created.deliverables)
    notify()
    return created.project
  }

  return {
    listProjects() {
      return [...data.projects]
    },

    listMilestones(projectId) {
      return data.milestones
        .filter(m => m.project_id === projectId)
        .sort((a, b) => a.sort_order - b.sort_order)
    },

    listDeliverables(milestoneId) {
      return data.deliverables.filter(d => d.milestone_id === milestoneId)
    },

    snapshot,

    cloneProject(sourceProjectId, cloneOptions) {
      const source = snapshot(sourceProjectId)
      if (!source) return null
      return insertSnapshot(cloneProjectSnapshot(source, cloneOptions, cloneDeps))
    },

    listTemplates() {
      return [...data.templates]
    },

    saveTemplate(projectId, templateName) {
      const source = snapshot(projectId)
      if (!source) return null
      const template = buildTemplate(source, templateName, { id: () => `tpl-${idCounter++}`, now })
      data.templates.push(template)
      notify()
      return template
    },

    removeTemplate(templateId) {
      const index = data.templates.findIndex(t => t.id === templateId)
      if (index === -1) return false
      data.templates.splice(index, 1)
      notify()
      return true
    },

    createFromTemplate(templateId, projectName) {
      const template = data.templates.find(t => t.id === templateId)
      if (!template) return null
      return insertSnapshot(instantiateTemplate(template, projectName, cloneDeps))
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    reset() {
      data.projects = seedProjects()
      data.milestones = seedMilestones()
      data.deliverables = seedDeliverables()
      data.templates = seedTemplates()
      notify()
    },
  }
}

/** Shared demo dataset used by the admin Projects tab and its modals. */
export const projectsStore: ProjectsStore = createProjectsStore()
