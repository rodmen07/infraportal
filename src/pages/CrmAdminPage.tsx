import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY     = import.meta.env.VITE_ADMIN_KEY             ?? 'dev-admin'
const CONTACTS_URL  = (import.meta.env.VITE_CONTACTS_API_BASE_URL     ?? '').replace(/\/$/, '')
const ACCOUNTS_URL  = (import.meta.env.VITE_ACCOUNTS_API_BASE_URL     ?? '').replace(/\/$/, '')
const OPPS_URL      = (import.meta.env.VITE_OPPORTUNITIES_API_BASE_URL ?? '').replace(/\/$/, '')
const ADMIN_JWT     = import.meta.env.VITE_ADMIN_JWT ?? ''

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Contact {
  id: string
  account_id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  lifecycle_stage: string
  created_at: string
  updated_at: string
}

interface Account {
  id: string
  name: string
  domain?: string
  status: string
  created_at: string
  updated_at: string
}

interface Opportunity {
  id: string
  account_id: string
  name: string
  stage: string
  amount: number
  close_date?: string
  created_at: string
  updated_at: string
}

interface PagedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

type Tab = 'leads' | 'contacts' | 'accounts' | 'opportunities'

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------
function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === ADMIN_KEY) {
      sessionStorage.setItem('admin-authed', '1')
      onAuth()
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="forge-panel surface-card-strong w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/50">
        <h2 className="text-lg font-bold text-white">Admin access</h2>
        <p className="mt-1 text-sm text-zinc-400">Enter your admin key to continue.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="password"
            autoComplete="off"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            placeholder="Admin key"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
          />
          {error && <p className="text-xs text-red-400">Incorrect key.</p>}
          <button type="submit" className="btn-accent w-full py-2.5 text-sm">
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------
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

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
      <p className="text-sm font-medium text-red-300">Failed to load data</p>
      <p className="mt-1 font-mono text-xs text-red-400">{message}</p>
      <button type="button" onClick={onRetry} className="btn-neutral mt-3 px-3 py-1.5 text-xs">
        Retry
      </button>
    </div>
  )
}

function EmptyState({ label, onRefresh }: { label: string; onRefresh: () => void }) {
  return (
    <div className="py-8 text-center text-sm text-zinc-500">
      No {label} found.{' '}
      <button type="button" onClick={onRefresh} className="text-amber-400 hover:underline">
        Refresh
      </button>
    </div>
  )
}

