import { useCallback, useEffect, useRef, useState } from 'react'
import { type Account, listAccounts } from '../api/accounts'
import {
  type Contact,
  type ListContactsParams,
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from '../api/contacts'
import { PageLayout } from './PageLayout'

const LIFECYCLE_STAGES = ['lead', 'prospect', 'customer', 'churned', 'evangelist'] as const
type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

const STAGE_STYLE: Record<LifecycleStage, string> = {
  lead: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
  prospect: 'border-blue-400/40 bg-blue-500/15 text-blue-300',
  customer: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  churned: 'border-red-400/40 bg-red-500/15 text-red-300',
  evangelist: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
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
  const style = STAGE_STYLE[stage as LifecycleStage] ?? 'border-zinc-500/40 bg-zinc-700/40 text-zinc-400'
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {stage}
    </span>
  )
}

interface EditDraft {
  first_name: string
  last_name: string
  email: string
  phone: string
  account_id: string
  lifecycle_stage: string
}

export function ContactsPage() {
  const token = useRef(readStoredToken())
  const isAuthed = token.current.length > 0

  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Available accounts for linking
  const [accounts, setAccounts] = useState<Account[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAccountId, setNewAccountId] = useState('')
  const [newStage, setNewStage] = useState<string>('lead')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    account_id: '',
    lifecycle_stage: '',
  })
  const [saving, setSaving] = useState(false)

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load accounts for the account selector
  useEffect(() => {
    if (!isAuthed) return
    listAccounts(token.current, { limit: 100 })
      .then((res) => setAccounts(res.data))
      .catch(() => {/* fail silently — account linking still works via text entry */})
  }, [isAuthed])

  const load = useCallback(
    async (params: ListContactsParams = {}) => {
      if (!isAuthed) return
      setLoading(true)
      setError('')
      try {
        const merged: ListContactsParams = {
          limit: 100,
          ...params,
          ...(stageFilter !== 'all' ? { lifecycle_stage: stageFilter } : {}),
          ...(accountFilter ? { account_id: accountFilter } : {}),
          ...(search.trim() ? { q: search.trim() } : {}),
        }
        const res = await listContacts(token.current, merged)
        setContacts(res.data)
        setTotal(res.total)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load contacts')
      } finally {
        setLoading(false)
      }
    },
    [isAuthed, stageFilter, accountFilter, search],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    if (!newFirst.trim()) { setCreateError('First name is required'); return }
    if (!newLast.trim()) { setCreateError('Last name is required'); return }
    setCreating(true)
    setCreateError('')
    try {
      const contact = await createContact(token.current, {
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        account_id: newAccountId || undefined,
        lifecycle_stage: newStage,
      })
      setContacts((prev) => [contact, ...prev])
      setTotal((n) => n + 1)
      setNewFirst('')
      setNewLast('')
      setNewEmail('')
      setNewPhone('')
      setNewAccountId('')
      setNewStage('lead')
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create contact')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id)
    setEditDraft({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      account_id: contact.account_id ?? '',
      lifecycle_stage: contact.lifecycle_stage,
    })
  }

  const handleSave = async () => {
    if (!editingId) return
    if (!editDraft.first_name.trim() || !editDraft.last_name.trim()) return
    setSaving(true)
    try {
      const updated = await updateContact(token.current, editingId, {
        first_name: editDraft.first_name.trim(),
        last_name: editDraft.last_name.trim(),
        email: editDraft.email.trim() || '',
        phone: editDraft.phone.trim() || '',
        account_id: editDraft.account_id || '',
        lifecycle_stage: editDraft.lifecycle_stage,
      })
      setContacts((prev) => prev.map((c) => (c.id === editingId ? updated : c)))
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
      await deleteContact(token.current, id)
      setContacts((prev) => prev.filter((c) => c.id !== id))
      setTotal((n) => n - 1)
      setDeleteConfirmId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const accountName = (id: string | null) => {
    if (!id) return null
    return accounts.find((a) => a.id === id)?.name ?? id.slice(0, 8) + '…'
  }

  if (!isAuthed) {
    return (
      <PageLayout title="Contacts">
        <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="text-sm text-zinc-400">Sign in on the home page to manage contacts.</p>
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
    <PageLayout title="Contacts">
      {/* Toolbar */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30"
          />
          {accounts.length > 0 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-400/60"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            {showCreate ? '✕ Cancel' : '+ New Contact'}
          </button>
        </div>

        {/* Stage filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['all', ...LIFECYCLE_STAGES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStageFilter(s)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                stageFilter === s
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                  : 'border-zinc-600/50 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500/60 hover:text-zinc-200'
              }`}
            >
              {s === 'all' ? `All (${total})` : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mt-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                type="text"
                placeholder="First name *"
                value={newFirst}
                onChange={(e) => setNewFirst(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="text"
                placeholder="Last name *"
                value={newLast}
                onChange={(e) => setNewLast(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              <select
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-400/60"
              >
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-400/60"
              >
                {LIFECYCLE_STAGES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Contact'}
              </button>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
            </div>
          </div>
        )}
      </section>

      {/* Error banner */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Contact list */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {search || stageFilter !== 'all' || accountFilter
              ? 'No contacts match your filters.'
              : 'No contacts yet. Create one above.'}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {contacts.map((contact) => {
              const isEditing = editingId === contact.id
              const isDeleteConfirm = deleteConfirmId === contact.id
              const linkedAccount = accountName(contact.account_id)

              return (
                <li key={contact.id} className="group px-5 py-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <input
                          autoFocus
                          type="text"
                          value={editDraft.first_name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, first_name: e.target.value }))}
                          placeholder="First name"
                          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                        />
                        <input
                          type="text"
                          value={editDraft.last_name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, last_name: e.target.value }))}
                          placeholder="Last name"
                          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                        />
                        <input
                          type="email"
                          value={editDraft.email}
                          onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                          placeholder="Email"
                          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                        />
                        <input
                          type="tel"
                          value={editDraft.phone}
                          onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                          placeholder="Phone"
                          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                        />
                        <select
                          value={editDraft.account_id}
                          onChange={(e) => setEditDraft((d) => ({ ...d, account_id: e.target.value }))}
                          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-2 py-1.5 text-sm text-zinc-300 outline-none"
                        >
                          <option value="">No account</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                        <select
                          value={editDraft.lifecycle_stage}
                          onChange={(e) => setEditDraft((d) => ({ ...d, lifecycle_stage: e.target.value }))}
                          className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-2 py-1.5 text-sm text-zinc-300 outline-none"
                        >
                          {LIFECYCLE_STAGES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
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
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-zinc-100">
                            {contact.first_name} {contact.last_name}
                          </span>
                          <StageBadge stage={contact.lifecycle_stage} />
                          {linkedAccount && (
                            <span className="rounded border border-zinc-600/40 bg-zinc-800/50 px-1.5 py-px text-[10px] text-zinc-400">
                              {linkedAccount}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-zinc-500">
                          {contact.email && <span>{contact.email}</span>}
                          {contact.phone && <span>{contact.phone}</span>}
                          <span>Added {contact.created_at.slice(0, 10)}</span>
                        </div>
                      </div>

                      {isDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(contact.id)}
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
                            onClick={() => startEdit(contact)}
                            className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(contact.id)}
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
