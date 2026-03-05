interface QuickStartSectionProps {
  isAuthenticated: boolean
  hasAnyTask: boolean
  hasAiTask: boolean
  hasCompletedTask: boolean
}

interface Step {
  label: string
  description: string
  done: boolean
}

function StepRow({ step, index, isNext }: { step: Step; index: number; isNext: boolean }) {
  return (
    <li
      className={`flex items-start gap-4 rounded-xl border p-4 transition-all duration-300 ${
        step.done
          ? 'border-emerald-400/30 bg-emerald-500/8'
          : isNext
          ? 'border-amber-400/30 bg-amber-500/8'
          : 'border-zinc-700/40 bg-zinc-800/30 opacity-60'
      }`}
    >
      {/* Status indicator */}
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          step.done
            ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
            : isNext
            ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
            : 'border-zinc-600/50 bg-zinc-700/30 text-zinc-500'
        }`}
      >
        {step.done ? '✓' : index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            step.done ? 'text-emerald-200 line-through decoration-emerald-500/40' : isNext ? 'text-amber-100' : 'text-zinc-400'
          }`}
        >
          {step.label}
        </p>
        <p className={`mt-0.5 text-xs leading-relaxed ${step.done ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {step.description}
        </p>
      </div>

      {isNext && !step.done && (
        <span className="shrink-0 self-center rounded-md border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          Next
        </span>
      )}
    </li>
  )
}

export function QuickStartSection({
  isAuthenticated,
  hasAnyTask,
  hasAiTask,
  hasCompletedTask,
}: QuickStartSectionProps) {
  const steps: Step[] = [
    {
      label: 'Sign in with a username',
      description: 'Create or reuse a username to access your personal task workspace and persist progress across sessions.',
      done: isAuthenticated,
    },
    {
      label: 'Generate your first AI plan',
      description: 'Enter a short-term goal and click Generate. Review the suggested tasks before adding them to your board.',
      done: hasAiTask,
    },
    {
      label: 'Create your first task',
      description: 'Accept a generated plan or add a task manually with a title, goal, and difficulty rating.',
      done: hasAnyTask,
    },
    {
      label: 'Complete your first task',
      description: 'Mark a task as Done to earn your first story points and start climbing the writing tiers.',
      done: hasCompletedTask,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length
  const nextIndex = steps.findIndex((s) => !s.done)
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Quick start</h2>
          <p className="mt-0.5 text-sm text-zinc-400">
            {allDone ? 'You\'re all set — enjoy the full experience.' : `${doneCount} of ${steps.length} steps complete`}
          </p>
        </div>

        {allDone ? (
          <span className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300">
            Complete ✓
          </span>
        ) : (
          <span className="text-2xl font-black text-amber-500/60">{pct}%</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-zinc-700/60">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${
            allDone
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : 'bg-gradient-to-r from-amber-500 to-orange-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-2">
        {steps.map((step, i) => (
          <StepRow
            key={step.label}
            step={step}
            index={i}
            isNext={i === nextIndex}
          />
        ))}
      </ul>

      <div className="mt-4 border-t border-zinc-700/40 pt-4 text-center">
        <a
          href="#/tiers"
          className="text-xs font-medium text-zinc-400 transition hover:text-amber-300"
        >
          View tier progression →
        </a>
      </div>
    </section>
  )
}
