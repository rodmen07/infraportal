import { useMemo, useState } from 'react'
import { PageLayout } from './PageLayout'
import {
  clearConsultationRequests,
  getConsultationRequests,
  updateConsultationStatus,
  type ConsultationRequest,
  type ConsultationStatus,
} from '../features/consulting/consultationStore'
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

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="forge-panel surface-card-strong flex flex-col gap-1 rounded-2xl p-4">
      <span className={`text-2xl font-semibold tracking-tight ${accent}`}>{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
    </div>
  )
}

export function ConsultationsPage() {
  const [requests, setRequests] = useState<ConsultationRequest[]>(() => getConsultationRequests())
  const [filter, setFilter] = useState<ConsultationStatus | 'all'>('all')

  const counts = useMemo(() => {
    return {
      total: requests.length,
      new: requests.filter((r) => r.status === 'new').length,
      reviewed: requests.filter((r) => r.status === 'reviewed').length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
    }
  }, [requests])

  const visibleRequests = useMemo(() => {
    if (filter === 'all') return requests
    return requests.filter((r) => r.status === filter)
  }, [requests, filter])

  const handleAdvance = (request: ConsultationRequest) => {
    const target = nextStatus(request.status)
    if (!target) return
    setRequests(updateConsultationStatus(request.id, target))
  }

  const handleClear = () => {
    clearConsultationRequests()
    setRequests([])
  }

  const filterOptions: Array<{ value: ConsultationStatus | 'all'; label: string }> = [
    { value: 'all', label: `All (${counts.total})` },
    { value: 'new', label: `New (${counts.new})` },
    { value: 'reviewed', label: `Reviewed (${counts.reviewed})` },
    { value: 'accepted', label: `Accepted (${counts.accepted})` },
  ]

  return (
    <PageLayout
      title="Consultation requests"
      subtitle="Review incoming managed-hosting inquiries and move each one through intake to onboarding."
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total" value={counts.total} accent="text-zinc-100" />
        <SummaryCard label="New" value={counts.new} accent="text-amber-300" />
        <SummaryCard label="Reviewed" value={counts.reviewed} accent="text-sky-300" />
        <SummaryCard label="Accepted" value={counts.accepted} accent="text-emerald-300" />
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
                        Mark as {STATUS_META[target].label.toLowerCase()} →
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
