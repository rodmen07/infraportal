import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'
import { resolveAdminToken } from '../config'

const ADMIN_KEY          = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'
const ACCOUNTS_URL      = (import.meta.env.VITE_ACCOUNTS_API_BASE_URL ?? '').replace(/\/$/, '')
const CONTACTS_URL      = (import.meta.env.VITE_CONTACTS_API_BASE_URL ?? '').replace(/\/$/, '')
const OPPORTUNITIES_URL = (import.meta.env.VITE_OPPORTUNITIES_API_BASE_URL ?? '').replace(/\/$/, '')
const ACTIVITIES_URL    = (import.meta.env.VITE_ACTIVITIES_API_BASE_URL ?? '').replace(/\/$/, '')
const REPORTING_URL     = (import.meta.env.VITE_REPORTING_API_BASE_URL ?? '').replace(/\/$/, '')

interface ServiceCounts {
  accounts: number
  contacts: number
  opportunities: number
  activities: number
  reports: number
  core_metrics: string[]
}

interface Opportunity {
  id: string
  name: string
  stage: string
  amount?: number
  created_at: string
}

interface Activity {
  id: string
  activity_type: string
  subject: string
  completed: boolean
  created_at: string
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

function AuthGate({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(() => sessionStorage.getItem('admin_key') ?? '')
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  if (key === ADMIN_KEY) return <>{children}</>

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input === ADMIN_KEY) {
      sessionStorage.setItem('admin_key', input)
      setKey(input)
      setError(false)
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={submit} className="forge-panel surface-card-strong w-full max-w-sm space-y-4 p-6">
        <h2 className="text-base font-semibold text-zinc-100">Admin access required</h2>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false) }}
          placeholder="Admin key"
          className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
        />
        {error && <p className="text-xs text-red-400">Invalid key</p>}
        <button type="submit" className="btn-accent w-full">Unlock</button>
      </form>
    </div>
  )
}

