import { API_BASE_URL } from '../../config'
import type { SiteContent } from '../../types'

interface SiteHeaderProps {
  content: SiteContent
}

export function SiteHeader({ content }: SiteHeaderProps) {
  return (
    <header className="forge-panel rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">{content.title}</h1>
      <p className="mt-3 max-w-3xl text-zinc-300">{content.subtitle}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          className="inline-flex items-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
          href={content.ctaHref}
        >
          {content.ctaLabel}
        </a>
        <span className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-xs text-zinc-300">
          API: {API_BASE_URL}
        </span>
      </div>
    </header>
  )
}
