import { useGitHubBuildStatus } from './useGitHubBuildStatus'
import { formatRelativeTime } from '../../utils/time'

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

interface BuildStatusBadgesProps {
  repos: string[]
  owner?: string
}

export function BuildStatusBadges({ repos, owner = 'rodmen07' }: BuildStatusBadgesProps) {
  const state = useGitHubBuildStatus(owner, repos)

  if (state.phase === 'error') return null

  return (
    <section className="forge-panel rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-300">Live CI/CD</span>
        <a
          href={`https://github.com/${owner}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          GitHub →
        </a>
      </div>

      {state.phase === 'loading' ? (
        <div className="flex flex-wrap gap-2">
          {repos.map((r) => (
            <div
              key={r}
              className="h-8 w-40 animate-pulse rounded-xl border border-zinc-700/40 bg-zinc-800/50"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state.items.map((item) => {
            const ds = item.display_status in DOT_CLASS ? item.display_status : 'unknown'
            return (
              <a
                key={item.repo}
                href={item.html_url || `https://github.com/${owner}/${item.repo}/actions`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-zinc-700/40 bg-zinc-800/50 px-3 py-1.5 text-sm transition hover:border-zinc-600/50"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[ds]}`} />
                <span className="font-medium text-zinc-200">{item.repo}</span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASS[ds]}`}
                >
                  {STATUS_TEXT[ds]}
                </span>
                {item.run_at && (
                  <span className="text-xs text-zinc-500">{formatRelativeTime(item.run_at)}</span>
                )}
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
