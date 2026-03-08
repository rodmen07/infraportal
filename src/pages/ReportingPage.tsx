import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type DashboardSummary,
  type SavedReport,
  createReport,
  deleteReport,
  getDashboardSummary,
  listReports,
  updateReport,
} from '../api/reporting'
import { type SearchResult, searchDocuments } from '../api/search'
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

interface EditDraft {
  name: string
  metric: string
  description: string
  dimension: string
}

export function ReportingPage() {
  const token = useRef(readStoredToken())
  const isAuthed = token.current.length > 0

  // Dashboard
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  // Reports
  const [reports, setReports] = useState<SavedReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMetric, setNewMetric] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDimension, setNewDimension] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', metric: '', description: '', dimension: '' })
  const [saving, setSaving] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const load = useCallback(async () => {
    if (!isAuthed) return
    setLoading(true)
    setError('')
    try {
      const [sum, rpts] = await Promise.all([
        getDashboardSummary(token.current),
        listReports(token.current),
      ])
      setSummary(sum)
      setReports(rpts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [isAuthed])

  useEffect(() => { void load() }, [load])

  const handleSearch = async () => {
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); return }
    setSearching(true)
    setSearchError('')
    try {
      setSearchResults(await searchDocuments(token.current, q))
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError('Name is required'); return }
    if (!newMetric.trim()) { setCreateError('Metric is required'); return }
    setCreating(true)
    setCreateError('')
    try {
      const created = await createReport(token.current, {
        name: newName.trim(),
        metric: newMetric.trim(),
        description: newDescription.trim() || undefined,
        dimension: newDimension.trim() || undefined,
      })
      setReports((prev) => [created, ...prev])
      setSummary((s) => s ? { ...s, active_reports: s.active_reports + 1 } : s)
      setNewName('')
      setNewMetric('')
      setNewDescription('')
      setNewDimension('')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (r: SavedReport) => {
    setEditingId(r.id)
    setEditDraft({ name: r.name, metric: r.metric, description: r.description ?? '', dimension: r.dimension ?? '' })
  }

  const handleSave = async () => {
    if (!editingId || !editDraft.name.trim() || !editDraft.metric.trim()) return
    setSaving(true)
    try {
      const updated = await updateReport(token.current, editingId, {
        name: editDraft.name.trim(),
        metric: editDraft.metric.trim(),
        description: editDraft.description.trim() || undefined,
        dimension: editDraft.dimension.trim() || undefined,
      })
      setReports((prev) => prev.map((r) => (r.id === editingId ? updated : r)))
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
      await deleteReport(token.current, id)
      setReports((prev) => prev.filter((r) => r.id !== id))
      setSummary((s) => s ? { ...s, active_reports: Math.max(0, s.active_reports - 1) } : s)
      setDeleteConfirmId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAuthed) {
    return (
      <PageLayout title="Reporting">
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="text-sm text-zinc-400">Sign in on the home page to view reports.</p>
          <a href="#/" className="mt-4 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/60 hover:text-zinc-100">
            ← Go to home
          </a>
        </section>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Reporting">
      {/* Dashboard summary */}
      {summary && (
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active Reports</p>
              <p className="mt-1 text-3xl font-bold text-amber-300">{summary.active_reports}</p>
            </div>
            {summary.core_metrics.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Tracked Metrics</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {summary.core_metrics.map((m) => (
                    <span key={m} className="rounded-md border border-zinc-600/40 bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-300">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Reports section */}
        <div className="space-y-4">
          <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm font-medium text-zinc-300">Saved Reports</span>
              <button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
                className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
              >
                {showCreate ? '✕ Cancel' : '+ New Report'}
              </button>
            </div>

            {showCreate && (
              <div className="mt-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4">
                <form onSubmit={(e) => { e.preventDefault(); void handleCreate() }} className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Report name *"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                  <input
                    type="text"
                    placeholder="Metric * (e.g. revenue)"
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value)}
                    className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                  <input
                    type="text"
                    placeholder="Dimension (e.g. by_region)"
                    value={newDimension}
                    onChange={(e) => setNewDimension(e.target.value)}
                    className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                  <button
                    type="submit"
                    disabled={creating}
                    className="sm:col-span-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create Report'}
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
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">No reports yet. Create one above.</div>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {reports.map((r) => {
                  const isEditing = editingId === r.id
                  const isDeleteConfirm = deleteConfirmId === r.id
                  return (
                    <li key={r.id} className="group px-5 py-4">
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
                          <input
                            type="text"
                            placeholder="Metric *"
                            value={editDraft.metric}
                            onChange={(e) => setEditDraft((d) => ({ ...d, metric: e.target.value }))}
                            className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                          />
                          <input
                            type="text"
                            placeholder="Description"
                            value={editDraft.description}
                            onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                            className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                          />
                          <input
                            type="text"
                            placeholder="Dimension"
                            value={editDraft.dimension}
                            onChange={(e) => setEditDraft((d) => ({ ...d, dimension: e.target.value }))}
                            className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
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
                              <span className="font-medium text-zinc-100">{r.name}</span>
                              <span className="rounded-md border border-zinc-600/40 bg-zinc-700/40 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                                {r.metric}
                              </span>
                              {r.dimension && (
                                <span className="text-xs text-zinc-500">{r.dimension}</span>
                              )}
                            </div>
                            {r.description && <p className="mt-0.5 text-xs text-zinc-500">{r.description}</p>}
                            <p className="mt-0.5 text-xs text-zinc-600">Created {r.created_at.slice(0, 10)}</p>
                          </div>
                          {isDeleteConfirm ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-400">Delete?</span>
                              <button
                                type="button"
                                onClick={() => void handleDelete(r.id)}
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
                                onClick={() => startEdit(r)}
                                className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(r.id)}
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
        </div>

        {/* Search widget */}
        <div className="space-y-4">
          <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <p className="mb-3 text-sm font-medium text-zinc-300">Full-text Search</p>
            <form
              onSubmit={(e) => { e.preventDefault(); void handleSearch() }}
              className="flex gap-2"
            >
              <input
                type="search"
                placeholder="Search all indexed content…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30"
              />
              <button
                type="submit"
                disabled={searching}
                className="rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-amber-400/40 hover:text-amber-300 disabled:opacity-50"
              >
                {searching ? '…' : 'Search'}
              </button>
            </form>

            {searchError && (
              <p className="mt-2 text-xs text-red-400">{searchError}</p>
            )}

            {searchResults.length > 0 && (
              <ul className="mt-3 divide-y divide-zinc-800/60 rounded-2xl border border-zinc-700/50 bg-zinc-800/30">
                {searchResults.map((result) => (
                  <li key={result.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded border border-zinc-600/40 bg-zinc-700/40 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                        {result.entity_type}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">{result.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{result.snippet}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="mt-3 text-xs text-zinc-500">No results found for "{searchQuery}".</p>
            )}
          </section>
        </div>
      </div>

      <div className="text-center">
        <a href="#/" className="inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100">
          ← Back to home
        </a>
      </div>
    </PageLayout>
  )
}
