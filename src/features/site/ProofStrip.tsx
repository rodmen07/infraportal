import { trackPortfolioEvent } from '../../utils/analytics'

// v1.18.3 (F9, D6/D7 done-when: "employers get proof above the fold"): the
// landing page previously showed zero social proof before the fold - the
// strongest assets (case studies, published crates, GitHub) were one or two
// clicks deep with no teaser. Stats mirror the ones already shown on
// CaseStudiesPage's PageHeader so the two pages agree on the same numbers.
const PROOF_STATS = [
  { value: '16', label: 'Microservices shipped' },
  { value: '4+', label: 'Languages in production' },
  { value: '$0', label: 'Recurring infra cost today' },
] as const

export function ProofStrip() {
  return (
    <section className="reveal forge-panel surface-card rounded-3xl border border-zinc-500/30 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Proof, not promises</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            I shipped a 16-service platform end to end, then decommissioned it to $0 in recurring cost on purpose
            once its job was done. Real infrastructure work includes knowing when to turn things off.
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
          {PROOF_STATS.map((stat) => (
            <div key={stat.label} className="surface-card rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold text-text-primary">{stat.value}</div>
              <div className="text-[11px] text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
