import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Activity,
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from '../api/activities'
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

function CompletedBadge({ completed }: { completed: boolean }) {
  return completed ? (
    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
      Done
    </span>
  ) : (
    <span className="rounded-md border border-zinc-500/40 bg-zinc-700/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
      Pending
    </span>
  )
}

interface EditDraft {
  activity_type: string
  subject: string
  notes: string
  due_at: string
  completed: boolean
}

export function ActivitiesPage() {
  const token = useRef(readStoredToken())
  const isAuthed = token.current.length > 0

  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newType, setNewType] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newDueAt, setNewDueAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ activity_type: '', subject: '', notes: '', due_at: '', completed: false })
  const [saving, setSaving] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthed) return
    setLoading(true)
    setError('')
    try {
      const all = await listActivities(token.current)
      setActivities(all)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }, [isAuthed])

  useEffect(() => { void load() }, [load])

  const filtered = activities.filter((a) => {
    const matchType = !typeFilter || a.activity_type.toLowerCase().includes(typeFilter.toLowerCase())
    const matchSearch = !search.trim() || a.subject.toLowerCase().includes(search.toLowerCase()) || (a.notes ?? '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const handleCreate = async () => {
    if (!newType.trim()) { setCreateError('Type is required'); return }
    if (!newSubject.trim()) { setCreateError('Subject is required'); return }
    setCreating(true)
    setCreateError('')
    try {
      const created = await createActivity(token.current, {
        activity_type: newType.trim(),
        subject: newSubject.trim(),
        notes: newNotes.trim() || undefined,
        due_at: newDueAt || undefined,
      })
      setActivities((prev) => [created, ...prev])
      setNewType('')
      setNewSubject('')
      setNewNotes('')
      setNewDueAt('')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (a: Activity) => {
    setEditingId(a.id)
    setEditDraft({ activity_type: a.activity_type, subject: a.subject, notes: a.notes ?? '', due_at: a.due_at ?? '', completed: a.completed })
  }

  const handleSave = async () => {
    if (!editingId || !editDraft.activity_type.trim() || !editDraft.subject.trim()) return
    setSaving(true)
    try {
      const updated = await updateActivity(token.current, editingId, {
        activity_type: editDraft.activity_type.trim(),
        subject: editDraft.subject.trim(),
        notes: editDraft.notes.trim() || undefined,
        due_at: editDraft.due_at || undefined,
        completed: editDraft.completed,
      })
      setActivities((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
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
      await deleteActivity(token.current, id)
      setActivities((prev) => prev.filter((a) => a.id !== id))
      setDeleteConfirmId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAuthed) {
    return (
      <PageLayout title="Activities">
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="text-sm text-zinc-400">Sign in on the home page to manage activities.</p>
          <a href="#/" className="mt-4 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/60 hover:text-zinc-100">
            ← Go to home
          </a>
        </section>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Activities">
      {/* Toolbar */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search subject / notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30"
          />
          <input
            type="text"
            placeholder="Filter by type…"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-36 rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
          />
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            {showCreate ? '✕ Cancel' : '+ New Activity'}
          </button>
        </div>

        {showCreate && (
          <div className="mt-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4">
            <form onSubmit={(e) => { e.preventDefault(); void handleCreate() }} className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Type (e.g. call, email) *"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                placeholder="Subject *"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                placeholder="Notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="datetime-local"
                value={newDueAt}
                onChange={(e) => setNewDueAt(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-400/60"
              />
              <button
                type="submit"
                disabled={creating}
                className="sm:col-span-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Activity'}
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
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {activities.length === 0 ? 'No activities yet. Create one above.' : 'No activities match your filters.'}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {filtered.map((a) => {
              const isEditing = editingId === a.id
              const isDeleteConfirm = deleteConfirmId === a.id
              return (
                <li key={a.id} className="group px-5 py-4">
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Type *"
                        value={editDraft.activity_type}
                        onChange={(e) => setEditDraft((d) => ({ ...d, activity_type: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <input
                        type="text"
                        placeholder="Subject *"
                        value={editDraft.subject}
                        onChange={(e) => setEditDraft((d) => ({ ...d, subject: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <input
                        type="text"
                        placeholder="Notes"
                        value={editDraft.notes}
                        onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <input
                        type="datetime-local"
                        value={editDraft.due_at}
                        onChange={(e) => setEditDraft((d) => ({ ...d, due_at: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 outline-none"
                      />
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={editDraft.completed}
                          onChange={(e) => setEditDraft((d) => ({ ...d, completed: e.target.checked }))}
                          className="accent-emerald-400"
                        />
                        Completed
                      </label>
                      <div className="flex gap-2">
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
                          <span className="font-medium text-zinc-100">{a.subject}</span>
                          <span className="rounded-md border border-zinc-600/40 bg-zinc-700/40 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            {a.activity_type}
                          </span>
                          <CompletedBadge completed={a.completed} />
                        </div>
                        {a.notes && <p className="mt-0.5 text-xs text-zinc-500">{a.notes}</p>}
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {a.due_at ? `Due ${a.due_at.slice(0, 10)}` : 'No due date'} · Created {a.created_at.slice(0, 10)}
                        </p>
                      </div>
                      {isDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(a.id)}
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
                            onClick={() => startEdit(a)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(a.id)}
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
