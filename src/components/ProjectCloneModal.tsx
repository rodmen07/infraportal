// ---------------------------------------------------------------------------
// Project clone modal (v1.16.5): pick a source project, name the copy, choose
// what to include, review a summary, then watch progress as the copy lands in
// the demo store. All reads and writes go through the clearly marked mock
// boundary in `src/lib/projectsStore.mock.ts`; nothing here talks to a live
// backend (decommissioned 2026-06-04).
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import { PROJECTS_STORE_BOUNDARY, projectsStore, type ProjectsStore } from '../lib/projectsStore.mock'
import type { DemoProject } from '../lib/projectClone'
import { STATUS_RESET_DESCRIPTION } from '../lib/projectStatusVocabulary'

const INPUT_CLS = 'w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition hover:border-zinc-600 hover:bg-zinc-800/80 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count !== 1 ? 's' : ''}`
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface CloneResult {
  project: DemoProject
  milestones: number
  deliverables: number
}

interface ProjectCloneModalProps {
  /** Candidate source projects in display order. */
  projects: { id: string; name: string }[]
  /** Preselected source (e.g. the project currently open). */
  initialSourceId?: string
  /** Injected store. Defaults to the shared mock boundary (no live backend). */
  store?: ProjectsStore
  onClose: () => void
}

