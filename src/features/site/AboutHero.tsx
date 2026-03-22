export function AboutHero() {
  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10">
          <span className="text-2xl font-black text-amber-300">RM</span>
        </div>
        <div className="flex-1">
          <p className="text-xl font-bold text-white">Roderick Mendoza</p>
          <p className="mt-1 text-sm text-amber-300/80">Cloud & Infrastructure Consultant</p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            I help founders and small product teams move from idea to reliable production systems
            without hiring a full internal platform team too early. My work spans full-stack
            implementation, cloud infrastructure, and operational handoff, with a focus on
            AWS/GCP, Terraform, CI/CD, and secure delivery patterns.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              View the work →
            </a>
            <a
              href="https://github.com/rodmen07"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              GitHub →
            </a>
            <a
              href="https://www.linkedin.com/in/roderick-mendoza-9133b7b5/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              LinkedIn →
            </a>
            <a
              href="https://www.upwork.com/freelancers/~01d4b41a81a0ae3ec6?mp_source=share"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              Upwork →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
