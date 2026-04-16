import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import { PageLayout } from './PageLayout'
import { useAuth } from '../features/auth/AuthContext'
import { PROJECTS_API_BASE_URL, AUTH_SERVICE_URL } from '../config'

// --- Types ---

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  budget: number | null
  start_date: string | null
  target_end_date: string | null
}

interface Milestone {
  id: string
  project_id: string
  name: string
  description: string | null
  due_date: string | null
  status: string
  sort_order: number
}

interface Deliverable {
  id: string
  milestone_id: string
  name: string
  description: string | null
  status: string
  estimated_hours?: number | null
}

interface Message {
  id: string
  project_id: string
  author_id: string
  author_role: string
  body: string
  created_at: string
}

interface Collaborator {
  id: string
  project_id: string
  name: string
  role: string
  avatar_url: string | null
  created_at: string
}

interface ProgressUpdate {
  id: string
  project_id: string
  content: string
  created_at: string
}

interface ProjectLink {
  id: string
  link_type: string
  label: string
  url: string
  sort_order: number
}

interface ProjectEmail {
  id: string
  thread_id: string
  subject: string
  from_email: string
  snippet: string | null
  body_html: string | null
  received_at: string
}

// --- API helper ---

async function api<T>(path: string, token: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PROJECTS_API_BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

// --- Spinner ---

function Spinner() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      Loading your project…
    </div>
  )
}

