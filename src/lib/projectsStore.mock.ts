// ===========================================================================
// MOCK DATA BOUNDARY - NOT A LIVE BACKEND
//
// This module is the single in-memory dataset behind the admin Projects tab
// demo (v1.16.5). The public site ships as a static bundle with no
// projects-service URL configured, so there is nothing to call: the
// projects, milestones, deliverables, and templates here live only in the
// browser tab and are never persisted or sent over the network.
//
// Who talks to it:
//   - The admin Projects tab (`CrmAdminPage.tsx`) reads projects, milestones,
//     and deliverables from it when VITE_PROJECTS_API_BASE_URL is unset.
//   - `ProjectCloneModal.tsx` clones projects through `cloneProject`.
//   - `TemplateLibrary.tsx` + `TemplateEditorModal.tsx` run the full template
//     CRUD: `saveTemplate` (from a project), `createTemplate` (from scratch),
//     `updateTemplate`, `removeTemplate`, `createFromTemplate`.
//   - The API playground's demo adapter (`tryItAdapter.mock.ts`, v1.17.2)
//     maps projects-service spec operations onto the direct CRUD methods.
//
// Every status field carries the projects-service spec vocabulary from
// `projectStatusVocabulary.ts` (guard-tested against the committed spec
// snapshot), so nothing rendered from this store can show a status the
// service would reject.
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
  buildTemplateFromStructure,
  cloneProjectSnapshot,
  instantiateTemplate,
  reviseTemplate,
  type CloneOptions,
  type DeliverableStatus,
  type DemoDeliverable,
  type DemoMilestone,
  type DemoProject,
  type MilestoneStatus,
  type ProjectSnapshot,
  type ProjectStatus,
  type ProjectTemplate,
  type TemplateChanges,
  type TemplateDraftMilestone,
} from './projectClone'

/**
 * Marker note re-exported so call sites can surface (in code review or UI)
 * that they render the in-memory demo dataset, not a live backend.
 */
export const PROJECTS_STORE_BOUNDARY =
  'projectsStore.mock: projects, milestones, deliverables, and templates shown here live in an in-memory demo dataset in the browser. Nothing is persisted or sent over the network.' as const

/** Fields accepted when creating a project directly (playground adapter). */
export interface NewProjectFields {
  account_id: string
  name: string
  client_user_id?: string | null
  description?: string | null
  status?: ProjectStatus
  start_date?: string | null
  target_end_date?: string | null
}

/** Fields accepted when creating a milestone directly (playground adapter). */
export interface NewMilestoneFields {
  name: string
  description?: string | null
  due_date?: string | null
  status?: MilestoneStatus
  sort_order?: number
}

/** Fields accepted when creating a deliverable directly (playground adapter). */
export interface NewDeliverableFields {
  name: string
  description?: string | null
  status?: DeliverableStatus
  estimated_hours?: number | null
}

/** PATCH-style changes: undefined fields keep their stored values. */
export type ProjectChanges = Partial<Omit<DemoProject, 'id' | 'budget' | 'created_at' | 'updated_at'>>
export type MilestoneChanges = Partial<Omit<DemoMilestone, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
export type DeliverableChanges = Partial<Omit<DemoDeliverable, 'id' | 'milestone_id' | 'created_at' | 'updated_at'>>

