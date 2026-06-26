import { useEffect, useState } from 'react'
import {
  SUPPORT_CATEGORIES,
  createSupportRequest,
  getSupportRequests,
  removeSupportRequest,
  type SupportCategory,
  type SupportRequest,
  type SupportStatus,
} from './supportStore'
import { formatRelativeTime } from '../../utils/time'

const STATUS_META: Record<SupportStatus, { label: string; badge: string }> = {
  open: { label: 'Open', badge: 'border-amber-400/40 bg-amber-500/15 text-amber-200' },
  in_progress: { label: 'In progress', badge: 'border-sky-400/40 bg-sky-500/15 text-sky-200' },
  resolved: { label: 'Resolved', badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' },
}

export function SupportRequestPanel({ projectId }: { projectId: string }) {
  const [requests, setRequests] = useState<SupportRequest[]>(() => getSupportRequests(projectId))
  const [category, setCategory] = useState<SupportCategory>(SUPPORT_CATEGORIES[0])
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [justSent, setJustSent] = useState(false)

  useEffect(() => {
    setRequests(getSupportRequests(projectId))
  }, [projectId])

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    createSupportRequest({ projectId, category, subject, message })
    setRequests(getSupportRequests(projectId))
    setSubject('')
    setMessage('')
    setCategory(SUPPORT_CATEGORIES[0])
    setJustSent(true)
  }

  const handleWithdraw = (id: string) => {
    setRequests(removeSupportRequest(projectId, id))
  }

  const openCount = requests.filter((r) => r.status === 'open').length

  return (
    <div className="forge-panel surface-card-strong p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Support and maintenance</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-100">Request help anytime</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Log a maintenance, bug, or change request and track it without sending an email.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700/50 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300">
          {openCount} open
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportCategory)}
            className="rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 sm:w-48"
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Short subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              setJustSent(false)
            }}
            maxLength={120}
            className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
          />
        </div>
        <textarea
          rows={3}
          placeholder="Describe what you need help with."
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            setJustSent(false)
          }}
          maxLength={2000}
          className="resize-none rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {justSent ? (
            <p className="text-sm text-emerald-300">Request logged. I will pick it up from the queue.</p>
          ) : (
            <p className="text-sm text-zinc-500">Requests are tracked here until they are resolved.</p>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100 disabled:opacity-50"
          >
            Submit request
          </button>
        </div>
      </form>

      {requests.length > 0 && (
        <ul className="mt-5 space-y-2">
          {requests.map((request) => {
            const meta = STATUS_META[request.status]
            return (
              <li
                key={request.id}
                className="rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">{request.subject}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">{request.category}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-zinc-500">{formatRelativeTime(request.createdAt)}</span>
                </div>
                {request.message && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{request.message}</p>
                )}
                {request.status === 'open' && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleWithdraw(request.id)}
                      className="rounded-lg border border-zinc-600/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-500/60 hover:text-zinc-200"
                    >
                      Withdraw
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
