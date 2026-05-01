import { useState, useEffect } from 'react'
import { MONITORING_URL } from '../../config'

type MetricsState =
  | { phase: 'disabled' }
  | { phase: 'loading' }
  | { phase: 'ready'; counts: Record<string, number>; fetchedAt: Date }
  | { phase: 'error' }

export function PipelineMetrics() {
  const [state, setState] = useState<MetricsState>(
    MONITORING_URL ? { phase: 'loading' } : { phase: 'disabled' }
  )

  useEffect(() => {
    if (!MONITORING_URL) return

    const controller = new AbortController()

    async function load() {
      try {
        const r = await fetch(`${MONITORING_URL}/api/stats`, {
          signal: controller.signal,
        })
        if (!r.ok) throw new Error()
        const data = await r.json()
        setState({ phase: 'ready', counts: data.counts ?? {}, fetchedAt: new Date() })
      } catch {
        if (!controller.signal.aborted) {
          setState((prev) => (prev.phase === 'ready' ? prev : { phase: 'error' }))
        }
      }
    }

    load()
    const interval = setInterval(load, 60_000)

    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [])

  if (state.phase === 'disabled' || state.phase === 'error') return null

  if (state.phase === 'loading') {
    return (
      <div className="forge-panel rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-5 backdrop-blur-xl">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-zinc-800/60" />
        <div className="flex flex-col gap-3">
          {[80, 60, 40].map((w) => (
            <div key={w} className="flex flex-col gap-1">
              <div className="h-3 animate-pulse rounded bg-zinc-800/60" style={{ width: `${w}%` }} />
              <div className="h-2.5 animate-pulse rounded-full bg-zinc-800/60" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { counts, fetchedAt } = state
  const bronzeTotal = (counts.bronze ?? 0) + (counts.bronze_cleaned ?? 0)
  const silver = counts.silver ?? 0
  const gold = counts.gold ?? 0

  const stages = [
    {
      label: 'Bronze',
      count: bronzeTotal,
      color: 'bg-orange-500/60',
      yieldLabel: null as string | null,
    },
    {
      label: 'Silver',
      count: silver,
      color: 'bg-zinc-400/60',
      yieldLabel: bronzeTotal > 0 ? `↓ ${Math.round((silver / bronzeTotal) * 100)}% of bronze` : null,
    },
    {
      label: 'Gold',
      count: gold,
      color: 'bg-amber-400/60',
      yieldLabel: silver > 0 ? `↓ ${Math.round((gold / silver) * 100)}% of silver` : null,
    },
  ]

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="forge-panel rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Live Pipeline</h2>
          <p className="text-xs text-zinc-500">DynamoDB record counts</p>
        </div>
        <p className="shrink-0 text-[10px] text-zinc-600">Updated {fmtTime(fetchedAt)}</p>
      </div>
      <div className="flex flex-col gap-3">
        {stages.map(({ label, count, color, yieldLabel }) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">{label}</span>
              <div className="flex items-center gap-3">
                {yieldLabel && <span className="text-zinc-500">{yieldLabel}</span>}
                <span className="font-mono text-zinc-200">{count.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${bronzeTotal > 0 ? (count / bronzeTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