export function ProjectCloneModal({ projects, initialSourceId, store = projectsStore, onClose }: ProjectCloneModalProps) {
  const [sourceId, setSourceId] = useState(() =>
    initialSourceId && projects.some(p => p.id === initialSourceId) ? initialSourceId : (projects[0]?.id ?? ''))
  const sourceName = projects.find(p => p.id === sourceId)?.name ?? ''
  const [name, setName] = useState(() => (sourceName ? `${sourceName} (copy)` : ''))
  const [nameTouched, setNameTouched] = useState(false)

  const [includeMilestones, setIncludeMilestones] = useState(true)
  const [includeDeliverables, setIncludeDeliverables] = useState(true)
  const [resetStatuses, setResetStatuses] = useState(true)

  const [step, setStep] = useState<'configure' | 'confirm'>('configure')
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [phase, setPhase] = useState('')
  const [percent, setPercent] = useState(0)
  const [result, setResult] = useState<CloneResult | null>(null)

  const counts = useMemo(() => {
    const snap = store.snapshot(sourceId)
    if (!snap) return { milestones: 0, deliverables: 0 }
    return { milestones: snap.milestones.length, deliverables: snap.deliverables.length }
  }, [store, sourceId])

  const running = status === 'running'
  const finished = status === 'done' || status === 'failed'
  const canSubmit = Boolean(sourceId) && name.trim().length > 0

  function handleSourceChange(id: string) {
    setSourceId(id)
    if (!nameTouched) {
      const nextName = projects.find(p => p.id === id)?.name
      setName(nextName ? `${nextName} (copy)` : '')
    }
  }

  function handleClose() {
    if (running) return // the copy is atomic and sub-second; let it finish
    onClose()
  }

  async function handleClone() {
    setStatus('running')
    const phases = ['Copying project details']
    if (includeMilestones) phases.push(`Copying ${plural(counts.milestones, 'milestone')}`)
    if (includeMilestones && includeDeliverables) phases.push(`Copying ${plural(counts.deliverables, 'deliverable')}`)
    if (resetStatuses) phases.push('Resetting statuses')
    for (let i = 0; i < phases.length; i++) {
      setPhase(phases[i])
      setPercent(Math.round((i / phases.length) * 100))
      await delay(220)
    }
    const project = store.cloneProject(sourceId, {
      newName: name,
      includeMilestones,
      includeDeliverables: includeMilestones && includeDeliverables,
      resetStatuses,
    })
    setPercent(100)
    if (!project) {
      setStatus('failed')
      return
    }
    const clonedMilestones = store.listMilestones(project.id)
    setResult({
      project,
      milestones: clonedMilestones.length,
      deliverables: clonedMilestones.reduce((n, m) => n + store.listDeliverables(m.id).length, 0),
    })
    setStatus('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={handleClose} role="presentation">
      <div
        className="forge-panel surface-card-strong max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 shadow-2xl shadow-black/60"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-clone-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="project-clone-title" className="text-base font-bold text-white">Clone project</h3>
            <span
              title={PROJECTS_STORE_BOUNDARY}
              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-500/30"
            >
              Demo mode
            </span>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close dialog" className="text-zinc-500 transition-colors hover:text-white">✕</button>
        </div>

        <p className="mb-4 text-xs text-zinc-400">
          Copies a project and its structure inside the in-memory demo dataset. Nothing is sent to a live backend.
        </p>

        <div className="space-y-4">
          {/* Step 1: configure */}
          {!running && !finished && step === 'configure' && (
            <>
              <div>
                <label htmlFor="clone-source" className="mb-1 block text-sm font-medium text-zinc-400">Source project</label>
                <select id="clone-source" className={INPUT_CLS} value={sourceId} onChange={e => handleSourceChange(e.target.value)}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {plural(counts.milestones, 'milestone')}, {plural(counts.deliverables, 'deliverable')}
                </p>
              </div>
              <div>
                <label htmlFor="clone-name" className="mb-1 block text-sm font-medium text-zinc-400">Name of the copy</label>
                <input
                  id="clone-name"
                  className={INPUT_CLS}
                  value={name}
                  onChange={e => { setName(e.target.value); setNameTouched(true) }}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 block text-sm font-medium text-zinc-400">Options</legend>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" className="rounded" checked={includeMilestones} onChange={e => setIncludeMilestones(e.target.checked)} />
                  Include milestones
                </label>
                <label className={`flex items-center gap-2 text-sm ${includeMilestones ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={includeMilestones && includeDeliverables}
                    disabled={!includeMilestones}
                    onChange={e => setIncludeDeliverables(e.target.checked)}
                  />
                  Include deliverables
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" className="rounded" checked={resetStatuses} onChange={e => setResetStatuses(e.target.checked)} />
                  Reset statuses for a fresh start
                </label>
              </fieldset>
            </>
          )}

          {/* Step 2: confirm */}
          {!running && !finished && step === 'confirm' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-300">
                Clone <span className="font-semibold">{sourceName}</span> to{' '}
                <span className="font-semibold">{name.trim()}</span>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-400/80">
                <li>
                  {includeMilestones
                    ? `Includes ${plural(counts.milestones, 'milestone')}${includeDeliverables ? ` and ${plural(counts.deliverables, 'deliverable')}` : ' (deliverables skipped)'}`
                    : 'Project details only (milestones and deliverables skipped)'}
                </li>
                <li>{resetStatuses ? `Statuses reset: ${STATUS_RESET_DESCRIPTION}` : 'Statuses copied as-is'}</li>
                <li>The copy starts unassigned (no client user)</li>
              </ul>
            </div>
          )}

          {/* Progress */}
          {running && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                <span>{phase}</span>
                <span>{percent}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-zinc-800"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Clone progress"
              >
                <div className="h-full rounded-full bg-amber-500/80 transition-all duration-200" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}

          {/* Result */}
          {status === 'done' && result && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
              <p className="text-sm font-medium text-green-300">
                Created {result.project.name} with {plural(result.milestones, 'milestone')} and {plural(result.deliverables, 'deliverable')}.
              </p>
              <p className="mt-1 text-xs text-green-400/80">It now appears in the projects list.</p>
            </div>
          )}
          {status === 'failed' && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-medium text-red-300">Clone failed: the source project no longer exists.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            {running ? (
              <span className="px-4 py-2 text-sm text-zinc-500">Cloning…</span>
            ) : finished ? (
              <button type="button" onClick={handleClose} className="btn-accent px-4 py-2 text-sm">Close</button>
            ) : step === 'configure' ? (
              <>
                <button type="button" onClick={handleClose} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  disabled={!canSubmit}
                  className="btn-accent px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Review clone
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep('configure')} className="btn-neutral px-4 py-2 text-sm">Back</button>
                <button type="button" onClick={handleClone} className="btn-accent px-4 py-2 text-sm">Clone project</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
