import { useState, useEffect, useCallback, useRef } from 'react'
import { PageLayout } from './PageLayout'
import { resolveAdminToken } from '../config'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY      = import.meta.env.VITE_ADMIN_KEY                  ?? 'dev-admin'
const CONTACTS_URL   = (import.meta.env.VITE_CONTACTS_API_BASE_URL      ?? '').replace(/\/$/, '')
const ACCOUNTS_URL   = (import.meta.env.VITE_ACCOUNTS_API_BASE_URL      ?? '').replace(/\/$/, '')
const OPPS_URL       = (import.meta.env.VITE_OPPORTUNITIES_API_BASE_URL  ?? '').replace(/\/$/, '')
const ACTIVITIES_URL = (import.meta.env.VITE_ACTIVITIES_API_BASE_URL     ?? '').replace(/\/$/, '')
const STREAM_URL     = (import.meta.env.VITE_EVENT_STREAM_URL            ?? '').replace(/\/$/, '')
const PROJECTS_URL   = (import.meta.env.VITE_PROJECTS_API_BASE_URL       ?? '').replace(/\/$/, '')
const SPEND_URL      = (import.meta.env.VITE_SPEND_API_BASE_URL          ?? '').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Contact {
  id: string; account_id?: string; first_name: string; last_name: string
  email?: string; phone?: string; lifecycle_stage: string
  created_at: string; updated_at: string
}
interface Account {
  id: string; name: string; domain?: string; status: string
  created_at: string; updated_at: string
}
interface Opportunity {
  id: string; account_id: string; name: string; stage: string
  amount: number; close_date?: string; created_at: string; updated_at: string
}
interface Activity {
  id: string; account_id?: string; contact_id?: string
  activity_type: string; subject: string; notes?: string
  due_at?: string; completed: boolean; created_at: string; updated_at: string
}
interface StreamEvent {
  id: string; source: string; type: string
  payload?: unknown; timestamp: string
}
interface PagedResponse<T> { data: T[]; total: number; limit: number; offset: number }

interface Project {
  id: string; account_id: string; client_user_id: string | null
  name: string; description: string | null; status: string
  start_date: string | null; target_end_date: string | null
  created_at: string; updated_at: string
}
interface Milestone {
  id: string; project_id: string; name: string; description: string | null
  due_date: string | null; status: string; sort_order: number
  created_at: string; updated_at: string
}
interface Deliverable {
  id: string; milestone_id: string; name: string
  description: string | null; status: string
}
interface PMessage {
  id: string; project_id: string; author_id: string
  author_role: string; body: string; created_at: string
}

interface SpendRecord {
  id: string; platform: string; date: string; amount_usd: number
  granularity: string; service_label?: string; source: string
  notes?: string; created_at: string; updated_at: string
}
interface SpendSummary {
  total_usd: number
  by_platform: { platform: string; total_usd: number }[]
  by_month: { month: string; total_usd: number }[]
}
interface SpendListResponse { data: SpendRecord[]; total: number; limit: number; offset: number }
interface SyncResult { platform: string; records_imported: number; records_skipped: number; errors: string[] }

