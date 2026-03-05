const STEPS = [
  {
    number: '01',
    heading: 'Set a short-term goal',
    body: 'Describe what you want to accomplish — a sprint deliverable, a learning objective, or any project milestone up to 500 characters.',
    accent: 'border-amber-400/30 bg-amber-500/5',
    numColor: 'text-amber-500/50',
  },
  {
    number: '02',
    heading: 'Review AI task suggestions',
    body: 'The planner analyses your goal and existing workload to generate a focused, actionable list. Nothing is saved until you approve it.',
    accent: 'border-orange-400/30 bg-orange-500/5',
    numColor: 'text-orange-500/50',
  },
  {
    number: '03',
    heading: 'Create, track, and earn',
    body: 'Confirm the plan to add tasks to your board. Move cards across columns as you work. Every completion earns story points toward your next writing tier.',
    accent: 'border-emerald-400/30 bg-emerald-500/5',
    numColor: 'text-emerald-500/50',
  },
] as const

export function HowItWorksSection() {
  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-6 text-center text-xl font-semibold text-white">How it works</h2>

      <div className="relative grid gap-4 sm:grid-cols-3">
        {/* Connecting line visible on sm+ */}
        <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-emerald-500/20 sm:block" />

        {STEPS.map((step) => (
          <article
            key={step.number}
            className={`relative flex flex-col gap-3 rounded-2xl border p-5 ${step.accent}`}
          >
            <span className={`text-4xl font-black leading-none ${step.numColor}`}>
              {step.number}
            </span>
            <h3 className="text-sm font-semibold text-white">{step.heading}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">{step.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 text-center">
        <a
          href="#/guide"
          className="inline-block rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-100"
        >
          Read the full guide →
        </a>
      </div>
    </section>
  )
}
