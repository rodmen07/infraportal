import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type IntegrationConnection,
  createConnection,
  deleteConnection,
  listConnections,
  updateConnection,
} from '../api/integrations'
import { PageLayout } from './PageLayout'

const STATUS_STYLE: Record<string, string> = {
  connected: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  disconnected: 'border-red-400/40 bg-red-500/15 text-red-300',
  error: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
}

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

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? 'border-zinc-500/40 bg-zinc-700/40 text-zinc-400'
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {status}
    </span>
  )
}

interface EditDraft {
  status: string
  last_synced_at: string
}

export function IntegrationsPage() {
  const token = useRef(readStoredToken())
  const isAuthed = token.current.length > 0

  const [connections, setConnections] = useState<IntegrationConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newProvider, setNewProvider] = useState('')
  const [newAccountRef, setNewAccountRef] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ status: '', last_synced_at: '' })
  const [saving, setSaving] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthed) return
    setLoading(true)
    setError('')
    try {
      setConnections(await listConnections(token.current))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connections')
    } finally {
      setLoading(false)
    }
  }, [isAuthed])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!newProvider.trim()) { setCreateError('Provider is required'); return }
    if (!newAccountRef.trim()) { setCreateError('Account ref is required'); return }
    setCreating(true)
    setCreateError('')
    try {
      const created = await createConnection(token.current, {
        provider: newProvider.trim(),
        account_ref: newAccountRef.trim(),
      })
      setConnections((prev) => [created, ...prev])
      setNewProvider('')
      setNewAccountRef('')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (c: IntegrationConnection) => {
    setEditingId(c.id)
    setEditDraft({ status: c.status, last_synced_at: c.last_synced_at ?? '' })
  }

  const handleSave = async () => {
    if (!editingId || !editDraft.status.trim()) return
    setSaving(true)
    try {
      const updated = await updateConnection(token.current, editingId, {
        status: editDraft.status.trim(),
        last_synced_at: editDraft.last_synced_at || undefined,
      })
      setConnections((prev) => prev.map((c) => (c.id === editingId ? updated : c)))
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
      await deleteConnection(token.current, id)
      setConnections((prev) => prev.filter((c) => c.id !== id))
      setDeleteConfirmId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAuthed) {
    return (
      <PageLayout title="Integrations">
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="text-sm text-zinc-400">Sign in on the home page to manage integrations.</p>
          <a href="#/" className="mt-4 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/60 hover:text-zinc-100">
            ← Go to home
          </a>
        </section>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Integrations">
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-zinc-400">{connections.length} connection{connections.length !== 1 ? 's' : ''}</p>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            {showCreate ? '✕ Cancel' : '+ New Connection'}
          </button>
        </div>

        {showCreate && (
          <div className="mt-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4">
            <form onSubmit={(e) => { e.preventDefault(); void handleCreate() }} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                placeholder="Provider * (e.g. github, slack)"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                placeholder="Account ref * (e.g. org-id)"
                value={newAccountRef}
                onChange={(e) => setNewAccountRef(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {creating ? 'Connecting…' : 'Connect'}
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
        ) : connections.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No connections yet. Add one above.</div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {connections.map((c) => {
              const isEditing = editingId === c.id
              const isDeleteConfirm = deleteConfirmId === c.id
              return (
                <li key={c.id} className="group px-5 py-4">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={editDraft.status}
                        onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-2 py-1.5 text-sm text-zinc-300 outline-none"
                      >
                        {['connected', 'disconnected', 'error'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <input
                        type="datetime-local"
                        value={editDraft.last_synced_at}
                        onChange={(e) => setEditDraft((d) => ({ ...d, last_synced_at: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 outline-none"
                      />
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
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-zinc-100">{c.provider}</span>
                          <StatusBadge status={c.status} />
                          <span className="text-xs text-zinc-500">{c.account_ref}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {c.last_synced_at ? `Last synced ${c.last_synced_at.slice(0, 10)}` : 'Never synced'} · Connected {c.created_at.slice(0, 10)}
                        </p>
                      </div>
                      {isDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Disconnect?</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(c.id)}
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
                            onClick={() => startEdit(c)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(c.id)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
                          >
                            Remove
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