async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolveAdminToken()}`,
      ...opts.headers,
    },
  })
  if (res.status === 204) {
    return null as unknown as T
  }
  if (!res.ok) {
    type ErrorBody = { message?: string }
    const body = await res.json().catch(() => ({} as ErrorBody))
    const message =
      typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `${res.status} ${res.statusText}`
    throw new Error(message)
  }
  return res.json()
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="forge-panel surface-card-strong p-4">
      <p className="text-xs uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="text-3xl font-bold text-amber-300">{value}</p>
    </div>
  )
}

function StageDistribution({ stages }: { stages: Record<string, number> }) {
  const entries = Object.entries(stages).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  if (!entries.length) {
    return <p className="text-sm text-zinc-500">No opportunity stages yet.</p>
  }

  return (
    <div className="space-y-2">
      {entries.map(([stage, count]) => {
        const width = total > 0 ? Math.max(Math.min((count / total) * 100, 100), 1) : 0
        return (
          <div key={stage} className="space-y-1">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{stage}</span>
              <span>{count}/{total}</span>
            </div>
            <div className="h-2 w-full rounded bg-zinc-800">
              <div
                className="h-2 rounded bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecentActivities({ rows }: { rows: Activity[] }) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-500">No recent activities.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700/40 bg-zinc-800/40 text-left text-xs text-zinc-400">
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-zinc-700/20 hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-zinc-200">{a.activity_type}</td>
              <td className="px-3 py-2 text-zinc-300">{a.subject}</td>
              <td className="px-3 py-2 text-zinc-400">{a.created_at.slice(0, 10)}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${a.completed ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {a.completed ? 'done' : 'pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function UserDashboardPage() {
  const [counts, setCounts] = useState<ServiceCounts | null>(null)
  const [stageDistribution, setStageDistribution] = useState<Record<string, number>>({})
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])
  const [userCandidates, setUserCandidates] = useState<string[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('admin')
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const fetchCounts = useCallback(async () => {
    if (!resolveAdminToken()) {
      setError('No auth token — set VITE_ADMIN_JWT or log in via the portal to refresh your session.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setError(null)

    try {
      // Use separate backend path for dev: /dashboard gives scoped report summary in reporting-service
      const dashUrl = viewMode === 'user' && selectedUserId
        ? `${REPORTING_URL}/api/v1/dashboard?user_id=${encodeURIComponent(selectedUserId)}`
        : `${REPORTING_URL}/api/v1/dashboard`

      const dashboard = await api<{ reports: number; core_metrics: string[] }>(dashUrl)

      // Fetch raw lists for admin overview; for user mode we include only selected account if set.
      const [accounts, contacts, oppData, actData] = await Promise.all([
        api<{ data: { id: string }[]; total: number }>(`${ACCOUNTS_URL}/api/v1/accounts?limit=100`),
        api<{ data: { id: string }[]; total: number }>(`${CONTACTS_URL}/api/v1/contacts?limit=100`),
        api<Opportunity[]>(`${OPPORTUNITIES_URL}/api/v1/opportunities`),
        api<Activity[]>(`${ACTIVITIES_URL}/api/v1/activities`),
      ])

      if (viewMode === 'admin' && accounts.data.length && userCandidates.length === 0) {
        setUserCandidates(accounts.data.map((a) => a.id))
        if (!selectedUserId) {
          setSelectedUserId(accounts.data[0]?.id ?? null)
        }
      }

      const filteredOpp = viewMode === 'user' && selectedUserId
        ? oppData.filter((o) => o.name.includes(selectedUserId))
        : oppData
      const filteredAct = viewMode === 'user' && selectedUserId
        ? actData.filter((a) => a.subject.includes(selectedUserId))
        : actData

      const stageCounts: Record<string, number> = {}
      filteredOpp.forEach((o) => {
        stageCounts[o.stage] = (stageCounts[o.stage] ?? 0) + 1
      })

      setCounts({
        accounts: viewMode === 'admin' ? accounts.total : (selectedUserId ? (accounts.data.filter((a) => a.id === selectedUserId)).length : 0),
        contacts: viewMode === 'admin' ? contacts.total : (selectedUserId ? (contacts.data.filter((c) => c.id === selectedUserId)).length : 0),
        opportunities: filteredOpp.length,
        activities: filteredAct.length,
        reports: dashboard.reports,
        core_metrics: dashboard.core_metrics,
      })

      setStageDistribution(stageCounts)
      setRecentActivities(filteredAct.slice(0, 5))
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
      setStatus('error')
    }
  }, [viewMode, selectedUserId, userCandidates])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchCounts()
    }, 0)

    return () => {
      window.clearTimeout(handle)
    }
  }, [fetchCounts])

  return (
    <PageLayout title="User dashboard" subtitle="Cross-service stats and metrics">
      <AuthGate>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">View mode</label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'admin' | 'user')}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              >
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            {viewMode === 'user' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400 uppercase tracking-wider">User</label>
                <select
                  value={selectedUserId ?? ''}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                >
                  <option value="">Select user</option>
                  {userCandidates.map((userId) => (
                    <option key={userId} value={userId}>{userId}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Card label="Accounts" value={counts?.accounts ?? '–'} />
            <Card label="Contacts" value={counts?.contacts ?? '–'} />
            <Card label="Opportunities" value={counts?.opportunities ?? '–'} />
            <Card label="Activities" value={counts?.activities ?? '–'} />
            <Card label="Saved reports" value={counts?.reports ?? '–'} />
          </div>

          <div className="forge-panel surface-card-strong p-4">
            <h3 className="text-sm font-semibold text-zinc-200">Core report metrics</h3>
            {status === 'loading' && <p className="text-sm text-zinc-400">Loading...</p>}
            {status === 'error' && <p className="text-sm text-red-400">{error}</p>}
            {status === 'success' && counts?.core_metrics.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {counts.core_metrics.map((m) => (
                  <span key={m} className="rounded-full border border-zinc-600/40 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300">{m}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No core metrics available.</p>
            )}
          </div>

          <div className="forge-panel surface-card-strong p-4">
            <h3 className="text-sm font-semibold text-zinc-200">Opportunity stage distribution</h3>
            {status === 'loading' && <p className="text-sm text-zinc-400">Loading...</p>}
            {status === 'error' && <p className="text-sm text-red-400">{error}</p>}
            {status === 'success' && <StageDistribution stages={stageDistribution} />}
          </div>

          <div className="forge-panel surface-card-strong p-4">
            <h3 className="text-sm font-semibold text-zinc-200">Recent activities</h3>
            {status === 'loading' && <p className="text-sm text-zinc-400">Loading...</p>}
            {status === 'error' && <p className="text-sm text-red-400">{error}</p>}
            {status === 'success' && <RecentActivities rows={recentActivities} />}
          </div>

          <div className="flex gap-2">
            <button className="btn-accent btn-sm" onClick={fetchCounts} disabled={status === 'loading'}>
              Refresh
            </button>
            <button className="btn-neutral btn-sm" onClick={() => window.location.hash = '#/crm/reports'}>
              Manage reports
            </button>
          </div>
        </div>
      </AuthGate>
    </PageLayout>
  )
}
