import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Account,
  type ListAccountsParams,
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from '../api/accounts'
import { PageLayout } from './PageLayout'

const STATUSES = ['active', 'inactive', 'churned'] as const
type AccountStatus = (typeof STATUSES)[number]

const STATUS_STYLE: Record<AccountStatus, string> = {
  active: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  inactive: 'border-zinc-500/40 bg-zinc-700/40 text-zinc-400',
  churned: 'border-red-400/40 bg-red-500/15 text-red-300',
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
  const style = STATUS_STYLE[status as AccountStatus] ?? 'border-zinc-500/40 bg-zinc-700/40 text-zinc-400'
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {status}
    </span>
  )
}

interface EditDraft {
  name: string
  domain: string
  status: string
}

export function AccountsPage() {
  const token = useRef(readStoredToken())
  const isAuthed = token.current.length > 0

  const [accounts, setAccounts] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [newStatus, setNewStatus] = useState<string>('active')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', domain: '', status: '' })
  const [saving, setSaving] = useState(false)

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(
    async (params: ListAccountsParams = {}) => {
      if (!isAuthed) return
      setLoading(true)
      setError('')
      try {
        const merged: ListAccountsParams = {
          limit: 100,
          ...params,
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(search.trim() ? { q: search.trim() } : {}),
        }
        const res = await listAccounts(token.current, merged)
        setAccounts(res.data)
        setTotal(res.total)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load accounts')
      } finally {
        setLoading(false)
      }
    },
    [isAuthed, statusFilter, search],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    if (!newName.trim()) {
      setCreateError('Name is required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const account = await createAccount(token.current, {
        name: newName.trim(),
        domain: newDomain.trim() || undefined,
        status: newStatus,
      })
      setAccounts((prev) => [account, ...prev])
      setTotal((n) => n + 1)
      setNewName('')
      setNewDomain('')
      setNewStatus('active')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (account: Account) => {
    setEditingId(account.id)
    setEditDraft({ name: account.name, domain: account.domain ?? '', status: account.status })
  }

  const handleSave = async () => {
    if (!editingId) return
    if (!editDraft.name.trim()) return
    setSaving(true)
    try {
      const updated = await updateAccount(token.current, editingId, {
        name: editDraft.name.trim(),
        domain: editDraft.domain.trim() || '',
        status: editDraft.status,
      })
      setAccounts((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
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
      await deleteAccount(token.current, id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      setTotal((n) => n - 1)
      setDeleteConfirmId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAuthed) {
    return (
      <PageLayout title="Accounts">
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="text-sm text-zinc-400">Sign in on the home page to manage accounts.</p>
          <a
            href="#/"
            className="mt-4 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/60 hover:text-zinc-100"
          >
            ← Go to home
          </a>
        </section>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Accounts">
      {/* Toolbar */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30"
          />
          <div className="flex gap-1.5">
            {['all', ...STATUSES].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === s
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                    : 'border-zinc-600/50 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500/60 hover:text-zinc-200'
                }`}
              >
                {s === 'all' ? `All (${total})` : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            {showCreate ? '✕ Cancel' : '+ New Account'}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mt-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4">
            <form onSubmit={(e) => { e.preventDefault(); void handleCreate() }} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                type="text"
                name="organization"
                autoComplete="organization"
                placeholder="Company name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                name="domain"
                autoComplete="off"
                placeholder="Domain (e.g. acme.com)"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-400/60"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
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

      {/* Error banner */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Account list */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {search || statusFilter !== 'all' ? 'No accounts match your filters.' : 'No accounts yet. Create one above.'}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {accounts.map((account) => {
              const isEditing = editingId === account.id
              const isDeleteConfirm = deleteConfirmId === account.id

              return (
                <li key={account.id} className="group px-5 py-4">
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
                      <input
                        autoFocus
                        type="text"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setEditingId(null) }}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <input
                        type="text"
                        placeholder="Domain"
                        value={editDraft.domain}
                        onChange={(e) => setEditDraft((d) => ({ ...d, domain: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                      />
                      <select
                        value={editDraft.status}
                        onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value }))}
                        className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-2 py-1.5 text-sm text-zinc-300 outline-none"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
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
                          <span className="font-medium text-zinc-100">{account.name}</span>
                          <StatusBadge status={account.status} />
                          {account.domain && (
                            <span className="text-xs text-zinc-500">{account.domain}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          Created {account.created_at.slice(0, 10)}
                        </p>
                      </div>

                      {isDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(account.id)}
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
                            onClick={() => startEdit(account)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(account.id)}
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
        <a
          href="#/"
          className="inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          ← Back to home
        </a>
      </div>
    </PageLayout>
  )
}
