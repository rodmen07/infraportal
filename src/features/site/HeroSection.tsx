import type { SiteContent } from '../../types'

interface HeroSectionProps {
  content: SiteContent
}

export function HeroSection({ content }: HeroSectionProps) {
  return (
    <header className="forge-panel rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-12">
      <h1 className="reveal text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
        {content.title}
      </h1>
      <p className="reveal reveal-delay-1 mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
        {content.subtitle}
      </p>
      <div className="reveal reveal-delay-2 mt-8 flex flex-wrap justify-center gap-3">
        <a
          href="#/case-studies"
          className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
        >
          See the work →
        </a>
        <a
          href="#/contact"
          className="rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          Book a free call →
        </a>
      </div>
    </header>
  )
}
