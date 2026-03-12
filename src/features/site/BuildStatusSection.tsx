import { MONITORING_URL } from '../../config'
import { useBuildStatus } from './useBuildStatus'

function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

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

export function BuildStatusSection() {
  const state = useBuildStatus()

  if (state.phase === 'disabled' || state.phase === 'error') return null

  return (
    <section
      id="build-status"
      className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">CI/CD Status</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Live build status for active repositories. Refreshes every 60 seconds.
          </p>
        </div>
        <a
          href={`${MONITORING_URL}/builds`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-xl border border-zinc-600/40 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/50 hover:text-zinc-100"
        >
          Full dashboard →
        </a>
      </div>

      {state.phase === 'loading' ? (
        <div className="flex flex-wrap gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-9 w-36 animate-pulse rounded-xl border border-zinc-700/40 bg-zinc-800/50"
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
                href={item.html_url || `${MONITORING_URL}/builds`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-zinc-700/40 bg-zinc-800/50 px-3 py-2 text-sm transition hover:border-zinc-600/50"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[ds]}`}
                />
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
