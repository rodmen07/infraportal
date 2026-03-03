import type { AdminMetrics, AdminRequestLog, AdminUserActivity } from '../../types'

interface AdminDashboardSectionProps {
  loading: boolean
  error: string
  metrics: AdminMetrics | null
  requestLogs: AdminRequestLog[]
  userActivity: AdminUserActivity[]
  onRefresh: () => void
}

function formatDate(isoValue: string): string {
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) {
    return isoValue
  }

  return parsed.toLocaleString()
}

export function AdminDashboardSection({
  loading,
  error,
  metrics,
  requestLogs,
  userActivity,
  onRefresh,
}: AdminDashboardSectionProps) {
  return (
    <section className="forge-panel rounded-3xl border border-indigo-300/20 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Admin Dashboard</h2>
        <button
          type="button"
          className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {metrics && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <p className="rounded-xl border border-zinc-500/35 bg-zinc-800/70 px-3 py-2 text-sm text-zinc-100">
            Total Tasks: <strong>{metrics.total_tasks}</strong>
          </p>
          <p className="rounded-xl border border-zinc-500/35 bg-zinc-800/70 px-3 py-2 text-sm text-zinc-100">
            Completed: <strong>{metrics.completed_tasks}</strong>
          </p>
          <p className="rounded-xl border border-zinc-500/35 bg-zinc-800/70 px-3 py-2 text-sm text-zinc-100">
            Pending: <strong>{metrics.pending_tasks}</strong>
          </p>
          <p className="rounded-xl border border-zinc-500/35 bg-zinc-800/70 px-3 py-2 text-sm text-zinc-100">
            API Requests: <strong>{metrics.total_requests}</strong>
          </p>
          <p className="rounded-xl border border-zinc-500/35 bg-zinc-800/70 px-3 py-2 text-sm text-zinc-100">
            Unique Users: <strong>{metrics.unique_subjects}</strong>
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-500/35 bg-zinc-800/70 p-4">
          <h3 className="mb-2 text-base font-semibold text-white">Recent User Activity</h3>
          {userActivity.length === 0 ? (
            <p className="text-sm text-zinc-300">No user activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-200">
              {userActivity.map((row) => (
                <li key={row.subject} className="rounded-lg border border-zinc-600/40 bg-zinc-900/60 px-3 py-2">
                  <div className="font-medium text-amber-200">{row.subject}</div>
                  <div>Requests: {row.request_count}</div>
                  <div className="text-xs text-zinc-400">Last seen: {formatDate(row.last_seen_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-500/35 bg-zinc-800/70 p-4">
          <h3 className="mb-2 text-base font-semibold text-white">Recent API Requests</h3>
          {requestLogs.length === 0 ? (
            <p className="text-sm text-zinc-300">No request logs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-200">
              {requestLogs.map((row) => (
                <li key={row.id} className="rounded-lg border border-zinc-600/40 bg-zinc-900/60 px-3 py-2">
                  <div className="font-medium text-zinc-100">
                    {row.method} {row.path}
                  </div>
                  <div>
                    Status: {row.status_code} · {row.duration_ms}ms
                  </div>
                  <div className="text-xs text-zinc-400">
                    {row.subject || 'anonymous'} · {formatDate(row.occurred_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
