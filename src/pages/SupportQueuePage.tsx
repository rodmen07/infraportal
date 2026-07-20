import { useMemo, useState } from 'react'
import { PageLayout } from './PageLayout'
import {
  getAllSupportRequests,
  updateSupportStatus,
  type SupportRequest,
  type SupportStatus,
} from '../features/support/supportStore'
import { formatRelativeTime } from '../utils/time'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'

const STATUS_ORDER: SupportStatus[] = ['open', 'in_progress', 'resolved']

// v1.18.4: migrated onto the shared Badge primitive (see ConsultationsPage
// for the identical `sky` -> `info` rationale: outside D4's sanctioned
// status vocabulary, and this exact class combination had no
// [data-theme="light"] override).
const STATUS_META: Record<SupportStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'accent' },
  in_progress: { label: 'In progress', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
}

const SUMMARY_VALUE_CLASSES: Record<BadgeTone | 'primary', string> = {
  primary: 'text-text-primary',
  accent: 'text-accent',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  caution: 'text-caution',
  danger: 'text-danger',
  neutral: 'text-text-secondary',
}

function nextStatus(status: SupportStatus): SupportStatus | null {
  const index = STATUS_ORDER.indexOf(status)
  if (index < 0 || index === STATUS_ORDER.length - 1) return null
  return STATUS_ORDER[index + 1]
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: BadgeTone | 'primary' }) {
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-1 rounded-2xl p-4">
      <span className={`text-2xl font-semibold tracking-tight ${SUMMARY_VALUE_CLASSES[tone]}`}>{value}</span>
      <span className="text-scale-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</span>
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
        <h2 className="text-base font-semibold text-text-primary">Admin access required</h2>
        <input
          autoFocus
          type="password"
          placeholder="Admin key"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="field-input px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-danger">Incorrect admin key</p>}
        <Button type="submit" variant="accent" className="w-full">
          Unlock
        </Button>
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
        <SummaryCard label="Total" value={counts.total} tone="primary" />
        <SummaryCard label="Open" value={counts.open} tone="accent" />
        <SummaryCard label="In progress" value={counts.in_progress} tone="info" />
        <SummaryCard label="Resolved" value={counts.resolved} tone="success" />
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
                    ? 'border-accent-line-hover bg-accent-soft text-accent-text'
                    : 'border-border-soft bg-surface-control text-text-secondary hover:border-border-strong hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-lg border border-border-soft bg-surface-control px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text-primary"
          >
            Refresh
          </button>
        </div>

        {visibleRequests.length === 0 ? (
          <EmptyState>
            {requests.length === 0
              ? 'No support requests yet. Client submissions from the portal will appear here.'
              : 'No requests match this filter.'}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleRequests.map((request) => {
              const meta = STATUS_META[request.status]
              const target = nextStatus(request.status)
              return (
                <li
                  key={request.id}
                  className="rounded-2xl border border-border-soft bg-surface-1 p-4 transition hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">{request.subject}</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-scale-xs uppercase tracking-wide text-text-muted">
                        {request.category} · project {request.projectId}
                      </p>
                    </div>
                    <span className="shrink-0 text-scale-xs text-text-muted">{formatRelativeTime(request.createdAt)}</span>
                  </div>

                  {request.message && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">{request.message}</p>
                  )}

                  {target && (
                    <div className="mt-4 flex justify-end">
                      <Button variant="accent" size="sm" onClick={() => handleAdvance(request)}>
                        Move to {STATUS_META[target].label.toLowerCase()} →
                      </Button>
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
