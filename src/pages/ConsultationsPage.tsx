import { useMemo, useState } from 'react'
import { PageLayout } from './PageLayout'
import {
  attachCrmContact,
  clearConsultationRequests,
  getConsultationRequests,
  updateConsultationStatus,
  type ConsultationRequest,
  type ConsultationStatus,
} from '../features/consulting/consultationStore'
import { pushConsultationToCrm } from '../features/consulting/consultationLead'
import { buildFollowUpClipboardText } from '../features/consulting/followUpTemplate'
import { type LeadPriority } from '../features/consulting/leadScoring'
import { formatRelativeTime } from '../utils/time'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'

const STATUS_ORDER: ConsultationStatus[] = ['new', 'reviewed', 'accepted']

// v1.18.4: status/priority badges migrated onto the shared Badge primitive.
// `reviewed` and `hot` previously used `sky`/`rose`, two hues outside D4's
// sanctioned status vocabulary (zinc + amber identity, emerald/red/orange/
// yellow status) with no [data-theme="light"] override either; they now
// read `info` (blue) and `danger` (red) respectively.
const STATUS_META: Record<ConsultationStatus, { label: string; tone: BadgeTone }> = {
  new: { label: 'New', tone: 'accent' },
  reviewed: { label: 'Reviewed', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
}

const PRIORITY_META: Record<LeadPriority, { label: string; tone: BadgeTone }> = {
  hot: { label: 'Hot', tone: 'danger' },
  warm: { label: 'Warm', tone: 'accent' },
  nurture: { label: 'Nurture', tone: 'neutral' },
}

const HOT_LEAD_SLA_MINUTES = 120

function nextStatus(status: ConsultationStatus): ConsultationStatus | null {
  const index = STATUS_ORDER.indexOf(status)
  if (index < 0 || index === STATUS_ORDER.length - 1) return null
  return STATUS_ORDER[index + 1]
}

function StatusBadge({ status }: { status: ConsultationStatus }) {
  const meta = STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

function PriorityBadge({ priority }: { priority: LeadPriority }) {
  const meta = PRIORITY_META[priority]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

// Explicit lookup rather than `text-${tone}` string interpolation: Tailwind's
// content scanner reads literal class-name strings from source, not
// evaluated template output, so an interpolated class name would silently
// never be generated (the exact ghost-class failure mode this whole
// milestone exists to eliminate).
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

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: BadgeTone | 'primary' }) {
  const valueClass = SUMMARY_VALUE_CLASSES[tone]
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-1 rounded-2xl p-4">
      <span className={`text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</span>
      <span className="text-scale-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</span>
    </div>
  )
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}

function formatSlaDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (remaining === 0) return `${hours}h`
  return `${hours}h ${remaining}m`
}

function getHotLeadSla(request: ConsultationRequest): { label: string; tone: BadgeTone } | null {
  if (request.leadPriority !== 'hot') return null

  if (typeof request.firstResponseMinutes === 'number') {
    if (request.firstResponseMinutes <= HOT_LEAD_SLA_MINUTES) {
      return {
        label: `SLA met (${formatSlaDuration(request.firstResponseMinutes)})`,
        tone: 'success',
      }
    }
    return {
      label: `SLA missed (${formatSlaDuration(request.firstResponseMinutes)})`,
      tone: 'danger',
    }
  }

  if (request.status !== 'new') return null
  const ageMinutes = Math.max(0, Math.round((Date.now() - Date.parse(request.createdAt)) / 60000))
  if (!Number.isFinite(ageMinutes)) return null

  if (ageMinutes <= HOT_LEAD_SLA_MINUTES) {
    return {
      label: `SLA clock: ${formatSlaDuration(ageMinutes)} elapsed`,
      tone: 'accent',
    }
  }

  return {
    label: `SLA overdue (${formatSlaDuration(ageMinutes)})`,
    tone: 'danger',
  }
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

function ConsultationsView() {
  const [requests, setRequests] = useState<ConsultationRequest[]>(() => getConsultationRequests())
  const [filter, setFilter] = useState<ConsultationStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | 'all'>('all')
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<Record<string, string>>({})
  const [copyState, setCopyState] = useState<Record<string, 'idle' | 'copied' | 'error'>>({})

  const counts = useMemo(() => {
    return {
      total: requests.length,
      new: requests.filter((r) => r.status === 'new').length,
      reviewed: requests.filter((r) => r.status === 'reviewed').length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
      hot: requests.filter((r) => r.leadPriority === 'hot').length,
      warm: requests.filter((r) => r.leadPriority === 'warm').length,
      nurture: requests.filter((r) => r.leadPriority === 'nurture').length,
    }
  }, [requests])

  const funnelMetrics = useMemo(() => {
    const reviewedRate = formatPercent(counts.reviewed, counts.new)
    const closeRate = formatPercent(counts.accepted, counts.reviewed)
    const overallRate = formatPercent(counts.accepted, counts.total)

    return { reviewedRate, closeRate, overallRate }
  }, [counts])

  const visibleRequests = useMemo(() => {
    const byStatus = filter === 'all' ? requests : requests.filter((r) => r.status === filter)
    const byPriority =
      priorityFilter === 'all' ? byStatus : byStatus.filter((r) => r.leadPriority === priorityFilter)

    return byPriority
      .slice()
      .sort((a, b) => {
        const scoreDelta = (b.leadScore ?? 0) - (a.leadScore ?? 0)
        if (scoreDelta !== 0) return scoreDelta
        return Date.parse(b.createdAt) - Date.parse(a.createdAt)
      })
  }, [requests, filter, priorityFilter])

  const handleAdvance = (request: ConsultationRequest) => {
    const target = nextStatus(request.status)
    if (!target) return
    setRequests(updateConsultationStatus(request.id, target))
  }

  const handleSync = async (request: ConsultationRequest) => {
    setSyncingId(request.id)
    setSyncError((prev) => {
      const next = { ...prev }
      delete next[request.id]
      return next
    })

    const result = await pushConsultationToCrm(request)

    if (result.ok) {
      setRequests(attachCrmContact(request.id, result.contactId))
    } else {
      setSyncError((prev) => ({ ...prev, [request.id]: result.message }))
    }
    setSyncingId(null)
  }

  const handleClear = () => {
    clearConsultationRequests()
    setRequests([])
    setSyncError({})
    setCopyState({})
  }

  const handleCopyFollowUp = async (request: ConsultationRequest) => {
    const text = buildFollowUpClipboardText({
      name: request.name,
      projectType: request.projectType,
      timeline: request.timeline,
      budget: request.budget,
      leadPriority: request.leadPriority,
      status: request.status,
    })

    try {
      await navigator.clipboard.writeText(text)
      setCopyState((prev) => ({ ...prev, [request.id]: 'copied' }))
      setTimeout(() => {
        setCopyState((prev) => ({ ...prev, [request.id]: 'idle' }))
      }, 1800)
    } catch {
      setCopyState((prev) => ({ ...prev, [request.id]: 'error' }))
      setTimeout(() => {
        setCopyState((prev) => ({ ...prev, [request.id]: 'idle' }))
      }, 2200)
    }
  }

  const filterOptions: Array<{ value: ConsultationStatus | 'all'; label: string }> = [
    { value: 'all', label: `All (${counts.total})` },
    { value: 'new', label: `New (${counts.new})` },
    { value: 'reviewed', label: `Reviewed (${counts.reviewed})` },
    { value: 'accepted', label: `Accepted (${counts.accepted})` },
  ]

  const priorityFilterOptions: Array<{ value: LeadPriority | 'all'; label: string }> = [
    { value: 'all', label: `All priorities (${counts.total})` },
    { value: 'hot', label: `Hot (${counts.hot})` },
    { value: 'warm', label: `Warm (${counts.warm})` },
    { value: 'nurture', label: `Nurture (${counts.nurture})` },
  ]

  return (
    <PageLayout
      title="Consultation requests"
      subtitle="Review incoming inquiries, prioritize the highest-value leads, and move each one from intake to onboarding."
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Total" value={counts.total} tone="primary" />
        <SummaryCard label="Hot" value={counts.hot} tone="danger" />
        <SummaryCard label="New" value={counts.new} tone="accent" />
        <SummaryCard label="Reviewed" value={counts.reviewed} tone="info" />
        <SummaryCard label="Accepted" value={counts.accepted} tone="success" />
      </section>

      <section className="forge-panel surface-card flex flex-wrap items-center gap-3 rounded-2xl p-4 text-xs text-text-secondary sm:gap-4">
        <span className="rounded-full border border-border-soft bg-surface-hover px-3 py-1.5">
          New → Reviewed: <strong className="text-text-primary">{funnelMetrics.reviewedRate}</strong>
        </span>
        <span className="rounded-full border border-border-soft bg-surface-hover px-3 py-1.5">
          Reviewed → Accepted: <strong className="text-text-primary">{funnelMetrics.closeRate}</strong>
        </span>
        <span className="rounded-full border border-border-soft bg-surface-hover px-3 py-1.5">
          Overall acceptance: <strong className="text-text-primary">{funnelMetrics.overallRate}</strong>
        </span>
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
          <div className="flex flex-wrap gap-2">
            {priorityFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriorityFilter(option.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  priorityFilter === option.value
                    ? 'border-danger-line bg-danger-soft text-danger-text'
                    : 'border-border-soft bg-surface-control text-text-secondary hover:border-border-strong hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {requests.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-danger-line bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger-text transition hover:brightness-110"
            >
              Clear all
            </button>
          )}
        </div>

        {visibleRequests.length === 0 ? (
          <EmptyState>
            {requests.length === 0
              ? 'No consultation requests yet. Submissions from the landing page will appear here.'
              : 'No requests match this filter.'}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleRequests.map((request) => {
              const target = nextStatus(request.status)
              const sla = getHotLeadSla(request)
              const copyLabel =
                copyState[request.id] === 'copied'
                  ? 'Copied'
                  : copyState[request.id] === 'error'
                    ? 'Copy failed'
                    : 'Copy follow-up'
              return (
                <li
                  key={request.id}
                  className="rounded-2xl border border-border-soft bg-surface-1 p-4 transition hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">{request.name}</span>
                        <StatusBadge status={request.status} />
                        {request.leadPriority && <PriorityBadge priority={request.leadPriority} />}
                        {typeof request.leadScore === 'number' && (
                          <Badge tone="neutral">Score {request.leadScore}</Badge>
                        )}
                        {sla && <Badge tone={sla.tone}>{sla.label}</Badge>}
                      </div>
                      <a
                        href={`mailto:${request.email}`}
                        className="mt-0.5 block truncate text-xs text-accent hover:text-accent-text"
                      >
                        {request.email}
                      </a>
                    </div>
                    <span className="shrink-0 text-scale-xs text-text-muted">
                      {formatRelativeTime(request.createdAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-scale-xs text-text-muted">
                    <span className="rounded-full border border-border-soft bg-surface-hover px-2.5 py-0.5">
                      {request.projectType}
                    </span>
                    <span className="rounded-full border border-border-soft bg-surface-hover px-2.5 py-0.5">
                      {request.timeline}
                    </span>
                    {request.budget && (
                      <span className="rounded-full border border-border-soft bg-surface-hover px-2.5 py-0.5">
                        {request.budget}
                      </span>
                    )}
                  </div>

                  {request.message && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">{request.message}</p>
                  )}

                  {syncError[request.id] && (
                    <p className="mt-3 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger-text">
                      {syncError[request.id]}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Button variant="neutral" size="sm" onClick={() => handleCopyFollowUp(request)}>
                      {copyLabel}
                    </Button>
                    {request.crmContactId ? (
                      <span className="rounded-lg border border-success-line bg-success-soft px-3 py-1.5 text-xs font-medium text-success-text">
                        Synced to CRM
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSync(request)}
                        disabled={syncingId === request.id}
                        className="rounded-lg border border-info-line bg-info-soft px-3 py-1.5 text-xs font-semibold text-info-text transition disabled:opacity-50"
                      >
                        {syncingId === request.id ? 'Sending…' : 'Send to CRM'}
                      </button>
                    )}
                    {target && (
                      <Button variant="accent" size="sm" onClick={() => handleAdvance(request)}>
                        Mark as {STATUS_META[target].label.toLowerCase()} →
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </PageLayout>
  )
}

export function ConsultationsPage() {
  return (
    <PageLayout>
      <AuthGate>
        <ConsultationsView />
      </AuthGate>
    </PageLayout>
  )
}
