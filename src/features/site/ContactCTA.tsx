export function ContactCTA() {
  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-white">Ready to talk?</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Book a free 30-minute discovery call or send a message — no commitment required.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a
          href="mailto:rodmendoza07@gmail.com"
          className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
        >
          Email me →
        </a>
        <a
          href="https://www.linkedin.com/in/roderick-mendoza-9133b7b5/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          LinkedIn →
        </a>
      </div>
    </section>
  )
}
