import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Opportunity,
  createOpportunity,
  deleteOpportunity,
  listOpportunities,
  updateOpportunity,
} from '../api/opportunities'
import { PageLayout } from './PageLayout'

const STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'] as const
type Stage = (typeof STAGES)[number]

const STAGE_STYLE: Record<Stage, string> = {
  'prospect': 'border-zinc-500/40 bg-zinc-700/40 text-zinc-400',
  'qualified': 'border-blue-400/40 bg-blue-500/15 text-blue-300',
  'proposal': 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  'negotiation': 'border-orange-400/40 bg-orange-500/15 text-orange-300',
  'closed-won': 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  'closed-lost': 'border-red-400/40 bg-red-500/15 text-red-300',
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

function StageBadge({ stage }: { stage: string }) {
  const style = STAGE_STYLE[stage as Stage] ?? 'border-zinc-500/40 bg-zinc-700/40 text-zinc-400'
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {stage}
    </span>
  )
}

interface EditDraft {
  name: string
  stage: string
  amount: string
  close_date: string
}

export function OpportunitiesPage() {
  const token = useRef(readStoredToken())
  const isAuthed = token.current.length > 0

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAccountId, setNewAccountId] = useState('')
  const [newStage, setNewStage] = useState<string>('prospect')
  const [newAmount, setNewAmount] = useState('')
  const [newCloseDate, setNewCloseDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', stage: '', amount: '', close_date: '' })
  const [saving, setSaving] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthed) return
    setLoading(true)
    setError('')
    try {
      setOpportunities(await listOpportunities(token.current))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [isAuthed])

  useEffect(() => { void load() }, [load])

  const filtered = opportunities.filter((o) => {
    const matchStage = stageFilter === 'all' || o.stage === stageFilter
    const matchSearch = !search.trim() || o.name.toLowerCase().includes(search.toLowerCase())
    return matchStage && matchSearch
  })

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError('Name is required'); return }
    if (!newAccountId.trim()) { setCreateError('Account ID is required'); return }
    setCreating(true)
    setCreateError('')
    try {
      const created = await createOpportunity(token.current, {
        name: newName.trim(),
        account_id: newAccountId.trim(),
        stage: newStage,
        amount: newAmount ? parseFloat(newAmount) : undefined,
        close_date: newCloseDate || undefined,
      })
      setOpportunities((prev) => [created, ...prev])
      setNewName('')
      setNewAccountId('')
      setNewStage('prospect')
      setNewAmount('')
      setNewCloseDate('')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (o: Opportunity) => {
    setEditingId(o.id)
    setEditDraft({ name: o.name, stage: o.stage, amount: o.amount ? String(o.amount) : '', close_date: o.close_date ?? '' })
  }

  const handleSave = async () => {
    if (!editingId || !editDraft.name.trim()) return
    setSaving(true)
    try {
      const updated = await updateOpportunity(token.current, editingId, {
        name: editDraft.name.trim(),
        stage: editDraft.stage,
        amount: editDraft.amount ? parseFloat(editDraft.amount) : undefined,
        close_date: editDraft.close_date || undefined,
      })
      setOpportunities((prev) => prev.map((o) => (o.id === editingId ? updated : o)))
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
      await deleteOpportunity(token.current, id)
      setOpportunities((prev) => prev.filter((o) => o.id !== id))
      setDeleteConfirmId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAuthed) {
    return (
      <PageLayout title="Opportunities">
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="text-sm text-zinc-400">Sign in on the home page to manage opportunities.</p>
          <a href="#/" className="mt-4 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/60 hover:text-zinc-100">
            ← Go to home
          </a>
        </section>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Opportunities">
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search opportunities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30"
          />
          <div className="flex flex-wrap gap-1.5">
            {['all', ...STAGES].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStageFilter(s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  stageFilter === s
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                    : 'border-zinc-600/50 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500/60 hover:text-zinc-200'
                }`}
              >
                {s === 'all' ? `All (${opportunities.length})` : s}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            {showCreate ? '✕ Cancel' : '+ New Opportunity'}
          </button>
        </div>

        {showCreate && (
          <div className="mt-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4">
            <form onSubmit={(e) => { e.preventDefault(); void handleCreate() }} className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Opportunity name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                placeholder="Account ID *"
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-400/60"
              >
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="number"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="date"
                value={newCloseDate}
                onChange={(e) => setNewCloseDate(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-400/60"
              />
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
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
            {opportunities.length === 0 ? 'No opportunities yet. Create one above.' : 'No opportunities match your filters.'}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {filtered.map((o) => {
              const isEditing = editingId === o.id
              const isDeleteConfirm = deleteConfirmId === o.id
              return (
                <li key={o.id} className="group px-5 py-4">
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Name *"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <select
                        value={editDraft.stage}
                        onChange={(e) => setEditDraft((d) => ({ ...d, stage: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-2 py-1.5 text-sm text-zinc-300 outline-none"
                      >
                        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={editDraft.amount}
                        onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <input
                        type="date"
                        value={editDraft.close_date}
                        onChange={(e) => setEditDraft((d) => ({ ...d, close_date: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300 outline-none"
                      />
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
                          <span className="font-medium text-zinc-100">{o.name}</span>
                          <StageBadge stage={o.stage} />
                          {o.amount > 0 && (
                            <span className="text-sm font-medium text-emerald-400">
                              ${o.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {o.close_date ? `Close ${o.close_date}` : 'No close date'} · Created {o.created_at.slice(0, 10)}
                        </p>
                      </div>
                      {isDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(o.id)}
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
                            onClick={() => startEdit(o)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(o.id)}
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
