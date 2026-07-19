// ---------------------------------------------------------------------------
// Template library (v1.16.5): save a project's milestone/deliverable
// structure as a named template, list saved templates, and start new projects
// from one. Templates are structure only (titles + ordering); statuses are
// never stored and new projects start in planning with pending work items.
// Everything lives behind the clearly marked mock boundary in
// `src/lib/projectsStore.mock.ts`; nothing here talks to a live backend.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { PROJECTS_STORE_BOUNDARY, projectsStore, type ProjectsStore } from '../lib/projectsStore.mock'
import { templateDeliverableCount, type ProjectTemplate } from '../lib/projectClone'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count !== 1 ? 's' : ''}`
}

interface TemplateLibraryProps {
  /** Projects offered as sources for "save as template", in display order. */
  projects: { id: string; name: string }[]
  /** Injected store. Defaults to the shared mock boundary (no live backend). */
  store?: ProjectsStore
}

export function TemplateLibrary({ projects, store = projectsStore }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>(() => store.listTemplates())
  useEffect(() => {
    const refresh = () => setTemplates(store.listTemplates())
    refresh()
    return store.subscribe(refresh)
  }, [store])

  // Save-as-template form
  const [saveProjectId, setSaveProjectId] = useState('')
  const [templateName, setTemplateName] = useState('')

  // Create-from-template inline form (open for one template at a time)
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')

  const [feedback, setFeedback] = useState<string | null>(null)

  function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    const template = store.saveTemplate(saveProjectId, templateName)
    if (!template) return
    setFeedback(`Saved template "${template.name}" from ${template.source_project_name}.`)
    setTemplateName('')
  }

  function openUseForm(template: ProjectTemplate) {
    setUseTemplateId(template.id)
    setProjectName(`${template.name} project`)
    setFeedback(null)
  }

  function handleCreateFromTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!useTemplateId) return
    const project = store.createFromTemplate(useTemplateId, projectName)
    if (!project) return
    setFeedback(`Created project "${project.name}" from the template. It now appears in the projects list.`)
    setUseTemplateId(null)
    setProjectName('')
  }

  return (
    <div className="space-y-3 border-t border-zinc-700/40 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-zinc-200">Template library</h4>
        <span
          title={PROJECTS_STORE_BOUNDARY}
          className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-500/30"
        >
          Demo data
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        Templates keep structure only: milestone and deliverable titles and their order. Projects created from a
        template start in planning with every item pending.
      </p>

      {/* Save a project's structure as a template */}
      <form onSubmit={handleSaveTemplate} className="flex flex-wrap gap-2">
        <select
          aria-label="Project to save as template"
          value={saveProjectId}
          onChange={e => setSaveProjectId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60"
        >
          <option value="" disabled>Choose a project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          aria-label="Template name"
          placeholder="Template name"
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60 placeholder-zinc-500"
        />
        <button
          type="submit"
          disabled={!saveProjectId || !templateName.trim()}
          className="btn-accent px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save template
        </button>
      </form>

      {feedback && (
        <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">{feedback}</p>
      )}

      {/* Template list */}
      {templates.length === 0 && (
        <p className="text-xs text-zinc-500">No templates yet. Save a project's structure above to create one.</p>
      )}
      {templates.map(template => (
        <div key={template.id} className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">{template.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                from {template.source_project_name} · {plural(template.milestones.length, 'milestone')},{' '}
                {plural(templateDeliverableCount(template), 'deliverable')} · saved {template.created_at.slice(0, 10)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {useTemplateId !== template.id && (
                <button type="button" onClick={() => openUseForm(template)} className="btn-neutral px-3 py-1.5 text-xs">
                  New project
                </button>
              )}
              <button
                type="button"
                onClick={() => store.removeTemplate(template.id)}
                aria-label={`Delete template ${template.name}`}
                title="Delete template"
                className="rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          </div>
          {useTemplateId === template.id && (
            <form onSubmit={handleCreateFromTemplate} className="mt-2 flex flex-wrap gap-2 border-t border-zinc-700/30 pt-2">
              <input
                aria-label="New project name"
                placeholder="New project name"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60 placeholder-zinc-500"
              />
              <button
                type="submit"
                disabled={!projectName.trim()}
                className="btn-accent px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create project
              </button>
              <button type="button" onClick={() => setUseTemplateId(null)} className="btn-neutral px-3 py-1.5 text-xs">
                Cancel
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  )
}
