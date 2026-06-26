import { useMemo, useState } from 'react'
import { PageLayout } from './PageLayout'
import {
  getAllSupportRequests,
  updateSupportStatus,
  type SupportRequest,
  type SupportStatus,
} from '../features/support/supportStore'
import { formatRelativeTime } from '../utils/time'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'

const STATUS_ORDER: SupportStatus[] = ['open', 'in_progress', 'resolved']

const STATUS_META: Record<SupportStatus, { label: string; badge: string }> = {
  open: { label: 'Open', badge: 'border-amber-400/40 bg-amber-500/15 text-amber-200' },
  in_progress: { label: 'In progress', badge: 'border-sky-400/40 bg-sky-500/15 text-sky-200' },
  resolved: { label: 'Resolved', badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' },
}

function nextStatus(status: SupportStatus): SupportStatus | null {
  const index = STATUS_ORDER.indexOf(status)
  if (index < 0 || index === STATUS_ORDER.length - 1) return null
  return STATUS_ORDER[index + 1]
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-1 rounded-2xl p-4">
      <span className={`text-2xl font-semibold tracking-tight ${accent}`}>{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
    </div>
  )
}

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
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={submit} className="forge-panel surface-card-strong w-full max-w-sm space-y-4 p-6">
        <h2 className="text-base font-semibold text-zinc-100">Admin access required</h2>
        <input
          autoFocus
          type="password"
          placeholder="Admin key"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30"
        />
        {error && <p className="text-xs text-rose-400">Incorrect admin key</p>}
        <button type="submit" className="w-full rounded-lg bg-amber-500/20 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/30">
          Unlock
        </button>
      </form>
    </div>
  )
}

function SupportQueueView() {
  const [requests, setRequests] = useState<SupportRequest[]>(() => getAllSupportRequests())
  const [filter, setFilter] = useState<SupportStatus | 'all'>('all')

  const counts = useMemo(
    () => ({
      total: requests.length,
      open: requests.filter((r) => r.status === 'open').length,
      in_progress: requests.filter((r) => r.status === 'in_progress').length,
      resolved: requests.filter((r) => r.status === 'resolved').length,
    }),
    [requests],
  )

  const visibleRequests = useMemo(() => {
    if (filter === 'all') return requests
    return requests.filter((r) => r.status === filter)
  }, [requests, filter])

  const handleAdvance = (request: SupportRequest) => {
    const target = nextStatus(request.status)
    if (!target) return
    updateSupportStatus(request.projectId, request.id, target)
    setRequests(getAllSupportRequests())
  }

  const handleRefresh = () => setRequests(getAllSupportRequests())

  const filterOptions: Array<{ value: SupportStatus | 'all'; label: string }> = [
    { value: 'all', label: `All (${counts.total})` },
    { value: 'open', label: `Open (${counts.open})` },
    { value: 'in_progress', label: `In progress (${counts.in_progress})` },
    { value: 'resolved', label: `Resolved (${counts.resolved})` },
  ]

  return (
    <PageLayout
      title="Support queue"
      subtitle="Triage client maintenance and support requests and move each one to resolution."
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total" value={counts.total} accent="text-zinc-100" />
        <SummaryCard label="Open" value={counts.open} accent="text-amber-300" />
        <SummaryCard label="In progress" value={counts.in_progress} accent="text-sky-300" />
        <SummaryCard label="Resolved" value={counts.resolved} accent="text-emerald-300" />
      </section>

      <section className="forge-panel surface-card-strong flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  filter === option.value
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                    : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-lg border border-zinc-600/40 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100"
          >
            Refresh
          </button>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/40 px-5 py-10 text-center text-sm text-zinc-400">
            {requests.length === 0
              ? 'No support requests yet. Client submissions from the portal will appear here.'
              : 'No requests match this filter.'}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleRequests.map((request) => {
              const meta = STATUS_META[request.status]
              const target = nextStatus(request.status)
              return (
                <li
                  key={request.id}
                  className="rounded-2xl border border-zinc-700/50 bg-zinc-900/50 p-4 transition hover:border-zinc-600/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-100">{request.subject}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
                        {request.category} · project {request.projectId}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-500">{formatRelativeTime(request.createdAt)}</span>
                  </div>

                  {request.message && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{request.message}</p>
                  )}

                  {target && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleAdvance(request)}
                        className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
                      >
                        Move to {STATUS_META[target].label.toLowerCase()} →
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </PageLayout>
  )
}

export function SupportQueuePage() {
  return (
    <PageLayout>
      <AuthGate>
        <SupportQueueView />
      </AuthGate>
    </PageLayout>
  )
}
