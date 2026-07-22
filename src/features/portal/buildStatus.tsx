import { useGitHubBuildStatus, type GhBuildItem } from '../site/useGitHubBuildStatus'
import { formatRelativeTime } from '../../utils/time'
import type { Project, ProjectLink } from './types'

// --- CI/CD build status for client project repos ---

const DOT_CLASS: Record<string, string> = {
  green:   'bg-emerald-400',
  yellow:  'bg-amber-400',
  red:     'bg-red-400',
  unknown: 'bg-zinc-600',
}

const STATUS_TEXT: Record<string, string> = {
  green:   'Passing',
  yellow:  'Running',
  red:     'Failed',
  unknown: 'Unknown',
}

const STATUS_CLASS: Record<string, string> = {
  green:   'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  yellow:  'border-amber-400/40 bg-amber-500/10 text-amber-300',
  red:     'border-red-400/40 bg-red-500/10 text-red-300',
  unknown: 'border-zinc-600/40 bg-zinc-700/30 text-zinc-500',
}

function RepoBadge({ item }: { item: GhBuildItem }) {
  const ds = item.display_status in DOT_CLASS ? item.display_status : 'unknown'
  return (
    <a
      href={item.html_url || `https://github.com/${item.repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-zinc-700/40 bg-zinc-800/50 px-3 py-2 text-sm transition hover:border-zinc-600/50"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[ds]}`} />
      <span className="font-medium text-zinc-200">{item.repo}</span>
      <span className={`shrink-0 rounded border px-1.5 py-px text-scale-xs font-semibold uppercase tracking-wide ${STATUS_CLASS[ds]}`}>
        {STATUS_TEXT[ds]}
      </span>
      {item.run_at && (
        <span className="text-xs text-zinc-500">{formatRelativeTime(item.run_at)}</span>
      )}
    </a>
  )
}

export function ManagedServiceSnapshot({ project }: { project: Project }) {
  return (
    <div className="forge-panel surface-card-strong p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Managed service snapshot</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-100">Your hosting and delivery workspace</h2>
          <p className="mt-1 text-sm text-zinc-400">
            A simple view of the operational side while your product stays live and supported.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          On track
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-3">
          <p className="text-scale-xs font-semibold uppercase tracking-wide text-zinc-500">Deployment</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">Configured</p>
          <p className="mt-1 text-xs text-zinc-400">Domain and SSL are ready</p>
        </div>
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-3">
          <p className="text-scale-xs font-semibold uppercase tracking-wide text-zinc-500">Support</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">Priority queue</p>
          <p className="mt-1 text-xs text-zinc-400">Questions are routed quickly</p>
        </div>
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-3">
          <p className="text-scale-xs font-semibold uppercase tracking-wide text-zinc-500">Maintenance</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">Weekly review</p>
          <p className="mt-1 text-xs text-zinc-400">Updates and checks happen on schedule</p>
        </div>
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-3">
          <p className="text-scale-xs font-semibold uppercase tracking-wide text-zinc-500">Project status</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{project.status.replace('_', ' ')}</p>
          <p className="mt-1 text-xs text-zinc-400">Managed with clear milestones</p>
        </div>
      </div>
    </div>
  )
}

export function ProjectRepoBuildStatus({ links }: { links: ProjectLink[] }) {
  const githubLinks = links.filter(l => /github\.com\/([^/]+)\/([^/]+)/.test(l.url))

  const parsed = githubLinks.map(l => {
    const m = l.url.match(/github\.com\/([^/]+)\/([^/]+)/)
    return m ? { owner: m[1], repo: m[2].replace(/\/$/, '') } : null
  }).filter(Boolean) as { owner: string; repo: string }[]

  const owner = parsed[0]?.owner ?? ''
  const repos = parsed.filter(p => p.owner === owner).map(p => p.repo)

  const state = useGitHubBuildStatus(owner, repos)

  if (!parsed.length) return null

  return (
    <div className="forge-panel surface-card-strong p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Build Status</h3>
        <span className="text-xs text-zinc-500">Updates every 2 min</span>
      </div>
      {state.phase === 'loading' && (
        <div className="flex flex-wrap gap-2">
          {repos.map(r => (
            <div key={r} className="h-9 w-36 animate-pulse rounded-xl border border-zinc-700/40 bg-zinc-800/50" />
          ))}
        </div>
      )}
      {state.phase === 'ready' && (
        <div className="flex flex-wrap gap-2">
          {state.items.map(item => <RepoBadge key={item.repo} item={item} />)}
        </div>
      )}
      {state.phase === 'error' && (
        <p className="text-xs text-zinc-500">Unable to load build status.</p>
      )}
    </div>
  )
}
