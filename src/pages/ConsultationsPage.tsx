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

const STATUS_ORDER: ConsultationStatus[] = ['new', 'reviewed', 'accepted']

const STATUS_META: Record<ConsultationStatus, { label: string; badge: string }> = {
  new: {
    label: 'New',
    badge: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  },
  reviewed: {
    label: 'Reviewed',
    badge: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  },
  accepted: {
    label: 'Accepted',
    badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  },
}

const PRIORITY_META: Record<LeadPriority, { label: string; badge: string }> = {
  hot: {
    label: 'Hot',
    badge: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  },
  warm: {
    label: 'Warm',
    badge: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  },
  nurture: {
    label: 'Nurture',
    badge: 'border-zinc-500/40 bg-zinc-600/20 text-zinc-300',
  },
}

const HOT_LEAD_SLA_MINUTES = 120

function nextStatus(status: ConsultationStatus): ConsultationStatus | null {
  const index = STATUS_ORDER.indexOf(status)
  if (index < 0 || index === STATUS_ORDER.length - 1) return null
  return STATUS_ORDER[index + 1]
}

function StatusBadge({ status }: { status: ConsultationStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
      {meta.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: LeadPriority }) {
  const meta = PRIORITY_META[priority]
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
      {meta.label}
    </span>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-1 rounded-2xl p-4">
      <span className={`text-2xl font-semibold tracking-tight ${accent}`}>{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
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

function getHotLeadSla(request: ConsultationRequest): { label: string; badge: string } | null {
  if (request.leadPriority !== 'hot') return null

  if (typeof request.firstResponseMinutes === 'number') {
    if (request.firstResponseMinutes <= HOT_LEAD_SLA_MINUTES) {
      return {
        label: `SLA met (${formatSlaDuration(request.firstResponseMinutes)})`,
        badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
      }
    }
    return {
      label: `SLA missed (${formatSlaDuration(request.firstResponseMinutes)})`,
      badge: 'border-red-400/40 bg-red-500/15 text-red-200',
    }
  }

  if (request.status !== 'new') return null
  const ageMinutes = Math.max(0, Math.round((Date.now() - Date.parse(request.createdAt)) / 60000))
  if (!Number.isFinite(ageMinutes)) return null

  if (ageMinutes <= HOT_LEAD_SLA_MINUTES) {
    return {
      label: `SLA clock: ${formatSlaDuration(ageMinutes)} elapsed`,
      badge: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    }
  }

  return {
    label: `SLA overdue (${formatSlaDuration(ageMinutes)})`,
    badge: 'border-red-400/40 bg-red-500/15 text-red-200',
  }
}

export function ConsultationsPage() {
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
        <SummaryCard label="Total" value={counts.total} accent="text-zinc-100" />
        <SummaryCard label="Hot" value={counts.hot} accent="text-rose-300" />
        <SummaryCard label="New" value={counts.new} accent="text-amber-300" />
        <SummaryCard label="Reviewed" value={counts.reviewed} accent="text-sky-300" />
        <SummaryCard label="Accepted" value={counts.accepted} accent="text-emerald-300" />
      </section>

      <section className="forge-panel surface-card flex flex-wrap items-center gap-3 rounded-2xl p-4 text-xs text-zinc-300 sm:gap-4">
        <span className="rounded-full border border-zinc-700/50 bg-zinc-800/60 px-3 py-1.5">
          New → Reviewed: <strong className="text-zinc-100">{funnelMetrics.reviewedRate}</strong>
        </span>
        <span className="rounded-full border border-zinc-700/50 bg-zinc-800/60 px-3 py-1.5">
          Reviewed → Accepted: <strong className="text-zinc-100">{funnelMetrics.closeRate}</strong>
        </span>
        <span className="rounded-full border border-zinc-700/50 bg-zinc-800/60 px-3 py-1.5">
          Overall acceptance: <strong className="text-zinc-100">{funnelMetrics.overallRate}</strong>
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
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                    : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
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
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                    : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
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
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-400/50 hover:bg-red-500/20"
            >
              Clear all
            </button>
          )}
        </div>

        {visibleRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/40 px-5 py-10 text-center text-sm text-zinc-400">
            {requests.length === 0
              ? 'No consultation requests yet. Submissions from the landing page will appear here.'
              : 'No requests match this filter.'}
          </div>
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
                  className="rounded-2xl border border-zinc-700/50 bg-zinc-900/50 p-4 transition hover:border-zinc-600/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-100">{request.name}</span>
                        <StatusBadge status={request.status} />
                        {request.leadPriority && <PriorityBadge priority={request.leadPriority} />}
                        {typeof request.leadScore === 'number' && (
                          <span className="rounded-full border border-zinc-600/50 bg-zinc-800/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                            Score {request.leadScore}
                          </span>
                        )}
                        {sla && (
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sla.badge}`}>
                            {sla.label}
                          </span>
                        )}
                      </div>
                      <a
                        href={`mailto:${request.email}`}
                        className="mt-0.5 block truncate text-xs text-amber-300/90 hover:text-amber-200"
                      >
                        {request.email}
                      </a>
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {formatRelativeTime(request.createdAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-0.5">
                      {request.projectType}
                    </span>
                    <span className="rounded-full border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-0.5">
                      {request.timeline}
                    </span>
                    {request.budget && (
                      <span className="rounded-full border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-0.5">
                        {request.budget}
                      </span>
                    )}
                  </div>

                  {request.message && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{request.message}</p>
                  )}

                  {syncError[request.id] && (
                    <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {syncError[request.id]}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyFollowUp(request)}
                      className="rounded-lg border border-zinc-500/40 bg-zinc-800/70 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-400/60 hover:bg-zinc-700/70 hover:text-zinc-100"
                    >
                      {copyLabel}
                    </button>
                    {request.crmContactId ? (
                      <span className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                        Synced to CRM
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSync(request)}
                        disabled={syncingId === request.id}
                        className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-500/25 hover:text-sky-100 disabled:opacity-50"
                      >
                        {syncingId === request.id ? 'Sending…' : 'Send to CRM'}
                      </button>
                    )}
                    {target && (
                      <button
                        type="button"
                        onClick={() => handleAdvance(request)}
                        className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
                      >
                        Mark as {STATUS_META[target].label.toLowerCase()} →
                      </button>
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