export interface ProjectsStore {
  /** Snapshot of the current projects (insertion order). */
  listProjects(): DemoProject[]
  /** Copy of one project, or null when the id is unknown. */
  getProject(projectId: string): DemoProject | null
  /** Copy of one milestone, or null when the id is unknown. */
  getMilestone(milestoneId: string): DemoMilestone | null
  /** Copy of one deliverable, or null when the id is unknown. */
  getDeliverable(deliverableId: string): DemoDeliverable | null
  /** Inserts a project (budget starts null). Returns the new record. */
  createProject(fields: NewProjectFields): DemoProject
  /**
   * Shallow-merges defined fields into a project and bumps updated_at.
   * Returns the updated record, or null when the id is unknown.
   */
  updateProject(projectId: string, changes: ProjectChanges): DemoProject | null
  /**
   * Removes the project row only. Does not cascade and does not check
   * children: the projects-service schema has no ON DELETE CASCADE for
   * milestones, so callers decide how to surface remaining children
   * (the playground adapter simulates the documented 500 DB_ERROR).
   */
  removeProject(projectId: string): boolean
  /** Inserts a milestone. Returns null when the parent project is unknown. */
  createMilestone(projectId: string, fields: NewMilestoneFields): DemoMilestone | null
  /** PATCH-merge on a milestone; null when the id is unknown. */
  updateMilestone(milestoneId: string, changes: MilestoneChanges): DemoMilestone | null
  /** Removes the milestone row only (same no-cascade contract as projects). */
  removeMilestone(milestoneId: string): boolean
  /** Inserts a deliverable. Returns null when the parent milestone is unknown. */
  createDeliverable(milestoneId: string, fields: NewDeliverableFields): DemoDeliverable | null
  /** PATCH-merge on a deliverable; null when the id is unknown. */
  updateDeliverable(deliverableId: string, changes: DeliverableChanges): DemoDeliverable | null
  /** Removes a deliverable. Returns false when the id is unknown. */
  removeDeliverable(deliverableId: string): boolean
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
  /** Copy of one template, or null when the id is unknown. */
  getTemplate(templateId: string): ProjectTemplate | null
  /**
   * Captures a project's structure (milestone/deliverable titles + ordering,
   * statuses never stored) as a named template. Null for an unknown project.
   */
  saveTemplate(projectId: string, templateName: string): ProjectTemplate | null
  /**
   * Creates a template from scratch out of editor rows (trimmed, empty rows
   * dropped, renumbered). Null when the draft is unusable: blank name, or no
   * milestone survives normalization.
   */
  createTemplate(templateName: string, structure: TemplateDraftMilestone[]): ProjectTemplate | null
  /**
   * Edits a template's name and/or structure (undefined fields keep their
   * stored values; provided structure is normalized like createTemplate).
   * Null when the id is unknown or the edit would leave the template
   * unusable; in both null cases the stored template is unchanged.
   */
  updateTemplate(templateId: string, changes: TemplateChanges): ProjectTemplate | null
  /** Removes a template. Returns false when the id is unknown. */
  removeTemplate(templateId: string): boolean
  /**
   * Creates a fresh project from a template: planning status, pending
   * milestones, not-started deliverables. Null for an unknown template.
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

function seedMilestones(): DemoMilestone[] {
  const rows: [string, string, string, string | null, MilestoneStatus, number, string][] = [
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

// Deliverable statuses use the projects-service enum (see
// projectStatusVocabulary.ts): work starts not_started, finishes accepted,
// and the review state stands in for what the admin demo used to call
// "blocked" (the service contract has no blocked state).
function seedDeliverables(): DemoDeliverable[] {
  const rows: [string, string, string, DeliverableStatus, number][] = [
    ['dlv-001', 'ms-001', 'Current-state architecture review', 'accepted', 10],
    ['dlv-002', 'ms-001', 'Migration readiness report', 'accepted', 6],
    ['dlv-003', 'ms-002', 'Terraform baseline for all environments', 'accepted', 14],
    ['dlv-004', 'ms-002', 'Cloud Run service cutover', 'in_progress', 20],
    ['dlv-005', 'ms-002', 'Data migration dry run', 'not_started', 12],
    ['dlv-006', 'ms-003', 'Production cutover runbook', 'not_started', 8],
    ['dlv-007', 'ms-003', 'Post-migration observability dashboard', 'not_started', 10],
    ['dlv-008', 'ms-004', 'Control gap matrix', 'accepted', 12],
    ['dlv-009', 'ms-004', 'Remediation roadmap', 'accepted', 6],
    ['dlv-010', 'ms-005', 'Security policy pack', 'in_progress', 16],
    ['dlv-011', 'ms-005', 'Evidence collection automation', 'in_review', 18],
    ['dlv-012', 'ms-006', 'Mock audit walkthrough', 'not_started', 8],
    ['dlv-013', 'ms-007', 'Stakeholder interview notes', 'not_started', 5],
    ['dlv-014', 'ms-007', 'UX audit of the current portal', 'not_started', 8],
    ['dlv-015', 'ms-008', 'Clickable prototype', 'not_started', 15],
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
  const templateDeps = { id: () => `tpl-${idCounter++}`, now }

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

  /** Deep copy: template rows nest arrays, so shallow copies would alias. */
  function copyTemplate(template: ProjectTemplate): ProjectTemplate {
    return {
      ...template,
      milestones: template.milestones.map(milestone => ({
        ...milestone,
        deliverables: milestone.deliverables.map(deliverable => ({ ...deliverable })),
      })),
    }
  }

