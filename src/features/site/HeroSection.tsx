import type { SiteContent } from '../../types'
import { SCHEDULING_URL } from '../../config'
import { trackPortfolioEvent } from '../../utils/analytics'

interface HeroSectionProps {
  content: SiteContent
}

// v1.18.3 (D6, calm hero motion): this used to render an infinitely
// pulsing, wiggling gradient badge whose only payoff was a slide-over
// containing the site's animation-preference checkbox - a promotional
// flourish that outcompeted the booking CTA for attention (finding F6).
// That badge, the floating h1 (`animate-float-slow`), and the slide-over
// are gone. What survives per D6: the one-time `.reveal`/`.reveal-delay-N`
// entrance (already reduced-motion safe via the shared @media
// (prefers-reduced-motion: reduce) block in src/index.css - the
// established pattern this repo reuses everywhere rather than inventing a
// second one). The animation-preference control itself is not deleted,
// it moved to the About page: see MotionPreferenceToggle.tsx.
export function HeroSection({ content }: HeroSectionProps) {
  const tagline = content.heroTagline || 'Managed Hosting + Launch Support'

  return (
    <header className="forge-panel rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-12">
      <p className="reveal text-xs font-semibold uppercase tracking-wide text-accent">{tagline}</p>

      <h1 className="reveal reveal-delay-1 mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
        {content.title}
      </h1>
      <p className="reveal reveal-delay-2 mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
        {content.subtitle}
      </p>
      <p className="reveal reveal-delay-2 mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
        I help founders and product teams launch reliable, well-monitored infrastructure, starting with a
        free discovery call and carrying through deployment, hosting, and ongoing support.
      </p>

      <div className="reveal reveal-delay-3 mt-8 flex flex-wrap justify-center gap-3">
        {SCHEDULING_URL ? (
          <a
            href={SCHEDULING_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'hero', label: 'Book a 30-minute call' })}
            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
          >
            Book a 30-minute call →
          </a>
        ) : (
          <a
            href="#/contact"
            onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'hero', label: 'Book a free discovery call' })}
            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
          >
            Book a free discovery call →
          </a>
        )}
        <a
          href="#/case-studies"
          onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'hero', label: 'View case studies' })}
          className="rounded-xl border border-zinc-600/50 bg-surface-control px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-text-primary"
        >
          View case studies →
        </a>
      </div>
    </header>
  )
}
