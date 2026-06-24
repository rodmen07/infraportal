import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_ONBOARDING_STEPS,
  getCompletedStepIds,
  setStepCompleted,
} from './onboardingStore'

export function OnboardingChecklist({ projectId }: { projectId: string }) {
  const [completed, setCompleted] = useState<string[]>(() => getCompletedStepIds(projectId))

  useEffect(() => {
    setCompleted(getCompletedStepIds(projectId))
  }, [projectId])

  const completedSet = useMemo(() => new Set(completed), [completed])
  const total = DEFAULT_ONBOARDING_STEPS.length
  const doneCount = completed.length
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100)
  const allDone = doneCount === total

  const toggle = (stepId: string, isDone: boolean) => {
    setCompleted(setStepCompleted(projectId, stepId, !isDone))
  }

  return (
    <div className="forge-panel surface-card-strong p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Launch onboarding</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-100">Steps to get you live</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Track what is done and what is still pending before your launch.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            allDone
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          }`}
        >
          {doneCount} of {total} complete
        </span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {DEFAULT_ONBOARDING_STEPS.map((step) => {
          const isDone = completedSet.has(step.id)
          return (
            <li key={step.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600/60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggle(step.id, isDone)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/40"
                />
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${isDone ? 'text-emerald-200 line-through' : 'text-zinc-100'}`}>
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-400">{step.description}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