  /** PATCH-merge: only defined fields overwrite; updated_at is refreshed. */
  function patchRecord<T extends { updated_at: string }>(
    record: T,
    changes: Partial<Record<keyof T, unknown>>,
  ): T {
    const merged = { ...record }
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) (merged as Record<string, unknown>)[key] = value
    }
    merged.updated_at = now()
    return merged
  }

  return {
    listProjects() {
      return [...data.projects]
    },

    getProject(projectId) {
      const project = data.projects.find(p => p.id === projectId)
      return project ? { ...project } : null
    },

    getMilestone(milestoneId) {
      const milestone = data.milestones.find(m => m.id === milestoneId)
      return milestone ? { ...milestone } : null
    },

    getDeliverable(deliverableId) {
      const deliverable = data.deliverables.find(d => d.id === deliverableId)
      return deliverable ? { ...deliverable } : null
    },

    createProject(fields) {
      const timestamp = now()
      const project: DemoProject = {
        id: cloneDeps.ids.project(),
        account_id: fields.account_id,
        client_user_id: fields.client_user_id ?? null,
        name: fields.name,
        description: fields.description ?? null,
        status: fields.status ?? 'active',
        budget: null,
        start_date: fields.start_date ?? null,
        target_end_date: fields.target_end_date ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      }
      data.projects.push(project)
      notify()
      return { ...project }
    },

    updateProject(projectId, changes) {
      const index = data.projects.findIndex(p => p.id === projectId)
      if (index === -1) return null
      data.projects[index] = patchRecord(data.projects[index], changes)
      notify()
      return { ...data.projects[index] }
    },

    removeProject(projectId) {
      const index = data.projects.findIndex(p => p.id === projectId)
      if (index === -1) return false
      data.projects.splice(index, 1)
      notify()
      return true
    },

    createMilestone(projectId, fields) {
      if (!data.projects.some(p => p.id === projectId)) return null
      const timestamp = now()
      const milestone: DemoMilestone = {
        id: cloneDeps.ids.milestone(),
        project_id: projectId,
        name: fields.name,
        description: fields.description ?? null,
        due_date: fields.due_date ?? null,
        status: fields.status ?? 'pending',
        sort_order: fields.sort_order ?? 0,
        created_at: timestamp,
        updated_at: timestamp,
      }
      data.milestones.push(milestone)
      notify()
      return { ...milestone }
    },

    updateMilestone(milestoneId, changes) {
      const index = data.milestones.findIndex(m => m.id === milestoneId)
      if (index === -1) return null
      data.milestones[index] = patchRecord(data.milestones[index], changes)
      notify()
      return { ...data.milestones[index] }
    },

    removeMilestone(milestoneId) {
      const index = data.milestones.findIndex(m => m.id === milestoneId)
      if (index === -1) return false
      data.milestones.splice(index, 1)
      notify()
      return true
    },

    createDeliverable(milestoneId, fields) {
      if (!data.milestones.some(m => m.id === milestoneId)) return null
      const timestamp = now()
      const deliverable: DemoDeliverable = {
        id: cloneDeps.ids.deliverable(),
        milestone_id: milestoneId,
        name: fields.name,
        description: fields.description ?? null,
        status: fields.status ?? 'not_started',
        estimated_hours: fields.estimated_hours ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      }
      data.deliverables.push(deliverable)
      notify()
      return { ...deliverable }
    },

    updateDeliverable(deliverableId, changes) {
      const index = data.deliverables.findIndex(d => d.id === deliverableId)
      if (index === -1) return null
      data.deliverables[index] = patchRecord(data.deliverables[index], changes)
      notify()
      return { ...data.deliverables[index] }
    },

    removeDeliverable(deliverableId) {
      const index = data.deliverables.findIndex(d => d.id === deliverableId)
      if (index === -1) return false
      data.deliverables.splice(index, 1)
      notify()
      return true
    },

    listMilestones(projectId) {
      return data.milestones
        .filter(m => m.project_id === projectId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(m => ({ ...m }))
    },

    listDeliverables(milestoneId) {
      return data.deliverables.filter(d => d.milestone_id === milestoneId).map(d => ({ ...d }))
    },

    snapshot,

    cloneProject(sourceProjectId, cloneOptions) {
      const source = snapshot(sourceProjectId)
      if (!source) return null
      return insertSnapshot(cloneProjectSnapshot(source, cloneOptions, cloneDeps))
    },

    listTemplates() {
      return data.templates.map(copyTemplate)
    },

    getTemplate(templateId) {
      const template = data.templates.find(t => t.id === templateId)
      return template ? copyTemplate(template) : null
    },

    saveTemplate(projectId, templateName) {
      const source = snapshot(projectId)
      if (!source) return null
      const template = buildTemplate(source, templateName, templateDeps)
      data.templates.push(template)
      notify()
      return copyTemplate(template)
    },

    createTemplate(templateName, structure) {
      const template = buildTemplateFromStructure(templateName, structure, templateDeps)
      if (!template) return null
      data.templates.push(template)
      notify()
      return copyTemplate(template)
    },

    updateTemplate(templateId, changes) {
      const index = data.templates.findIndex(t => t.id === templateId)
      if (index === -1) return null
      const revised = reviseTemplate(data.templates[index], changes)
      if (!revised) return null
      data.templates[index] = revised
      notify()
      return copyTemplate(revised)
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