// --- Login gate (shown inline when not authenticated) ---

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function ClientLoginGate() {
  const { login } = useAuth()
  const callback = encodeURIComponent(
    `${window.location.origin}${window.location.pathname}?#/portal`
  )
  function oauthUrl(provider: 'github' | 'google') {
    return `${AUTH_SERVICE_URL}/user/oauth/${provider}?scope=client_portal&redirect_uri=${callback}`
  }

  const [tab, setTab] = useState<'oauth' | 'email'>('oauth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!AUTH_SERVICE_URL) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'Login failed. Please check your credentials.')
        return
      }
      if (data.access_token) login(data.access_token)
    } catch {
      setError('Unable to reach the auth service.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4">
      <div className="forge-panel surface-card-strong w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/50 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Client portal</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Sign in with the account associated with your project.
          </p>
        </div>

        <div className="flex rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab('oauth')}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${tab === 'oauth' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Social sign-in
          </button>
          <button
            type="button"
            onClick={() => setTab('email')}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${tab === 'email' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Email & password
          </button>
        </div>

        {tab === 'oauth' && (
          AUTH_SERVICE_URL ? (
            <div className="space-y-3">
              <a
                href={oauthUrl('github')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500/60 hover:bg-zinc-700/60"
              >
                <GithubIcon />
                Continue with GitHub
              </a>
              <a
                href={oauthUrl('google')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500/60 hover:bg-zinc-700/60"
              >
                <GoogleIcon />
                Continue with Google
              </a>
            </div>
          ) : (
            <p className="text-xs text-amber-400">Auth service not configured (VITE_AUTH_SERVICE_URL).</p>
          )
        )}

        {tab === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-3">
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-accent w-full disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="flex justify-center">
              <a href="#/portal/forgot-password" className="text-xs text-zinc-500 hover:text-amber-300 transition">
                Forgot password?
              </a>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-zinc-500">
          Have an invite?{' '}
          <a href="#/portal/register" className="text-amber-400 hover:text-amber-300">
            Create your account
          </a>
        </p>
      </div>
    </div>
  )
}

// --- Client header bar ---

function ClientHeader({ claims, onLogout }: { claims: { sub: string; email?: string; username?: string }; onLogout: () => void }) {
  const display = claims.email ?? claims.username ?? claims.sub.slice(0, 12) + '…'
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 shrink-0 rounded-full bg-amber-500/20 text-center text-xs font-semibold leading-7 text-amber-300">
          {display[0]?.toUpperCase() ?? 'C'}
        </span>
        <span className="text-sm text-zinc-300">{display}</span>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        Sign out
      </button>
    </div>
  )
}

// --- Sub-components ---

const STATUS_STYLES: Record<string, string> = {
  planning:    'bg-zinc-700/40 text-zinc-300',
  active:      'bg-emerald-500/15 text-emerald-300',
  on_hold:     'bg-amber-500/15 text-amber-300',
  completed:   'bg-blue-500/15 text-blue-300',
  cancelled:   'bg-red-500/15 text-red-300',
  pending:     'bg-zinc-700/40 text-zinc-400',
  in_progress: 'bg-amber-500/15 text-amber-300',
  blocked:     'bg-red-500/15 text-red-400',
  done:        'bg-emerald-500/15 text-emerald-300',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status.toLowerCase()] ?? 'bg-zinc-700/40 text-zinc-400'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function ProjectSummaryCard({
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
    ? Math.ceil(
        (new Date(project.target_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
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

function LinksSection({ links }: { links: ProjectLink[] }) {
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

function EmailsSection({ emails }: { emails: ProjectEmail[] }) {
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
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: email.body_html }}
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

function MilestoneCard({ milestone, deliverables }: { milestone: Milestone; deliverables: Deliverable[] }) {
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

function CollaboratorsSection({ collaborators }: { collaborators: Collaborator[] }) {
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
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-semibold text-amber-300">
                {c.name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <div>
              <p className="text-xs font-medium text-zinc-200">{c.name}</p>
              <p className="text-[10px] text-zinc-500">{c.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressUpdatesSection({ updates }: { updates: ProgressUpdate[] }) {
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

function MessageThread({
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
                <p className="mt-1 text-[10px] text-zinc-500">{m.created_at.slice(0, 16).replace('T', ' ')}</p>
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

function NoProjectPanel({ sub }: { sub: string }) {
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

// --- Main page ---

export function PortalPage() {
  const { token, claims, login, logout } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [deliverablesByMilestone, setDeliverablesByMilestone] = useState<Record<string, Deliverable[]>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([])
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [emails, setEmails] = useState<ProjectEmail[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'no_project'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const tryRefresh = useCallback(async (): Promise<string | null> => {
    if (!AUTH_SERVICE_URL) return null
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) { logout(); return null }
      const { access_token } = await res.json() as { access_token: string }
      login(access_token)
      return access_token
    } catch {
      logout()
      return null
    }
  }, [login, logout])

  const load = useCallback(async () => {
    if (!token) return
    setStatus('loading')
    setError(null)

    try {
      const projects = await api<Project[]>('/api/v1/projects', token)
      if (projects.length === 0) {
        setStatus('no_project')
        return
      }

      const p = projects[0]
      setProject(p)

      const [ms, msgs, lnks, emls, collabs, updates] = await Promise.all([
        api<Milestone[]>(`/api/v1/projects/${p.id}/milestones`, token),
        api<Message[]>(`/api/v1/projects/${p.id}/messages`, token),
        api<ProjectLink[]>(`/api/v1/projects/${p.id}/links`, token).catch(() => [] as ProjectLink[]),
        api<ProjectEmail[]>(`/api/v1/projects/${p.id}/emails`, token).catch(() => [] as ProjectEmail[]),
        api<Collaborator[]>(`/api/v1/projects/${p.id}/collaborators`, token).catch(() => [] as Collaborator[]),
        api<ProgressUpdate[]>(`/api/v1/projects/${p.id}/progress-updates`, token).catch(() => [] as ProgressUpdate[]),
      ])

      const sorted = [...ms].sort((a, b) => a.sort_order - b.sort_order)
      setMilestones(sorted)
      setMessages(msgs)
      setLinks(lnks)
      setEmails(emls)
      setCollaborators(collabs)
      setProgressUpdates(updates)

      const deliverables = await Promise.all(
        sorted.map((m) =>
          api<Deliverable[]>(`/api/v1/milestones/${m.id}/deliverables`, token)
            .then((ds) => ({ id: m.id, ds }))
            .catch(() => ({ id: m.id, ds: [] }))
        )
      )

      const byId: Record<string, Deliverable[]> = {}
      deliverables.forEach(({ id, ds }) => { byId[id] = ds })
      setDeliverablesByMilestone(byId)
      setStatus('idle')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to load project data'
      if (errMsg.includes('401')) {
        await tryRefresh() // on success, token state changes → useEffect re-runs load()
        return
      }
      setError(errMsg)
      setStatus('error')
    }
  }, [token, tryRefresh])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  const sendMessage = async (body: string) => {
    if (!token || !project) return
    setSending(true)
    setSendError(null)
    try {
      const msg = await api<Message>(
        `/api/v1/projects/${project.id}/messages`,
        token,
        { method: 'POST', body: JSON.stringify({ body }) }
      )
      setMessages((prev) => [...prev, msg])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : ''
      if (errMsg.includes('401')) {
        const newToken = await tryRefresh()
        if (newToken) {
          try {
            const retryMsg = await api<Message>(
              `/api/v1/projects/${project.id}/messages`,
              newToken,
              { method: 'POST', body: JSON.stringify({ body }) }
            )
            setMessages((prev) => [...prev, retryMsg])
            return
          } catch { /* fall through to set error */ }
        } else {
          return // logout triggered, login gate will appear
        }
      }
      setSendError(errMsg || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  if (!PROJECTS_API_BASE_URL) {
    return (
      <PageLayout title="Client portal">
        <p className="text-sm text-amber-400">VITE_PROJECTS_API_BASE_URL is not configured.</p>
      </PageLayout>
    )
  }

  // Not authenticated — show inline login gate
  if (!token) {
    return (
      <PageLayout title="Client portal">
        <ClientLoginGate />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Client portal">
      <ClientHeader claims={claims!} onLogout={logout} />

      {status === 'loading' && <Spinner />}

      {status === 'error' && (
        <div className="forge-panel surface-card-strong p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button className="btn-neutral btn-sm mt-3" onClick={load}>Retry</button>
        </div>
      )}

      {status === 'no_project' && claims && (
        <NoProjectPanel sub={claims.sub} />
      )}

      {status === 'idle' && project && (
        <div className="space-y-5">
          <ProjectSummaryCard
            project={project}
            deliverablesByMilestone={deliverablesByMilestone}
          />
          <CollaboratorsSection collaborators={collaborators} />
          <ProgressUpdatesSection updates={progressUpdates} />
          <LinksSection links={links} />

          {milestones.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Timeline</h3>
              {milestones.map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  deliverables={deliverablesByMilestone[m.id] ?? []}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No milestones have been set yet.</p>
          )}

          <EmailsSection emails={emails} />

          <MessageThread
            messages={messages}
            onSend={sendMessage}
            currentUserId={claims?.sub ?? ''}
            sending={sending}
            sendError={sendError}
          />
        </div>
      )}
    </PageLayout>
  )
}
