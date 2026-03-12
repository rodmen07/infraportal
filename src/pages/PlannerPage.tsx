import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { AI_ORCHESTRATOR_URL } from '../config'

type PlannerState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; items: string[] }
  | { phase: 'error'; message: string }
  | { phase: 'disabled' }

export function PlannerPage() {
  const [goal, setGoal] = useState('')
  const [state, setState] = useState<PlannerState>(
    AI_ORCHESTRATOR_URL ? { phase: 'idle' } : { phase: 'disabled' }
  )
  const [copied, setCopied] = useState(false)

  async function generate() {
    const trimmed = goal.trim()
    if (!trimmed || !AI_ORCHESTRATOR_URL) return

    setState({ phase: 'loading' })
    try {
      const r = await fetch(`${AI_ORCHESTRATOR_URL}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: trimmed, target_count: 16 }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${r.status}`)
      }
      const data = await r.json()
      const items: string[] = data.tasks ?? []
      if (items.length === 0) throw new Error('No roadmap items returned')
      setState({ phase: 'ready', items })
    } catch (e) {
      setState({ phase: 'error', message: (e as Error).message })
    }
  }

  function copyList(items: string[]) {
    const text = items.map((item, i) => `${i + 1}. ${item}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-white">Cloud Project Roadmap Generator</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Describe your cloud project idea — get a concrete 12–20 step roadmap from Claude AI
            covering infrastructure, security, CI/CD, observability, and cost.
          </p>
        </div>
      </section>

      {/* Input */}
      <section className="forge-panel rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-5 backdrop-blur-xl">
        <label className="mb-2 block text-sm font-semibold text-zinc-300">Project idea</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Build a multi-region data pipeline on AWS that ingests CloudTrail events, normalises them through a medallion architecture, and delivers analytics to a dashboard"
          rows={4}
          disabled={state.phase === 'loading' || state.phase === 'disabled'}
          className="w-full resize-none rounded-xl border border-zinc-600/40 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate()
          }}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={generate}
            disabled={state.phase === 'loading' || state.phase === 'disabled' || !goal.trim()}
            className="btn-accent px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.phase === 'loading' ? 'Generating…' : 'Generate roadmap →'}
          </button>
          <span className="text-xs text-zinc-600">or Cmd+Enter</span>
        </div>

        {state.phase === 'disabled' && (
          <p className="mt-3 text-xs text-zinc-500">
            AI planner is not configured in this deployment.
          </p>
        )}
      </section>

      {/* Loading skeleton */}
      {state.phase === 'loading' && (
        <section className="forge-panel rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <span className="text-sm font-semibold text-zinc-300">Building your roadmap…</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-lg border border-zinc-700/40 bg-zinc-800/50"
                style={{ opacity: 1 - i * 0.08 }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <section className="forge-panel rounded-2xl border border-red-500/30 bg-red-950/20 p-5">
          <p className="text-sm font-medium text-red-300">Failed to generate roadmap</p>
          <p className="mt-1 text-xs text-red-400/80">{state.message}</p>
          <button
            onClick={generate}
            className="mt-3 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
          >
            Try again
          </button>
        </section>
      )}

      {/* Results */}
      {state.phase === 'ready' && (
        <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-zinc-700/40 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-white">Cloud Roadmap</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{state.items.length} milestones</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyList(state.items)}
                className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
              >
                {copied ? 'Copied!' : 'Copy as list'}
              </button>
              <button
                onClick={generate}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:border-amber-500/60 hover:bg-amber-500/20"
              >
                Regenerate
              </button>
            </div>
          </div>
          <ol className="divide-y divide-zinc-800/60">
            {state.items.map((item, i) => (
              <li key={i} className="flex items-start gap-4 px-5 py-3.5">
                <span className="mt-0.5 shrink-0 text-sm font-bold text-amber-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm leading-relaxed text-zinc-200">{item}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* CTA */}
      <div className="text-center">
        <a
          href="#/contact"
          className="inline-block rounded-xl border border-amber-400/40 bg-amber-500/15 px-6 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
        >
          Start your own cloud project →
        </a>
      </div>
    </PageLayout>
  )
}
