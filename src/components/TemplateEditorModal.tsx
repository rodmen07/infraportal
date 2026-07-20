// ---------------------------------------------------------------------------
// Template editor modal (v1.16.5 PR2): write a project template from scratch
// or edit an existing one. Structure only, matching the template contract:
// milestone titles in order, each with deliverable titles. Statuses are never
// edited here because templates never store them; projects created from a
// template always start from the spec-locked reset statuses.
//
// All writes go through the clearly marked mock boundary in
// `src/lib/projectsStore.mock.ts`; nothing here talks to a live backend
// (decommissioned 2026-06-04).
//
// Styling note: the panel uses concrete utilities that render in both themes
// rather than `surface-card-strong` / `forge-panel`, which were ghost classes
// when this was written (v1.18 UX audit finding F1). Those two now have real,
// token-built definitions as of v1.18.1 PR1; adopting them here is part of the
// v1.18.4 component-consolidation pass, not this one. The text fields below
// did move onto the shared token-built `.field-input` recipe in v1.18.1 PR2.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { PROJECTS_STORE_BOUNDARY, projectsStore, type ProjectsStore } from '../lib/projectsStore.mock'
import type { ProjectTemplate, TemplateDraftMilestone } from '../lib/projectClone'

// v1.18.1 PR2: on the shared, token-built `.field-input` recipe from
// src/styles/tokens.css. `min-w-0 flex-1` and the size utilities stay here
// because they are layout, not theme.
const FIELD_CLS =
  'field-input min-w-0 flex-1 px-2 py-1.5 text-xs outline-none'

// React list keys for draft rows. Module-scoped so key generation is safe
// during render (no ref reads); rows only need uniqueness, not continuity.
let draftKeyCounter = 0
const nextKey = () => ++draftKeyCounter

interface DraftDeliverable {
  key: number
  name: string
}

interface DraftMilestone {
  key: number
  name: string
  deliverables: DraftDeliverable[]
}

interface TemplateEditorModalProps {
  /** When set, the editor opens prefilled and saves as an edit of this template. */
  template?: ProjectTemplate
  /** Injected store. Defaults to the shared mock boundary (no live backend). */
  store?: ProjectsStore
  /** Called with a human-readable summary after a successful save. */
  onSaved: (message: string) => void
  onClose: () => void
}

export function TemplateEditorModal({ template, store = projectsStore, onSaved, onClose }: TemplateEditorModalProps) {
  const [name, setName] = useState(() => template?.name ?? '')
  const [rows, setRows] = useState<DraftMilestone[]>(() =>
    template
      ? template.milestones.map(milestone => ({
          key: nextKey(),
          name: milestone.name,
          deliverables: milestone.deliverables.map(deliverable => ({ key: nextKey(), name: deliverable.name })),
        }))
      : [{ key: nextKey(), name: '', deliverables: [{ key: nextKey(), name: '' }] }],
  )
  const [error, setError] = useState<string | null>(null)

  const canSave = name.trim() !== '' && rows.some(row => row.name.trim() !== '')

  function patchRow(key: number, patch: (row: DraftMilestone) => DraftMilestone) {
    setRows(current => current.map(row => (row.key === key ? patch(row) : row)))
  }

  function addMilestone() {
    setRows(current => [...current, { key: nextKey(), name: '', deliverables: [] }])
  }

  function removeMilestone(key: number) {
    setRows(current => current.filter(row => row.key !== key))
  }

  function moveMilestone(key: number, delta: -1 | 1) {
    setRows(current => {
      const index = current.findIndex(row => row.key === key)
      const target = index + delta
      if (index === -1 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function addDeliverable(rowKey: number) {
    patchRow(rowKey, row => ({
      ...row,
      deliverables: [...row.deliverables, { key: nextKey(), name: '' }],
    }))
  }

  function removeDeliverable(rowKey: number, deliverableKey: number) {
    patchRow(rowKey, row => ({
      ...row,
      deliverables: row.deliverables.filter(deliverable => deliverable.key !== deliverableKey),
    }))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const structure: TemplateDraftMilestone[] = rows.map(row => ({
      name: row.name,
      deliverables: row.deliverables.map(deliverable => deliverable.name),
    }))
    const saved = template
      ? store.updateTemplate(template.id, { name, milestones: structure })
      : store.createTemplate(name, structure)
    if (!saved) {
      setError(
        template
          ? 'Could not save: the template no longer exists or the edit left it without a named milestone.'
          : 'Could not save: a template needs a name and at least one named milestone.',
      )
      return
    }
    onSaved(
      template
        ? `Updated template "${saved.name}".`
        : `Created template "${saved.name}" from scratch. Use it below to start a project.`,
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose} role="presentation">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-700/60 bg-zinc-900/80 p-6 shadow-2xl shadow-black/60 backdrop-blur-sm"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-editor-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="template-editor-title" className="text-base font-bold text-white">
              {template ? 'Edit template' : 'New template'}
            </h3>
            <span
              title={PROJECTS_STORE_BOUNDARY}
              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-500/30"
            >
              Demo mode
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-zinc-500 transition-colors hover:text-white">✕</button>
        </div>

        <p className="mb-4 text-xs text-zinc-400">
          Templates hold structure only: milestone and deliverable titles in order. Rows without a title are dropped
          when saving. Everything stays in the in-memory demo dataset.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="template-editor-name" className="mb-1 block text-sm font-medium text-zinc-400">Template name</label>
            <input
              id="template-editor-name"
              className={FIELD_CLS + ' w-full'}
              placeholder="e.g. SOC 2 readiness track"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-400">Milestones</p>
            {rows.length === 0 && (
              <p className="text-xs text-zinc-500">No milestones. Add at least one named milestone to save.</p>
            )}
            {rows.map((row, index) => (
              <div key={row.key} className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3">
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`Milestone ${index + 1} name`}
                    placeholder="Milestone name"
                    className={FIELD_CLS}
                    value={row.name}
                    onChange={e => patchRow(row.key, r => ({ ...r, name: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => moveMilestone(row.key, -1)}
                    disabled={index === 0}
                    aria-label={`Move milestone ${index + 1} up`}
                    className="rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMilestone(row.key, 1)}
                    disabled={index === rows.length - 1}
                    aria-label={`Move milestone ${index + 1} down`}
                    className="rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMilestone(row.key)}
                    aria-label={`Remove milestone ${index + 1}`}
                    title="Remove milestone"
                    className="rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 space-y-1.5 border-t border-zinc-700/30 pt-2">
                  {row.deliverables.map((deliverable, deliverableIndex) => (
                    <div key={deliverable.key} className="flex items-center gap-2 pl-4">
                      <input
                        aria-label={`Milestone ${index + 1} deliverable ${deliverableIndex + 1} name`}
                        placeholder="Deliverable name"
                        className={FIELD_CLS}
                        value={deliverable.name}
                        onChange={e =>
                          patchRow(row.key, r => ({
                            ...r,
                            deliverables: r.deliverables.map(d =>
                              d.key === deliverable.key ? { ...d, name: e.target.value } : d),
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeDeliverable(row.key, deliverable.key)}
                        aria-label={`Remove milestone ${index + 1} deliverable ${deliverableIndex + 1}`}
                        title="Remove deliverable"
                        className="rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addDeliverable(row.key)}
                    className="pl-4 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    + Deliverable
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addMilestone} className="btn-neutral px-3 py-1.5 text-xs">
              + Milestone
            </button>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
            <button
              type="submit"
              disabled={!canSave}
              className="btn-accent px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {template ? 'Save changes' : 'Create template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
