import { trackPortfolioEvent } from '../../utils/analytics'
import { useLiveServices } from '../status/useLiveServices'
import { proofStats } from './proofStats'

// v1.18.3 (F9, D6/D7 done-when: "employers get proof above the fold"): the
// landing page previously showed zero social proof before the fold - the
// strongest assets (case studies, published crates, GitHub) were one or two
// clicks deep with no teaser. The two built-work stats mirror the ones shown on
// CaseStudiesPage's PageHeader so the two pages agree on the same numbers.
//
// v1.20.1 (PROOF-COST-1): the third tile is measured, not typed. See
// ./proofStats.ts for why, and ../status/useLiveServices.ts for how.

export function ProofStrip() {
  const stats = proofStats(useLiveServices())

  return (
    <section className="reveal forge-panel surface-card rounded-3xl border border-zinc-500/30 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="max-w-2xl">
          <p className="text-scale-xs font-semibold uppercase tracking-[0.24em] text-accent">Proof, not promises</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            I shipped a 16-service platform end to end, tore the whole thing down to $0 once its job was done,
            then brought the Cloud Run half back for about $9 a month when the portfolio needed a live demo.
            Real infrastructure work includes knowing when to turn things off, and what it costs to turn them
            back on.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="#/case-studies"
              onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'proof-strip', label: 'Read the case studies' })}
              className="btn-neutral px-4 py-2 text-sm"
            >
              Read the case studies →
            </a>
            <a
              href="https://github.com/rodmen07"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'proof-strip', label: 'GitHub' })}
              className="btn-neutral px-4 py-2 text-sm"
            >
              GitHub →
            </a>
            <a
              href="https://crates.io/crates/axum-api-kit"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'proof-strip', label: 'crates.io' })}
              className="btn-neutral px-4 py-2 text-sm"
            >
              crates.io →
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:w-auto">
          {stats.map((stat) => {
            const body = (
              <>
                <div className="text-lg font-bold text-text-primary">{stat.value}</div>
                <div className="text-scale-xs text-text-muted">{stat.label}</div>
              </>
            )
            return stat.href ? (
              <a
                key={stat.label}
                href={stat.href}
                onClick={() =>
                  trackPortfolioEvent('consulting_cta_click', { location: 'proof-strip', label: 'Platform status' })
                }
                className="surface-card interactive-card rounded-xl px-3 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {body}
              </a>
            ) : (
              <div key={stat.label} className="surface-card rounded-xl px-3 py-2 text-center">
                {body}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
