import { PageLayout } from './PageLayout'

const TIERS = [
  {
    name: 'Poem',
    icon: '📜',
    minSp: 0,
    nextSp: 6,
    color: 'border-zinc-600/50 bg-zinc-800/50',
    badge: 'border-zinc-500/40 bg-zinc-700/50 text-zinc-300',
    label: 'Starting tier',
    description: 'Every writer starts here. Create your first tasks and earn your first story points.',
  },
  {
    name: 'Paragraph',
    icon: '📝',
    minSp: 6,
    nextSp: 15,
    color: 'border-sky-500/30 bg-sky-900/20',
    badge: 'border-sky-400/40 bg-sky-500/20 text-sky-200',
    label: '6 SP required',
    description: 'You\'ve built momentum. A few completed tasks under your belt and your workflow is forming.',
  },
  {
    name: 'Short Story',
    icon: '📖',
    minSp: 15,
    nextSp: 30,
    color: 'border-amber-500/30 bg-amber-900/20',
    badge: 'border-amber-400/40 bg-amber-500/20 text-amber-200',
    label: '15 SP required',
    description: 'You\'re shipping consistently. Goals are being set and met. The board is your canvas.',
  },
  {
    name: 'Novel',
    icon: '📚',
    minSp: 30,
    nextSp: 50,
    color: 'border-orange-500/30 bg-orange-900/20',
    badge: 'border-orange-400/40 bg-orange-500/20 text-orange-200',
    label: '30 SP required',
    description: 'Serious output. You\'re tackling high-difficulty tasks and managing multiple goals at once.',
  },
  {
    name: 'Epic',
    icon: '⚡',
    minSp: 50,
    nextSp: null,
    color: 'border-emerald-500/30 bg-emerald-900/20',
    badge: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
    label: '50 SP required',
    description: 'The highest writing tier. You\'ve proven you can plan ambitiously and execute relentlessly.',
  },
]

const DIFFICULTY_ROWS = [
  { sp: 1, label: 'Trivial', example: 'Reply to an email, minor copy edit' },
  { sp: 2, label: 'Easy', example: 'Write a short report, fix a small bug' },
  { sp: 3, label: 'Medium', example: 'Feature write-up, one-day research task' },
  { sp: 4, label: 'Hard', example: 'Complex deliverable, multi-step analysis' },
  { sp: 5, label: 'Very Hard', example: 'Week-long sprint, architectural decision' },
  { sp: 6, label: 'Epic', example: 'Major milestone, cross-team coordination' },
]

export function TiersPage() {
  return (
    <PageLayout title="Writing Tiers">
      {/* Intro */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <p className="text-sm leading-relaxed text-zinc-300">
          Every task you complete earns <span className="font-semibold text-amber-300">story points</span> equal to its
          difficulty rating. Accumulate enough points to climb through five writing tiers — from a first Poem to an
          Epic. Points persist across sessions for your username.
        </p>
      </section>

      {/* Tier cards */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="mb-5 text-lg font-semibold text-white">Tier progression</h2>
        <div className="space-y-3">
          {TIERS.map((tier, i) => (
            <article key={tier.name} className={`flex items-start gap-4 rounded-2xl border p-4 ${tier.color}`}>
              <span className="text-3xl leading-none">{tier.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">{tier.name}</h3>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tier.badge}`}>
                    {tier.label}
                  </span>
                  {tier.nextSp && (
                    <span className="text-xs text-zinc-500">→ {tier.nextSp} SP for next tier</span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{tier.description}</p>
              </div>
              <span className="shrink-0 self-center text-2xl font-black text-zinc-600">{i + 1}</span>
            </article>
          ))}
        </div>
      </section>

      {/* Difficulty table */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="mb-5 text-lg font-semibold text-white">Difficulty ratings</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Each task has a difficulty from 1 to 6. Completing it awards that many story points. Higher difficulty =
          faster tier progression.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/60 text-left">
                <th className="pb-2 pr-4 font-semibold text-zinc-400">SP</th>
                <th className="pb-2 pr-4 font-semibold text-zinc-400">Label</th>
                <th className="pb-2 font-semibold text-zinc-400">Example tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {DIFFICULTY_ROWS.map((row) => (
                <tr key={row.sp}>
                  <td className="py-2.5 pr-4">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 text-xs font-bold text-amber-300">
                      {row.sp}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-zinc-200">{row.label}</td>
                  <td className="py-2.5 text-zinc-400">{row.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tips */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Tips for climbing faster</h2>
        <ul className="space-y-2 text-sm text-zinc-300">
          {[
            'Use the AI planner to break ambitious goals into manageable, high-difficulty tasks.',
            'Don\'t under-rate tasks. If something takes half a day, it\'s at least a 3.',
            'Complete tasks in batches — seeing the Kanban board empty a column feels great.',
            'Set a goal per sprint so the Goal Tracking panel shows real progress.',
            'Points persist across browser sessions for your username — always sign in.',
          ].map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-400">›</span>
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {/* Back CTA */}
      <div className="text-center">
        <a
          href="#/"
          className="inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          ← Back to home
        </a>
      </div>
    </PageLayout>
  )
}
