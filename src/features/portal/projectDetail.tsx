import type React from 'react'
import { useState, useEffect, useRef } from 'react'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import DOMPurify from 'dompurify'
import type {
  Project,
  Milestone,
  Deliverable,
  Message,
  Collaborator,
  ProgressUpdate,
  ProjectLink,
  ProjectEmail,
} from './types'

// --- Sub-components ---

// v1.18.4: migrated onto the shared Badge primitive. `blue` (completed) had
// no [data-theme="light"] override anywhere and is outside D4's sanctioned
// status vocabulary, so it moves onto `info` alongside the rest.
const STATUS_TONE: Record<string, BadgeTone> = {
  planning: 'neutral',
  active: 'success',
  on_hold: 'accent',
  completed: 'info',
  cancelled: 'danger',
  pending: 'neutral',
  in_progress: 'accent',
  blocked: 'danger',
  done: 'success',
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? 'neutral'
  return (
    <Badge tone={tone}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

export function ProjectSummaryCard({
  project,
  deliverablesByMilestone,
}: {
  project: Project
  deliverablesByMilestone: Record<string, Deliverable[]>
}) {
  const allDeliverables = Object.values(deliverablesByMilestone).flat()
  const total = allDeliverables.length
  const doneCount = allDeliverables.filter((d) => d.status === 'completed' || d.status === 'done').length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const totalHours = allDeliverables.reduce((s, d) => s + (d.estimated_hours ?? 0), 0)
  const doneHours = allDeliverables
    .filter((d) => d.status === 'completed' || d.status === 'done')
    .reduce((s, d) => s + (d.estimated_hours ?? 0), 0)

  const daysLeft = project.target_end_date
    ? (() => {
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now()
        return Math.ceil(
          (new Date(project.target_end_date).getTime() - now) / (1000 * 60 * 60 * 24)
        )
      })()
    : null

  return (
    <div className="forge-panel surface-card-strong p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{project.name}</h2>
          {project.description && (
            <p className="mt-1 text-sm text-zinc-400">{project.description}</p>
          )}
        </div>
        <StatusBadge status={project.status} />
      </div>

      {total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Overall progress</span>
            <span>{doneCount}/{total} deliverables ({pct}%)</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
        {project.start_date && (
          <span>Started <span className="text-zinc-300">{project.start_date.slice(0, 10)}</span></span>
        )}
        {project.target_end_date && daysLeft !== null && (
          <span>
            Target{' '}
            <span className="text-zinc-300">{project.target_end_date.slice(0, 10)}</span>
            {' — '}
            <span className={daysLeft < 0 ? 'text-red-400' : 'text-zinc-300'}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
            </span>
          </span>
        )}
        {totalHours > 0 && (
          <span>
            Est. effort{' '}
            <span className="text-zinc-300">{doneHours.toFixed(1)}h / {totalHours.toFixed(1)}h</span>
          </span>
        )}
        {project.budget != null && (
          <span>
            Budget{' '}
            <span className="text-zinc-300">
              {project.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

const LINK_TYPE_ICONS: Record<string, string> = {
  upwork: '💼',
  drive:  '📁',
  github: '⚙',
  figma:  '🎨',
  other:  '🔗',
}

export function LinksSection({ links }: { links: ProjectLink[] }) {
  if (!links.length) return null
  return (
    <div className="forge-panel surface-card-strong p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Project links</h3>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-zinc-600/40 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-amber-400/50 hover:text-amber-300"
          >
            <span>{LINK_TYPE_ICONS[link.link_type] ?? '🔗'}</span>
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}

export function EmailsSection({ emails }: { emails: ProjectEmail[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!emails.length) return null

  return (
    <div className="forge-panel surface-card-strong overflow-hidden">
      <div className="border-b border-zinc-700/40 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">Project emails</h3>
      </div>
      <div className="divide-y divide-zinc-700/20">
        {emails.map((email) => {
          const isOpen = expanded === email.id
          return (
            <div key={email.id}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : email.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">{email.subject}</p>
                  <p className="text-xs text-zinc-500">{email.from_email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-zinc-500">{email.received_at.slice(0, 10)}</span>
                  <span className="text-xs text-zinc-500">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-zinc-700/20 px-4 py-3">
                  {email.body_html ? (
                    <div
                      className="prose prose-invert prose-sm max-w-none text-zinc-300"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body_html) }}
                    />
                  ) : email.snippet ? (
                    <p className="text-sm text-zinc-400">{email.snippet}</p>
                  ) : (
                    <p className="text-xs text-zinc-500">No content available.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeliverableRow({ d }: { d: Deliverable }) {
  const done = d.status === 'completed' || d.status === 'done'
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {/* v1.18.4 type-scale allowlist: a fixed 16x16px checkbox glyph (a
          checkmark or nothing), redundant with the strike-through name and
          the StatusBadge below - not real text content, and a 12px floor
          would not fit the box. See src/styles/typeScaleFloor.test.ts. */}
      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border text-center text-[10px] leading-[14px] ${
        done ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-zinc-600/40 bg-zinc-800/40 text-zinc-500'
      }`}>
        {done ? '✓' : ''}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{d.name}</p>
        {d.description && <p className="mt-0.5 text-xs text-zinc-500">{d.description}</p>}
      </div>
      {d.estimated_hours != null && d.estimated_hours > 0 && (
        <span className="shrink-0 text-xs text-zinc-500">{d.estimated_hours}h</span>
      )}
      <StatusBadge status={d.status} />
    </div>
  )
}

export function MilestoneCard({ milestone, deliverables }: { milestone: Milestone; deliverables: Deliverable[] }) {
  const [open, setOpen] = useState(true)
  const total = deliverables.length
  const done = deliverables.filter((d) => d.status === 'completed' || d.status === 'done').length
  const totalHours = deliverables.reduce((s, d) => s + (d.estimated_hours ?? 0), 0)
  const doneHours = deliverables
    .filter((d) => d.status === 'completed' || d.status === 'done')
    .reduce((s, d) => s + (d.estimated_hours ?? 0), 0)

  return (
    <div className="forge-panel surface-card-strong overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-100">{milestone.name}</span>
          <StatusBadge status={milestone.status} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {milestone.due_date && (
            <span className="text-xs text-zinc-500">Due {milestone.due_date.slice(0, 10)}</span>
          )}
          {total > 0 && <span className="text-xs text-zinc-400">{done}/{total}</span>}
          {totalHours > 0 && (
            <span className="text-xs text-zinc-500">{doneHours.toFixed(1)}/{totalHours.toFixed(1)}h</span>
          )}
          <span className="text-xs text-zinc-500">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-700/40 px-4 pb-3">
          {milestone.description && (
            <p className="py-2 text-xs text-zinc-400">{milestone.description}</p>
          )}
          {total > 0 && (
            <>
              {total > 1 && (
                <div className="mb-3 mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                    style={{ width: `${(done / total) * 100}%` }}
                  />
                </div>
              )}
              <div className="divide-y divide-zinc-700/20">
                {deliverables.map((d) => <DeliverableRow key={d.id} d={d} />)}
              </div>
            </>
          )}
          {total === 0 && <p className="py-2 text-xs text-zinc-500">No deliverables yet.</p>}
        </div>
      )}
    </div>
  )
}

export function CollaboratorsSection({ collaborators }: { collaborators: Collaborator[] }) {
  if (!collaborators.length) return null
  return (
    <div className="forge-panel surface-card-strong p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Team</h3>
      <div className="flex flex-wrap gap-3">
        {collaborators.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-full border border-zinc-600/40 bg-zinc-800/60 px-3 py-1.5">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt={c.name} className="h-5 w-5 rounded-full object-cover" />
            ) : (
              // v1.18.4 type-scale allowlist: a fixed 20x20px avatar-initial
              // fallback, redundant with the collaborator's full name
              // rendered right beside it. See
              // src/styles/typeScaleFloor.test.ts.
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-semibold text-amber-300">
                {c.name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <div>
              <p className="text-xs font-medium text-zinc-200">{c.name}</p>
              <p className="text-scale-xs text-zinc-500">{c.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProgressUpdatesSection({ updates }: { updates: ProgressUpdate[] }) {
  if (!updates.length) return null
  return (
    <div className="forge-panel surface-card-strong overflow-hidden">
      <div className="border-b border-zinc-700/40 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">Project updates</h3>
      </div>
      <div className="divide-y divide-zinc-700/20">
        {updates.map((u) => (
          <div key={u.id} className="px-4 py-3">
            <p className="text-xs text-zinc-500">{u.created_at.slice(0, 10)}</p>
            <p className="mt-1 text-sm text-zinc-300 whitespace-pre-line">{u.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MessageThread({
  messages,
  onSend,
  currentUserId,
  sending,
  sendError,
}: {
  messages: Message[]
  onSend: (body: string) => Promise<void>
  currentUserId: string
  sending: boolean
  sendError?: string | null
}) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    await onSend(body)
  }

  return (
    <div className="forge-panel surface-card-strong flex flex-col">
      <div className="border-b border-zinc-700/40 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">Messages</h3>
      </div>

      <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-500">No messages yet. Ask a question below.</p>
        )}
        {messages.map((m) => {
          const isMe = m.author_id === currentUserId
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* v1.18.4 type-scale allowlist: a fixed 24x24px avatar-initial
                  glyph ("A"/"C"), redundant with the message bubble's own
                  side and colour coding. See
                  src/styles/typeScaleFloor.test.ts. */}
              <span className={`mt-1 h-6 w-6 shrink-0 rounded-full text-center text-[10px] leading-6 ${
                m.author_role === 'admin'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-zinc-700/60 text-zinc-300'
              }`}>
                {m.author_role === 'admin' ? 'A' : 'C'}
              </span>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                isMe ? 'bg-amber-500/15 text-zinc-100' : 'bg-zinc-800/60 text-zinc-200'
              }`}>
                {m.body}
                <p className="mt-1 text-scale-xs text-zinc-500">{m.created_at.slice(0, 16).replace('T', ' ')}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="border-t border-zinc-700/40 p-3 flex flex-col gap-2">
        {sendError && <p className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400">{sendError}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question or request an update…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="btn-accent btn-sm shrink-0 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// --- No-project state — shows client ID so admin can provision ---

export function NoProjectPanel({ sub }: { sub: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(sub).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      <div className="forge-panel surface-card-strong p-6 text-center">
        <p className="text-sm text-zinc-300">No project has been linked to your account yet.</p>
        <p className="mt-1 text-xs text-zinc-500">
          Once a project is assigned you'll see the full dashboard here.
        </p>
      </div>

      <div className="forge-panel surface-card-strong p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Your account ID</p>
        <p className="text-xs text-zinc-500">
          Share this with your account manager to link your project.
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-800/60 px-3 py-2 font-mono text-xs text-zinc-200">
            {sub}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
