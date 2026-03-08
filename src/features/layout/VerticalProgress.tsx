interface VerticalProgressProps {
  completionPercent: number
  completedCount: number
  pendingLabel: number
  isAuthenticated: boolean
  currentSubject: string
}

export function VerticalProgress({
  completionPercent,
  completedCount,
  pendingLabel,
  isAuthenticated,
  currentSubject,
}: VerticalProgressProps) {
  return (
    <aside className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-500/30 bg-zinc-900/70 px-3 py-4 shadow-xl shadow-black/40 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Progress</p>

      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] text-zinc-400">{completedCount} done</span>

        <div className="relative h-48 w-3 overflow-hidden rounded-full bg-zinc-800/90">
          <div
            className="absolute bottom-0 w-full rounded-full bg-gradient-to-t from-amber-400 via-orange-400 to-emerald-400 transition-all duration-500"
            style={{ height: `${completionPercent}%` }}
          />
        </div>

        <span className="text-[10px] text-zinc-400">{pendingLabel} left</span>
      </div>

      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-200">
        {completionPercent}%
      </div>

      <div className="max-w-[4.5rem] break-all text-center text-[9px] leading-tight text-zinc-500">
        {isAuthenticated ? currentSubject || 'user' : 'guest'}
      </div>
    </aside>
  )
}