type Tab = 'leads' | 'contacts' | 'accounts' | 'opportunities' | 'activities' | 'live-feed' | 'projects' | 'spend'
type ModalMode<T> = null | { mode: 'create' } | { mode: 'edit'; record: T } | { mode: 'delete'; id: string; label: string }

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolveAdminToken()}`, ...opts.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------
const INPUT_CLS = 'w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30'

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </div>
  )
}

const NO_TOKEN_MSG = 'No auth token — set VITE_ADMIN_JWT or log in via the portal.'

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const isNoToken = message === NO_TOKEN_MSG
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
      <p className="text-sm font-medium text-red-300">Error</p>
      <p className="mt-1 font-mono text-xs text-red-400">{message}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onRetry} className="btn-neutral px-3 py-1.5 text-xs">Retry</button>
        {isNoToken && (
          <a href="#/portal/login" className="btn-accent px-3 py-1.5 text-xs">Log in via portal</a>
        )}
      </div>
    </div>
  )
}

function EmptyState({ label, onRefresh }: { label: string; onRefresh: () => void }) {
  return (
    <div className="py-8 text-center text-sm text-zinc-500">
      No {label} found.{' '}
      <button type="button" onClick={onRefresh} className="text-amber-400 hover:underline">Refresh</button>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div className="forge-panel surface-card-strong w-full max-w-md rounded-3xl p-6 shadow-2xl shadow-black/60" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}

function SaveError({ message }: { message: string }) {
  return <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">{message}</p>
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-3 py-2">
      <div className="flex gap-1">
        <button type="button" onClick={onEdit} title="Edit" className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors">✏</button>
        <button type="button" onClick={onDelete} title="Delete" className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-red-500/20 hover:text-red-300 transition-colors">✕</button>
      </div>
    </td>
  )
}

function DeleteModal({ label, onConfirm, onClose, saving, error }: {
  label: string; onConfirm: () => void; onClose: () => void; saving: boolean; error: string | null
}) {
  return (
    <Modal title="Confirm delete" onClose={onClose}>
      <p className="text-sm text-zinc-300">Delete <span className="font-semibold text-white">{label}</span>? This cannot be undone.</p>
      {error && <SaveError message={error} />}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">
          {saving ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------
function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === ADMIN_KEY) { sessionStorage.setItem('admin-authed', '1'); onAuth() }
    else setError(true)
  }
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="forge-panel surface-card-strong w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/50">
        <h2 className="text-lg font-bold text-white">Admin access</h2>
        <p className="mt-1 text-sm text-zinc-400">Enter your admin key to continue.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input type="password" autoComplete="off" value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            placeholder="Admin key" className={INPUT_CLS} />
          {error && <p className="text-xs text-red-400">Incorrect key.</p>}
          <button type="submit" className="btn-accent w-full py-2.5 text-sm">Unlock</button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage / status color maps
// ---------------------------------------------------------------------------
const LIFECYCLE_COLOR: Record<string, string> = {
  lead:       'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  prospect:   'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  customer:   'bg-green-500/15 text-green-300 ring-green-500/30',
  churned:    'bg-red-500/15 text-red-300 ring-red-500/30',
  evangelist: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
}
const STATUS_COLOR: Record<string, string> = {
  active:   'bg-green-500/15 text-green-300 ring-green-500/30',
  inactive: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  churned:  'bg-red-500/15 text-red-300 ring-red-500/30',
}
const STAGE_COLOR: Record<string, string> = {
  qualification: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  proposal:      'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  negotiation:   'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  'closed-won':  'bg-green-500/15 text-green-300 ring-green-500/30',
  'closed-lost': 'bg-red-500/15 text-red-300 ring-red-500/30',
}
const ACTIVITY_COLOR: Record<string, string> = {
  email:   'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  call:    'bg-green-500/15 text-green-300 ring-green-500/30',
  meeting: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  task:    'bg-amber-500/15 text-amber-300 ring-amber-500/30',
}
const FALLBACK_BADGE = 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30'

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${map[value] ?? FALLBACK_BADGE}`}>
      {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ContactsTab (shared with LeadsTab via stageFilter prop)
// ---------------------------------------------------------------------------
function ContactsTab({ stageFilter }: { stageFilter?: string }) {
  const [rows, setRows]       = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [modal, setModal]     = useState<ModalMode<Contact>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', lifecycle_stage: stageFilter ?? 'lead', account_id: '' })

  const load = useCallback(async () => {
    if (!CONTACTS_URL) { setError('VITE_CONTACTS_API_BASE_URL not configured.'); return }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try {
      const qs = stageFilter ? `lifecycle_stage=${stageFilter}&limit=100` : 'limit=100'
      const body = await api<PagedResponse<Contact>>(`${CONTACTS_URL}/api/v1/contacts?${qs}`)
      setRows(body.data)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally     { setLoading(false) }
  }, [stageFilter])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setForm({ first_name: '', last_name: '', email: '', phone: '', lifecycle_stage: stageFilter ?? 'lead', account_id: '' })
    setSaveErr(null); setModal({ mode: 'create' })
  }
  function openEdit(c: Contact) {
    setForm({ first_name: c.first_name, last_name: c.last_name, email: c.email ?? '', phone: c.phone ?? '', lifecycle_stage: c.lifecycle_stage, account_id: c.account_id ?? '' })
    setSaveErr(null); setModal({ mode: 'edit', record: c })
  }
  function openDelete(c: Contact) { setSaveErr(null); setModal({ mode: 'delete', id: c.id, label: `${c.first_name} ${c.last_name}` }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, lifecycle_stage: form.lifecycle_stage, account_id: form.account_id.trim() || undefined }
    try {
      if (modal?.mode === 'create')        await api(`${CONTACTS_URL}/api/v1/contacts`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${CONTACTS_URL}/api/v1/contacts/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    try { await api(`${CONTACTS_URL}/api/v1/contacts/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  const entity = stageFilter === 'lead' ? 'lead' : 'contact'

  return (
    <>
      {loading && <Spinner label={`Loading ${entity}s…`} />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && <EmptyState label={`${entity}s`} onRefresh={load} />}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-zinc-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New {entity}</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    <td className="px-3 py-2 text-zinc-200">{c.first_name} {c.last_name}</td>
                    <td className="px-3 py-2 text-zinc-300">{c.email ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-400">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2"><Badge value={c.lifecycle_stage} map={LIFECYCLE_COLOR} /></td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{c.created_at.slice(0, 10)}</td>
                    <ActionButtons onEdit={() => openEdit(c)} onDelete={() => openDelete(c)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New {entity}</button>
        </div>
      )}

      {/* Create / Edit modal */}
      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? `New ${entity}` : `Edit ${entity}`} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name *">
                <input className={INPUT_CLS} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
              </FormField>
              <FormField label="Last name *">
                <input className={INPUT_CLS} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
              </FormField>
            </div>
            <FormField label="Email">
              <input type="email" className={INPUT_CLS} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </FormField>
            <FormField label="Phone">
              <input className={INPUT_CLS} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </FormField>
            <FormField label="Lifecycle stage">
              <select className={INPUT_CLS} value={form.lifecycle_stage} onChange={e => setForm(f => ({ ...f, lifecycle_stage: e.target.value }))}>
                {['lead','prospect','customer','churned','evangelist'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Account ID (optional)">
              <input className={INPUT_CLS} placeholder="UUID of linked account" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} />
            </FormField>
            {saveErr && <SaveError message={saveErr} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={handleDelete} onClose={() => setModal(null)} saving={saving} error={saveErr} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// AccountsTab
// ---------------------------------------------------------------------------
function AccountsTab() {
  const [rows, setRows]       = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [modal, setModal]     = useState<ModalMode<Account>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [form, setForm]       = useState({ name: '', domain: '', status: 'active' })

  const load = useCallback(async () => {
    if (!ACCOUNTS_URL) { setError('VITE_ACCOUNTS_API_BASE_URL not configured.'); return }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try {
      const body = await api<PagedResponse<Account>>(`${ACCOUNTS_URL}/api/v1/accounts?limit=100`)
      setRows(body.data)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally     { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setForm({ name: '', domain: '', status: 'active' }); setSaveErr(null); setModal({ mode: 'create' }) }
  function openEdit(a: Account) { setForm({ name: a.name, domain: a.domain ?? '', status: a.status }); setSaveErr(null); setModal({ mode: 'edit', record: a }) }
  function openDelete(a: Account) { setSaveErr(null); setModal({ mode: 'delete', id: a.id, label: a.name }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { name: form.name.trim(), domain: form.domain.trim() || undefined, status: form.status }
    try {
      if (modal?.mode === 'create')        await api(`${ACCOUNTS_URL}/api/v1/accounts`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${ACCOUNTS_URL}/api/v1/accounts/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    try { await api(`${ACCOUNTS_URL}/api/v1/accounts/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  return (
    <>
      {loading && <Spinner label="Loading accounts…" />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && <EmptyState label="accounts" onRefresh={load} />}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-zinc-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New account</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[500px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    <td className="px-3 py-2 text-zinc-200">{a.name}</td>
                    <td className="px-3 py-2 text-zinc-300">{a.domain ?? '—'}</td>
                    <td className="px-3 py-2"><Badge value={a.status} map={STATUS_COLOR} /></td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{a.created_at.slice(0, 10)}</td>
                    <ActionButtons onEdit={() => openEdit(a)} onDelete={() => openDelete(a)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New account</button>
        </div>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'New account' : 'Edit account'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <FormField label="Name *">
              <input className={INPUT_CLS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="Domain">
              <input className={INPUT_CLS} placeholder="example.com" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} />
            </FormField>
            <FormField label="Status">
              <select className={INPUT_CLS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['active','inactive','churned'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            {saveErr && <SaveError message={saveErr} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={handleDelete} onClose={() => setModal(null)} saving={saving} error={saveErr} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// OpportunitiesTab
// ---------------------------------------------------------------------------
function OpportunitiesTab() {
  const [rows, setRows]       = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [modal, setModal]     = useState<ModalMode<Opportunity>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [form, setForm]       = useState({ name: '', account_id: '', stage: 'qualification', amount: '', close_date: '' })

  const load = useCallback(async () => {
    if (!OPPS_URL)  { setError('VITE_OPPORTUNITIES_API_BASE_URL not configured.'); return }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try   { setRows(await api<Opportunity[]>(`${OPPS_URL}/api/v1/opportunities`)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setForm({ name: '', account_id: '', stage: 'qualification', amount: '', close_date: '' }); setSaveErr(null); setModal({ mode: 'create' }) }
  function openEdit(o: Opportunity) {
    setForm({ name: o.name, account_id: o.account_id, stage: o.stage, amount: o.amount > 0 ? String(o.amount) : '', close_date: o.close_date?.slice(0, 10) ?? '' })
    setSaveErr(null); setModal({ mode: 'edit', record: o })
  }
  function openDelete(o: Opportunity) { setSaveErr(null); setModal({ mode: 'delete', id: o.id, label: o.name }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { name: form.name.trim(), account_id: form.account_id.trim(), stage: form.stage, amount: form.amount ? parseFloat(form.amount) : undefined, close_date: form.close_date || undefined }
    try {
      if (modal?.mode === 'create')        await api(`${OPPS_URL}/api/v1/opportunities`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${OPPS_URL}/api/v1/opportunities/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    try { await api(`${OPPS_URL}/api/v1/opportunities/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  const totalValue = rows.reduce((s, o) => s + o.amount, 0)

  return (
    <>
      {loading && <Spinner label="Loading opportunities…" />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && <EmptyState label="opportunities" onRefresh={load} />}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-xs text-zinc-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-zinc-500">Total: <span className="text-zinc-300">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span></p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New opportunity</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[600px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Close date</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o, i) => (
                  <tr key={o.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    <td className="px-3 py-2 text-zinc-200">{o.name}</td>
                    <td className="px-3 py-2"><Badge value={o.stage} map={STAGE_COLOR} /></td>
                    <td className="px-3 py-2 text-zinc-300">{o.amount > 0 ? `$${o.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}</td>
                    <td className="px-3 py-2 font-mono text-zinc-400">{o.close_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{o.created_at.slice(0, 10)}</td>
                    <ActionButtons onEdit={() => openEdit(o)} onDelete={() => openDelete(o)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New opportunity</button>
        </div>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'New opportunity' : 'Edit opportunity'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <FormField label="Name *">
              <input className={INPUT_CLS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="Account ID *">
              <input className={INPUT_CLS} placeholder="UUID of linked account" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Stage">
                <select className={INPUT_CLS} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  {['qualification','proposal','negotiation','closed-won','closed-lost'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Amount ($)">
                <input type="number" min="0" step="0.01" className={INPUT_CLS} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Close date">
              <input type="date" className={INPUT_CLS} value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
            </FormField>
            {saveErr && <SaveError message={saveErr} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={handleDelete} onClose={() => setModal(null)} saving={saving} error={saveErr} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// ActivitiesTab
// ---------------------------------------------------------------------------
function ActivitiesTab() {
  const [rows, setRows]       = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [modal, setModal]     = useState<ModalMode<Activity>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [form, setForm]       = useState({ activity_type: 'email', subject: '', account_id: '', contact_id: '', notes: '', due_at: '', completed: false })

  const load = useCallback(async () => {
    if (!ACTIVITIES_URL) { setError('VITE_ACTIVITIES_API_BASE_URL not configured.'); return }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try   { setRows(await api<Activity[]>(`${ACTIVITIES_URL}/api/v1/activities`)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setForm({ activity_type: 'email', subject: '', account_id: '', contact_id: '', notes: '', due_at: '', completed: false }); setSaveErr(null); setModal({ mode: 'create' }) }
  function openEdit(a: Activity) {
    setForm({ activity_type: a.activity_type, subject: a.subject, account_id: a.account_id ?? '', contact_id: a.contact_id ?? '', notes: a.notes ?? '', due_at: a.due_at ? a.due_at.slice(0, 16) : '', completed: a.completed })
    setSaveErr(null); setModal({ mode: 'edit', record: a })
  }
  function openDelete(a: Activity) { setSaveErr(null); setModal({ mode: 'delete', id: a.id, label: a.subject }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { activity_type: form.activity_type, subject: form.subject.trim(), account_id: form.account_id.trim() || undefined, contact_id: form.contact_id.trim() || undefined, notes: form.notes.trim() || undefined, due_at: form.due_at || undefined, ...(modal?.mode === 'edit' ? { completed: form.completed } : {}) }
    try {
      if (modal?.mode === 'create')        await api(`${ACTIVITIES_URL}/api/v1/activities`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${ACTIVITIES_URL}/api/v1/activities/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    try { await api(`${ACTIVITIES_URL}/api/v1/activities/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  return (
    <>
      {loading && <Spinner label="Loading activities…" />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && <EmptyState label="activities" onRefresh={load} />}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-zinc-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New activity</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[580px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Done</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    <td className="max-w-[200px] truncate px-3 py-2 text-zinc-200">{a.subject}</td>
                    <td className="px-3 py-2"><Badge value={a.activity_type} map={ACTIVITY_COLOR} /></td>
                    <td className="px-3 py-2">{a.completed ? <span className="text-green-400">✓</span> : <span className="text-zinc-600">—</span>}</td>
                    <td className="px-3 py-2 font-mono text-zinc-400">{a.due_at?.slice(0, 10) ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{a.created_at.slice(0, 10)}</td>
                    <ActionButtons onEdit={() => openEdit(a)} onDelete={() => openDelete(a)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New activity</button>
        </div>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'New activity' : 'Edit activity'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type">
                <select className={INPUT_CLS} value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
                  {['email','call','meeting','task'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Due date/time">
                <input type="datetime-local" className={INPUT_CLS} value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Subject *">
              <input className={INPUT_CLS} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Account ID">
                <input className={INPUT_CLS} placeholder="UUID" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} />
              </FormField>
              <FormField label="Contact ID">
                <input className={INPUT_CLS} placeholder="UUID" value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea className={`${INPUT_CLS} resize-none`} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
            {modal.mode === 'edit' && (
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={form.completed} onChange={e => setForm(f => ({ ...f, completed: e.target.checked }))} className="rounded" />
                Mark as completed
              </label>
            )}
            {saveErr && <SaveError message={saveErr} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={handleDelete} onClose={() => setModal(null)} saving={saving} error={saveErr} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// LiveFeedTab
// ---------------------------------------------------------------------------
type FeedStatus = 'no-url' | 'connecting' | 'connected' | 'error'

function LiveFeedTab() {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [status, setStatus] = useState<FeedStatus>('no-url')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!STREAM_URL) { setStatus('no-url'); return }
    setStatus('connecting')

    const es = new EventSource(`${STREAM_URL}/events/stream`)
    esRef.current = es

    es.onopen = () => setStatus('connected')
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as StreamEvent
        setEvents(prev => [event, ...prev].slice(0, 50))
      } catch { /* ignore malformed */ }
    }
    es.onerror = () => setStatus('error')

    return () => { es.close(); esRef.current = null }
  }, [])

  const SOURCE_COLORS: Record<string, string> = {
    'accounts-service':     'bg-blue-500/15 text-blue-300 ring-blue-500/30',
    'contacts-service':     'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    'opportunities-service':'bg-green-500/15 text-green-300 ring-green-500/30',
    'activities-service':   'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  }

  return (
    <div>
      {/* Status bar */}
      <div className="mb-4 flex items-center gap-2">
        {status === 'connected' && <><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs text-green-400">Connected</span></>}
        {status === 'connecting' && <><span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" /><span className="text-xs text-amber-400">Connecting…</span></>}
        {status === 'error'  && <><span className="h-2 w-2 rounded-full bg-red-400" /><span className="text-xs text-red-400">Connection error</span></>}
        {status === 'no-url' && <><span className="h-2 w-2 rounded-full bg-zinc-600" /><span className="text-xs text-zinc-500">VITE_EVENT_STREAM_URL not configured</span></>}
        {events.length > 0 && <span className="ml-auto text-xs text-zinc-500">{events.length} event{events.length !== 1 ? 's' : ''}</span>}
      </div>

      {status === 'no-url' && (
        <div className="py-8 text-center text-xs text-zinc-500">
          Set <code className="rounded bg-zinc-800 px-1 py-0.5">VITE_EVENT_STREAM_URL</code> to enable the live feed.
        </div>
      )}

      {(status === 'connecting' || status === 'connected') && events.length === 0 && (
        <div className="py-8 text-center text-xs text-zinc-500">Waiting for events…</div>
      )}

      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-zinc-700/30 bg-zinc-800/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${SOURCE_COLORS[ev.source] ?? FALLBACK_BADGE}`}>
                  {ev.source}
                </span>
                <span className="text-xs font-medium text-zinc-200">{ev.type}</span>
                <span className="ml-auto font-mono text-[11px] text-zinc-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
              {ev.payload && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">payload</summary>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900/60 p-2 text-[11px] text-zinc-300">{JSON.stringify(ev.payload, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Projects tab
// ---------------------------------------------------------------------------
const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'blocked']
const DELIVERABLE_STATUSES = ['pending', 'in_progress', 'completed', 'blocked']

const STATUS_PILL: Record<string, string> = {
  planning:    'bg-zinc-700/40 text-zinc-300',
  active:      'bg-emerald-500/15 text-emerald-300',
  on_hold:     'bg-amber-500/15 text-amber-300',
  completed:   'bg-blue-500/15 text-blue-300',
  cancelled:   'bg-red-500/15 text-red-300',
  pending:     'bg-zinc-700/40 text-zinc-400',
  in_progress: 'bg-amber-500/15 text-amber-300',
  blocked:     'bg-red-500/15 text-red-400',
}

function ProjectsTab() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [selected, setSelected]   = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [deliverables, setDeliverables] = useState<Record<string, Deliverable[]>>({})
  const [messages, setMessages]   = useState<PMessage[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [reply, setReply]         = useState('')
  const [sending, setSending]     = useState(false)

  // project create form
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', account_id: '', client_user_id: '', status: 'planning', start_date: '', target_end_date: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // milestone create form
  const [showMilestone, setShowMilestone] = useState(false)
  const [msForm, setMsForm] = useState({ name: '', due_date: '', status: 'pending', sort_order: '0', description: '' })

  // deliverable create form
  const [showDeliverable, setShowDeliverable] = useState<string | null>(null) // milestone id
  const [dlForm, setDlForm] = useState({ name: '', description: '', status: 'pending' })

  const loadProjects = useCallback(async () => {
    if (!PROJECTS_URL) return
    setLoading(true); setError(null)
    try {
      const rows = await api<Project[]>(`${PROJECTS_URL}/api/v1/projects`)
      setProjects(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProject = useCallback(async (p: Project) => {
    setSelected(p); setMilestones([]); setDeliverables({}); setMessages([])
    try {
      const [ms, msgs] = await Promise.all([
        api<Milestone[]>(`${PROJECTS_URL}/api/v1/projects/${p.id}/milestones`),
        api<PMessage[]>(`${PROJECTS_URL}/api/v1/projects/${p.id}/messages`),
      ])
      const sorted = [...ms].sort((a, b) => a.sort_order - b.sort_order)
      setMilestones(sorted)
      setMessages(msgs)
      const dlMap: Record<string, Deliverable[]> = {}
      await Promise.all(sorted.map(async (m) => {
        const ds = await api<Deliverable[]>(`${PROJECTS_URL}/api/v1/milestones/${m.id}/deliverables`).catch(() => [])
        dlMap[m.id] = ds
      }))
      setDeliverables(dlMap)
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      await api(`${PROJECTS_URL}/api/v1/projects`, { method: 'POST', body: JSON.stringify({
        name: form.name, account_id: form.account_id,
        client_user_id: form.client_user_id || null,
        status: form.status,
        start_date: form.start_date || null,
        target_end_date: form.target_end_date || null,
        description: form.description || null,
      })})
      setShowCreate(false)
      setForm({ name: '', account_id: '', client_user_id: '', status: 'planning', start_date: '', target_end_date: '', description: '' })
      loadProjects()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createMilestone = async (e: React.FormEvent) => {
    if (!selected) return
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      await api(`${PROJECTS_URL}/api/v1/projects/${selected.id}/milestones`, { method: 'POST', body: JSON.stringify({
        name: msForm.name, status: msForm.status,
        due_date: msForm.due_date || null,
        sort_order: parseInt(msForm.sort_order) || milestones.length,
        description: msForm.description || null,
      })})
      setShowMilestone(false)
      setMsForm({ name: '', due_date: '', status: 'pending', sort_order: '0', description: '' })
      loadProject(selected)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createDeliverable = async (e: React.FormEvent) => {
    if (!showDeliverable) return
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      await api(`${PROJECTS_URL}/api/v1/milestones/${showDeliverable}/deliverables`, { method: 'POST', body: JSON.stringify({
        name: dlForm.name, status: dlForm.status,
        description: dlForm.description || null,
      })})
      setShowDeliverable(null)
      setDlForm({ name: '', description: '', status: 'pending' })
      if (selected) loadProject(selected)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async (e: React.FormEvent) => {
    if (!selected) return
    e.preventDefault()
    const body = reply.trim()
    if (!body) return
    setSending(true)
    try {
      const msg = await api<PMessage>(`${PROJECTS_URL}/api/v1/projects/${selected.id}/messages`, {
        method: 'POST', body: JSON.stringify({ body }),
      })
      setMessages(prev => [...prev, msg])
      setReply('')
    } catch { /* silent */ } finally {
      setSending(false)
    }
  }

  if (!PROJECTS_URL) return (
    <div className="py-6 text-xs text-zinc-500">Set <code className="rounded bg-zinc-800 px-1 py-0.5">VITE_PROJECTS_API_BASE_URL</code> to enable this tab.</div>
  )

  return (
    <div className="space-y-4">
      {/* Project list */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Projects</h3>
        <button className="btn-accent btn-sm" onClick={() => setShowCreate(true)}>+ New project</button>
      </div>

      {loading && <p className="text-xs text-zinc-400">Loading…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {projects.length > 0 && (
        <div className="space-y-1">
          {projects.map(p => (
            <button key={p.id} type="button" onClick={() => loadProject(p)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                selected?.id === p.id
                  ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                  : 'border-zinc-700/40 bg-zinc-800/30 text-zinc-200 hover:bg-zinc-800/60'
              }`}>
              <span className="font-medium">{p.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_PILL[p.status] ?? 'bg-zinc-700/40 text-zinc-400'}`}>
                {p.status.replace('_', ' ')}
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <p className="text-xs text-zinc-500">No projects yet.</p>
      )}

      {/* Selected project detail */}
      {selected && (
        <div className="space-y-4 border-t border-zinc-700/40 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">{selected.name}</h4>
              {selected.client_user_id && (
                <p className="mt-0.5 font-mono text-xs text-zinc-500">client: {selected.client_user_id}</p>
              )}
            </div>
            <button className="btn-neutral btn-sm" onClick={() => setShowMilestone(true)}>+ Milestone</button>
          </div>

          {/* Milestones */}
          {milestones.length === 0 && <p className="text-xs text-zinc-500">No milestones yet.</p>}
          {milestones.map(m => (
            <div key={m.id} className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-200">{m.name}</span>
                <div className="flex items-center gap-2">
                  {m.due_date && <span className="text-xs text-zinc-500">{m.due_date.slice(0, 10)}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_PILL[m.status] ?? 'bg-zinc-700/40 text-zinc-400'}`}>
                    {m.status.replace('_', ' ')}
                  </span>
                  <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => { setShowDeliverable(m.id); setDlForm({ name: '', description: '', status: 'pending' }) }}>
                    + Deliverable
                  </button>
                </div>
              </div>
              {(deliverables[m.id] ?? []).map(d => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900/40 px-3 py-1.5 text-xs">
                  <span className="text-zinc-300">{d.name}</span>
                  <span className={`rounded-full px-2 py-0.5 ${STATUS_PILL[d.status] ?? 'bg-zinc-700/40 text-zinc-400'}`}>
                    {d.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {/* Messages */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Messages</h5>
            {messages.length === 0 && <p className="text-xs text-zinc-500">No messages.</p>}
            {messages.map(m => (
              <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.author_role === 'admin' ? 'bg-amber-500/10 text-amber-100 ml-6' : 'bg-zinc-800/40 text-zinc-200 mr-6'}`}>
                <p>{m.body}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">{m.author_role} · {m.created_at.slice(0, 16).replace('T', ' ')}</p>
              </div>
            ))}
            <form onSubmit={sendReply} className="flex gap-2 pt-1">
              <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to client…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none" />
              <button type="submit" disabled={!reply.trim() || sending} className="btn-accent btn-sm disabled:opacity-50">Send</button>
            </form>
          </div>
        </div>
      )}

      {/* Create project modal */}
      {showCreate && (
        <Modal title="New project" onClose={() => setShowCreate(false)}>
          <form onSubmit={createProject} className="space-y-3">
            <FormField label="Name"><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Account ID"><input required value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} className={INPUT_CLS} placeholder="UUID from accounts-service" /></FormField>
            <FormField label="Client user ID"><input value={form.client_user_id} onChange={e => setForm(f => ({ ...f, client_user_id: e.target.value }))} className={INPUT_CLS} placeholder="auth-service user ID (optional)" /></FormField>
            <FormField label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={INPUT_CLS}>
                {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Start date"><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Target end date"><input type="date" value={form.target_end_date} onChange={e => setForm(f => ({ ...f, target_end_date: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Description"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={INPUT_CLS} /></FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-neutral btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent btn-sm disabled:opacity-50">{saving ? 'Saving…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create milestone modal */}
      {showMilestone && (
        <Modal title="New milestone" onClose={() => setShowMilestone(false)}>
          <form onSubmit={createMilestone} className="space-y-3">
            <FormField label="Name"><input required value={msForm.name} onChange={e => setMsForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Status">
              <select value={msForm.status} onChange={e => setMsForm(f => ({ ...f, status: e.target.value }))} className={INPUT_CLS}>
                {MILESTONE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Due date"><input type="date" value={msForm.due_date} onChange={e => setMsForm(f => ({ ...f, due_date: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Sort order"><input type="number" value={msForm.sort_order} onChange={e => setMsForm(f => ({ ...f, sort_order: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Description"><textarea value={msForm.description} onChange={e => setMsForm(f => ({ ...f, description: e.target.value }))} rows={2} className={INPUT_CLS} /></FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-neutral btn-sm" onClick={() => setShowMilestone(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent btn-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create deliverable modal */}
      {showDeliverable && (
        <Modal title="New deliverable" onClose={() => setShowDeliverable(null)}>
          <form onSubmit={createDeliverable} className="space-y-3">
            <FormField label="Name"><input required value={dlForm.name} onChange={e => setDlForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Status">
              <select value={dlForm.status} onChange={e => setDlForm(f => ({ ...f, status: e.target.value }))} className={INPUT_CLS}>
                {DELIVERABLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Description"><textarea value={dlForm.description} onChange={e => setDlForm(f => ({ ...f, description: e.target.value }))} rows={2} className={INPUT_CLS} /></FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-neutral btn-sm" onClick={() => setShowDeliverable(null)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent btn-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spend tab
// ---------------------------------------------------------------------------
const PLATFORM_COLOR: Record<string, string> = {
  gcp:            'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  flyio:          'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  anthropic:      'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  github_copilot: 'bg-green-500/15 text-green-300 ring-green-500/30',
  github:         'bg-green-500/15 text-green-300 ring-green-500/30',
  aws:            'bg-orange-500/15 text-orange-300 ring-orange-500/30',
}
const SOURCE_COLOR: Record<string, string> = {
  manual:              'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  bigquery:            'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  flyio_graphql:       'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  github_api:          'bg-green-500/15 text-green-300 ring-green-500/30',
  aws_cost_explorer:   'bg-orange-500/15 text-orange-300 ring-orange-500/30',
}
const PLATFORM_LABELS: Record<string, string> = {
  gcp: 'GCP', flyio: 'Fly.io', anthropic: 'Anthropic', github_copilot: 'GitHub Copilot',
  github: 'GitHub', aws: 'AWS',
}

function SpendTab() {
  const [rows, setRows] = useState<SpendRecord[]>([])
  const [summary, setSummary] = useState<SpendSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalMode<SpendRecord>>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Filters
  const [filterPlatform, setFilterPlatform] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    if (!SPEND_URL)  { setError('VITE_SPEND_API_BASE_URL not configured.'); return }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      if (filterPlatform) params.set('platform', filterPlatform)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const [list, sum] = await Promise.all([
        api<SpendListResponse>(`${SPEND_URL}/api/v1/spend?${params}`),
        api<SpendSummary>(`${SPEND_URL}/api/v1/spend/summary?${params}`),
      ])
      setRows(list.data)
      setSummary(sum)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally     { setLoading(false) }
  }, [filterPlatform, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  async function handleSync(platform: 'gcp' | 'flyio' | 'github' | 'aws') {
    setSyncing(platform); setSyncMsg(null)
    try {
      const result = await api<SyncResult>(`${SPEND_URL}/api/v1/spend/sync/${platform}`, { method: 'POST' })
      const parts = [`${result.records_imported} imported, ${result.records_skipped} skipped`]
      if (result.errors.length) parts.push(`${result.errors.length} error(s)`)
      setSyncMsg(`${PLATFORM_LABELS[platform]}: ${parts.join(' — ')}`)
      load()
    } catch (e) { setSyncMsg(`Sync failed: ${e instanceof Error ? e.message : String(e)}`) }
    finally { setSyncing(null) }
  }

  async function handleSave(form: HTMLFormElement) {
    setSaving(true); setSaveError(null)
    const fd = Object.fromEntries(new FormData(form))
    const body: Record<string, unknown> = {
      platform: fd.platform as string,
      date: fd.date as string,
      amount_usd: parseFloat(fd.amount_usd as string) || 0,
      granularity: fd.granularity as string || 'daily',
    }
    if (fd.service_label) body.service_label = fd.service_label
    if (fd.notes) body.notes = fd.notes
    try {
      if (modal?.mode === 'edit') {
        await api(`${SPEND_URL}/api/v1/spend/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await api(`${SPEND_URL}/api/v1/spend`, { method: 'POST', body: JSON.stringify(body) })
      }
      setModal(null); load()
    } catch (e) { setSaveError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setSaving(true); setSaveError(null)
    try {
      await api(`${SPEND_URL}/api/v1/spend/${id}`, { method: 'DELETE' })
      setModal(null); load()
    } catch (e) { setSaveError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner label="Loading spend data…" />
  if (error) return <ErrorBox message={error} onRetry={load} />

  const fmt = (n: number) => `$${n.toFixed(2)}`

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
            <p className="text-xs font-medium text-zinc-500 uppercase">Total</p>
            <p className="mt-1 text-xl font-bold text-white">{fmt(summary.total_usd)}</p>
          </div>
          {summary.by_platform.map(p => (
            <div key={p.platform} className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
              <p className="text-xs font-medium text-zinc-500 uppercase">{PLATFORM_LABELS[p.platform] ?? p.platform}</p>
              <p className="mt-1 text-xl font-bold text-white">{fmt(p.total_usd)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
        <button type="button" onClick={() => handleSync('gcp')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'gcp' ? 'Syncing…' : 'Sync GCP'}
        </button>
        <button type="button" onClick={() => handleSync('flyio')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'flyio' ? 'Syncing…' : 'Sync Fly.io'}
        </button>
        <button type="button" onClick={() => handleSync('github')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'github' ? 'Syncing…' : 'Sync GitHub'}
        </button>
        <button type="button" onClick={() => handleSync('aws')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'aws' ? 'Syncing…' : 'Sync AWS'}
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => { setModal({ mode: 'create' }); setSaveError(null) }} className="btn-accent px-3 py-1.5 text-xs">+ Manual Entry</button>
      </div>

      {syncMsg && (
        <p className="rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300">{syncMsg}</p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
          className={`${INPUT_CLS} w-auto min-w-[130px]`}>
          <option value="">All platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" className={`${INPUT_CLS} w-auto`} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" className={`${INPUT_CLS} w-auto`} />
        {(filterPlatform || dateFrom || dateTo) && (
          <button type="button" onClick={() => { setFilterPlatform(''); setDateFrom(''); setDateTo('') }} className="text-xs text-zinc-400 hover:text-white">Clear</button>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? <EmptyState label="spend records" onRefresh={load} /> : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700/50">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-700/50 bg-zinc-800/30 text-xs text-zinc-500">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Platform</th>
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 ? 'bg-zinc-800/20' : ''}>
                  <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2"><Badge value={PLATFORM_LABELS[r.platform] ?? r.platform} map={Object.fromEntries(Object.entries(PLATFORM_LABELS).map(([k, v]) => [v, PLATFORM_COLOR[k] ?? FALLBACK_BADGE]))} /></td>
                  <td className="px-3 py-2 text-zinc-400">{r.service_label ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-200">{fmt(r.amount_usd)}</td>
                  <td className="px-3 py-2"><Badge value={r.source} map={SOURCE_COLOR} /></td>
                  <td className="px-3 py-2 text-zinc-500 max-w-[200px] truncate">{r.notes ?? ''}</td>
                  {r.source === 'manual' ? (
                    <ActionButtons
                      onEdit={() => { setModal({ mode: 'edit', record: r }); setSaveError(null) }}
                      onDelete={() => { setModal({ mode: 'delete', id: r.id, label: `${r.platform} ${r.date}` }); setSaveError(null) }}
                    />
                  ) : <td className="px-3 py-2" />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly breakdown */}
      {summary && summary.by_month.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-zinc-500 uppercase">Monthly Totals</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {summary.by_month.map(m => (
              <div key={m.month} className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2">
                <p className="text-xs text-zinc-500">{m.month}</p>
                <p className="text-sm font-semibold text-white">{fmt(m.total_usd)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (modal.mode === 'create' || modal.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'Add spend record' : 'Edit spend record'} onClose={() => setModal(null)}>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(e.currentTarget) }}>
            <FormField label="Platform">
              <select name="platform" defaultValue={modal.mode === 'edit' ? modal.record.platform : ''} required className={INPUT_CLS}>
                <option value="" disabled>Select platform</option>
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="Date">
              <input type="date" name="date" defaultValue={modal.mode === 'edit' ? modal.record.date : ''} required className={INPUT_CLS} />
            </FormField>
            <FormField label="Amount (USD)">
              <input type="number" name="amount_usd" step="0.01" min="0" defaultValue={modal.mode === 'edit' ? modal.record.amount_usd : ''} required className={INPUT_CLS} />
            </FormField>
            <FormField label="Granularity">
              <select name="granularity" defaultValue={modal.mode === 'edit' ? modal.record.granularity : 'daily'} className={INPUT_CLS}>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </FormField>
            <FormField label="Service label (optional)">
              <input type="text" name="service_label" defaultValue={modal.mode === 'edit' ? modal.record.service_label ?? '' : ''} placeholder="e.g. Cloud Run" className={INPUT_CLS} />
            </FormField>
            <FormField label="Notes (optional)">
              <input type="text" name="notes" defaultValue={modal.mode === 'edit' ? modal.record.notes ?? '' : ''} className={INPUT_CLS} />
            </FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={() => handleDelete(modal.id)} onClose={() => setModal(null)} saving={saving} error={saveError} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const TABS: { id: Tab; label: string }[] = [
  { id: 'leads',         label: 'Leads' },
  { id: 'contacts',      label: 'Contacts' },
  { id: 'accounts',      label: 'Accounts' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'activities',    label: 'Activities' },
  { id: 'live-feed',     label: 'Live Feed' },
  { id: 'projects',      label: 'Projects' },
  { id: 'spend',          label: 'Spend' },
]

export function CrmAdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [tab, setTab] = useState<Tab>('leads')

  if (!authed) return (
    <PageLayout><AuthGate onAuth={() => setAuthed(true)} /></PageLayout>
  )

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">CRM — Admin</h1>
            <p className="mt-1 text-sm text-zinc-400">Live data from the microservices. Requires service URLs configured and either <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">VITE_ADMIN_JWT</code> set or an active portal login.</p>
          </div>
          <a href="#/admin" className="btn-neutral px-3 py-1.5 text-xs">← Admin</a>
        </div>

        {/* Scrollable tab bar */}
        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-max gap-1 rounded-xl bg-zinc-800/50 p-1">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  tab === t.id ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab content */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        {tab === 'leads'         && <ContactsTab stageFilter="lead" />}
        {tab === 'contacts'      && <ContactsTab />}
        {tab === 'accounts'      && <AccountsTab />}
        {tab === 'opportunities' && <OpportunitiesTab />}
        {tab === 'activities'    && <ActivitiesTab />}
        {tab === 'live-feed'     && <LiveFeedTab />}
        {tab === 'projects'      && <ProjectsTab />}
        {tab === 'spend'         && <SpendTab />}
      </section>
    </PageLayout>
  )
}