function TableHeader({ count, onRefresh }: { count: number; onRefresh: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="text-xs text-zinc-500">{count} record{count !== 1 ? 's' : ''}</p>
      <button type="button" onClick={onRefresh} className="btn-neutral px-3 py-1.5 text-xs">
        Refresh
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leads tab — contacts with lifecycle_stage=lead
// ---------------------------------------------------------------------------
function LeadsTab() {
  const [rows, setRows]     = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!CONTACTS_URL) { setError('VITE_CONTACTS_API_BASE_URL is not configured.'); return }
    if (!ADMIN_JWT)    { setError('VITE_ADMIN_JWT is not configured.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${CONTACTS_URL}/api/v1/contacts?lifecycle_stage=lead&limit=100`, {
        headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
      const body = await res.json() as PagedResponse<Contact>
      setRows(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <Spinner label="Loading leads…" />
  if (error)   return <ErrorBox message={error} onRetry={fetch_} />
  if (rows.length === 0) return <EmptyState label="leads" onRefresh={fetch_} />

  return (
    <div>
      <TableHeader count={rows.length} onRefresh={fetch_} />
      <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
        <table className="w-full min-w-[600px] text-xs">
          <thead>
            <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                <td className="px-3 py-2 text-zinc-200">{c.first_name} {c.last_name}</td>
                <td className="px-3 py-2 text-zinc-300">{c.email ?? '—'}</td>
                <td className="px-3 py-2 text-zinc-400">{c.phone ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30">
                    {c.lifecycle_stage}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-zinc-500">{c.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contacts tab — all contacts from contacts-service
// ---------------------------------------------------------------------------
function ContactsTab() {
  const [rows, setRows]       = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!CONTACTS_URL) { setError('VITE_CONTACTS_API_BASE_URL is not configured.'); return }
    if (!ADMIN_JWT)    { setError('VITE_ADMIN_JWT is not configured.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${CONTACTS_URL}/api/v1/contacts?limit=100`, {
        headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
      const body = await res.json() as PagedResponse<Contact>
      setRows(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <Spinner label="Loading contacts…" />
  if (error)   return <ErrorBox message={error} onRetry={fetch_} />
  if (rows.length === 0) return <EmptyState label="contacts" onRefresh={fetch_} />

  const stageColor: Record<string, string> = {
    lead:       'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    prospect:   'bg-blue-500/15 text-blue-300 ring-blue-500/30',
    customer:   'bg-green-500/15 text-green-300 ring-green-500/30',
    churned:    'bg-red-500/15 text-red-300 ring-red-500/30',
    evangelist: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  }

  return (
    <div>
      <TableHeader count={rows.length} onRefresh={fetch_} />
      <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                <td className="px-3 py-2 text-zinc-200">{c.first_name} {c.last_name}</td>
                <td className="px-3 py-2 text-zinc-300">{c.email ?? '—'}</td>
                <td className="px-3 py-2 text-zinc-400">{c.phone ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 ring-1 ${stageColor[c.lifecycle_stage] ?? 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30'}`}>
                    {c.lifecycle_stage}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-zinc-500">{c.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accounts tab — fetches from accounts-service
// ---------------------------------------------------------------------------
function AccountsTab() {
  const [rows, setRows]       = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!ACCOUNTS_URL) { setError('VITE_ACCOUNTS_API_BASE_URL is not configured.'); return }
    if (!ADMIN_JWT)    { setError('VITE_ADMIN_JWT is not configured.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${ACCOUNTS_URL}/api/v1/accounts?limit=100`, {
        headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
      const body = await res.json() as PagedResponse<Account>
      setRows(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <Spinner label="Loading accounts…" />
  if (error)   return <ErrorBox message={error} onRetry={fetch_} />
  if (rows.length === 0) return <EmptyState label="accounts" onRefresh={fetch_} />

  const statusColor: Record<string, string> = {
    active:   'bg-green-500/15 text-green-300 ring-green-500/30',
    inactive: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
    churned:  'bg-red-500/15 text-red-300 ring-red-500/30',
  }

  return (
    <div>
      <TableHeader count={rows.length} onRefresh={fetch_} />
      <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Domain</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                <td className="px-3 py-2 text-zinc-200">{a.name}</td>
                <td className="px-3 py-2 text-zinc-300">{a.domain ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 ring-1 ${statusColor[a.status] ?? 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-zinc-500">{a.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Opportunities tab — fetches from opportunities-service
// ---------------------------------------------------------------------------
function OpportunitiesTab() {
  const [rows, setRows]       = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!OPPS_URL)  { setError('VITE_OPPORTUNITIES_API_BASE_URL is not configured.'); return }
    if (!ADMIN_JWT) { setError('VITE_ADMIN_JWT is not configured.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${OPPS_URL}/api/v1/opportunities`, {
        headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
      const data = await res.json() as Opportunity[]
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <Spinner label="Loading opportunities…" />
  if (error)   return <ErrorBox message={error} onRetry={fetch_} />
  if (rows.length === 0) return <EmptyState label="opportunities" onRefresh={fetch_} />

  const stageColor: Record<string, string> = {
    qualification: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    proposal:      'bg-blue-500/15 text-blue-300 ring-blue-500/30',
    negotiation:   'bg-purple-500/15 text-purple-300 ring-purple-500/30',
    'closed-won':  'bg-green-500/15 text-green-300 ring-green-500/30',
    'closed-lost': 'bg-red-500/15 text-red-300 ring-red-500/30',
  }

  const totalValue = rows.reduce((sum, o) => sum + o.amount, 0)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-xs text-zinc-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-zinc-500">
            Total value:{' '}
            <span className="text-zinc-300">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </p>
        </div>
        <button type="button" onClick={fetch_} className="btn-neutral px-3 py-1.5 text-xs">
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Close date</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => (
              <tr key={o.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                <td className="px-3 py-2 text-zinc-200">{o.name}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 ring-1 ${stageColor[o.stage] ?? 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30'}`}>
                    {o.stage}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {o.amount > 0 ? `$${o.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">{o.close_date?.slice(0, 10) ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-zinc-500">{o.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
]

export function CrmAdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [tab, setTab] = useState<Tab>('leads')

  if (!authed) return (
    <PageLayout>
      <AuthGate onAuth={() => setAuthed(true)} />
    </PageLayout>
  )

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">CRM — Admin</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Live data from the microservices. Requires{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">VITE_CONTACTS_API_BASE_URL</code>,{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">VITE_ACCOUNTS_API_BASE_URL</code>,{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">VITE_OPPORTUNITIES_API_BASE_URL</code>, and{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">VITE_ADMIN_JWT</code>.
            </p>
          </div>
          <a href="#/admin" className="btn-neutral px-3 py-1.5 text-xs">← Admin</a>
        </div>

        {/* Tab bar */}
        <div className="mt-5 flex gap-1 rounded-xl bg-zinc-800/50 p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab content */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        {tab === 'leads'         && <LeadsTab />}
        {tab === 'contacts'      && <ContactsTab />}
        {tab === 'accounts'      && <AccountsTab />}
        {tab === 'opportunities' && <OpportunitiesTab />}
      </section>
    </PageLayout>
  )
}
