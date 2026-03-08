import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Workflow,
  createWorkflow,
  deleteWorkflow,
  listWorkflows,
  updateWorkflow,
} from '../api/automation'
import { PageLayout } from './PageLayout'

function readStoredToken(): string {
  try {
    const raw = window.localStorage.getItem('taskforge.auth.session')
    if (!raw) return ''
    const session = JSON.parse(raw) as { accessToken?: string; expiresAt?: number }
    if (!session.accessToken || !session.expiresAt || session.expiresAt <= Date.now()) return ''
    return session.accessToken
  } catch {
    return ''
  }
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
      Enabled
    </span>
  ) : (
    <span className="rounded-md border border-zinc-500/40 bg-zinc-700/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
      Disabled
    </span>
  )
}

interface EditDraft {
  name: string
  trigger_event: string
  action_type: string
  enabled: boolean
}

export function AutomationPage() {
  const token = useRef(readStoredToken())
  const isAuthed = token.current.length > 0

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTrigger, setNewTrigger] = useState('')
  const [newAction, setNewAction] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', trigger_event: '', action_type: '', enabled: true })
  const [saving, setSaving] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthed) return
    setLoading(true)
    setError('')
    try {
      setWorkflows(await listWorkflows(token.current))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [isAuthed])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError('Name is required'); return }
    if (!newTrigger.trim()) { setCreateError('Trigger event is required'); return }
    if (!newAction.trim()) { setCreateError('Action type is required'); return }
    setCreating(true)
    setCreateError('')
    try {
      const created = await createWorkflow(token.current, {
        name: newName.trim(),
        trigger_event: newTrigger.trim(),
        action_type: newAction.trim(),
      })
      setWorkflows((prev) => [created, ...prev])
      setNewName('')
      setNewTrigger('')
      setNewAction('')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (w: Workflow) => {
    setEditingId(w.id)
    setEditDraft({ name: w.name, trigger_event: w.trigger_event, action_type: w.action_type, enabled: w.enabled })
  }

  const handleSave = async () => {
    if (!editingId || !editDraft.name.trim() || !editDraft.trigger_event.trim() || !editDraft.action_type.trim()) return
    setSaving(true)
    try {
      const updated = await updateWorkflow(token.current, editingId, {
        name: editDraft.name.trim(),
        trigger_event: editDraft.trigger_event.trim(),
        action_type: editDraft.action_type.trim(),
        enabled: editDraft.enabled,
      })
      setWorkflows((prev) => prev.map((w) => (w.id === editingId ? updated : w)))
      setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await deleteWorkflow(token.current, id)
      setWorkflows((prev) => prev.filter((w) => w.id !== id))
      setDeleteConfirmId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAuthed) {
    return (
      <PageLayout title="Automation">
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="text-sm text-zinc-400">Sign in on the home page to manage workflows.</p>
          <a href="#/" className="mt-4 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/60 hover:text-zinc-100">
            ← Go to home
          </a>
        </section>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Automation">
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-zinc-400">{workflows.length} workflow{workflows.length !== 1 ? 's' : ''}</p>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            {showCreate ? '✕ Cancel' : '+ New Workflow'}
          </button>
        </div>

        {showCreate && (
          <div className="mt-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4">
            <form onSubmit={(e) => { e.preventDefault(); void handleCreate() }} className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Workflow name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                placeholder="Trigger event * (e.g. contact.created)"
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                placeholder="Action type * (e.g. send_email)"
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <button
                type="submit"
                disabled={creating}
                className="sm:col-span-3 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Workflow'}
              </button>
            </form>
            {createError && <p className="mt-2 text-xs text-red-400">{createError}</p>}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : workflows.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No workflows yet. Create one above.</div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {workflows.map((w) => {
              const isEditing = editingId === w.id
              const isDeleteConfirm = deleteConfirmId === w.id
              return (
                <li key={w.id} className="group px-5 py-4">
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Name *"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <input
                        type="text"
                        placeholder="Trigger event *"
                        value={editDraft.trigger_event}
                        onChange={(e) => setEditDraft((d) => ({ ...d, trigger_event: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <input
                        type="text"
                        placeholder="Action type *"
                        value={editDraft.action_type}
                        onChange={(e) => setEditDraft((d) => ({ ...d, action_type: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={editDraft.enabled}
                          onChange={(e) => setEditDraft((d) => ({ ...d, enabled: e.target.checked }))}
                          className="accent-emerald-400"
                        />
                        Enabled
                      </label>
                      <div className="flex gap-2 sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => void handleSave()}
                          disabled={saving}
                          className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          {saving ? '…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-zinc-600/50 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-zinc-100">{w.name}</span>
                          <EnabledBadge enabled={w.enabled} />
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          <span className="text-zinc-600">trigger:</span> {w.trigger_event}
                          <span className="mx-1.5 text-zinc-700">·</span>
                          <span className="text-zinc-600">action:</span> {w.action_type}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">Created {w.created_at.slice(0, 10)}</p>
                      </div>
                      {isDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(w.id)}
                            disabled={deleting}
                            className="rounded border border-red-400/40 bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                          >
                            {deleting ? '…' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded border border-zinc-600/40 bg-zinc-700/40 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => startEdit(w)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(w.id)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="text-center">
        <a href="#/" className="inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100">
          ← Back to home
        </a>
      </div>
    </PageLayout>
  )
}
