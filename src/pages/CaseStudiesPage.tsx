import { PageLayout } from './PageLayout'
import { FocusCard } from '../features/layout/FocusCard'
import { CaseStudyCard } from '../features/consulting/CaseStudyCard'
import { MedallionDemo } from '../features/site/MedallionDemo'
import { BuildStatusSection } from '../features/site/BuildStatusSection'
import { ContactCTA } from '../features/site/ContactCTA'
import { useCaseStudiesContent } from '../features/consulting/useCaseStudiesContent'
import { SCHEDULING_URL } from '../config'

export function CaseStudiesPage() {
  const baseUrl = import.meta.env.BASE_URL
  const { intro, featured, others } = useCaseStudiesContent(baseUrl)

  return (
    <PageLayout>
      <FocusCard>
        <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-bold text-white">Case Studies</h1>
              <p className="mt-2 text-base font-semibold leading-relaxed text-zinc-200">{intro}</p>
            </div>

            <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center sm:w-auto">
              <div className="surface-card rounded-xl px-3 py-2">
                <div className="text-base font-bold text-white">16</div>
                <div className="text-[11px] text-zinc-400">Microservices</div>
              </div>
              <div className="surface-card rounded-xl px-3 py-2">
                <div className="text-base font-bold text-white">4+</div>
                <div className="text-[11px] text-zinc-400">Languages</div>
              </div>
              <div className="surface-card rounded-xl px-3 py-2">
                <div className="text-base font-bold text-white">Multi</div>
                <div className="text-[11px] text-zinc-400">Cloud</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
              {SCHEDULING_URL ? (
                <a href={SCHEDULING_URL} target="_blank" rel="noopener noreferrer" className="btn-accent px-4 py-2 text-sm">
                  Book a call
                </a>
              ) : (
                <a href="#/contact" className="btn-accent px-4 py-2 text-sm">Start a similar project</a>
              )}
            <a href="#/services" className="btn-neutral px-4 py-2 text-sm">See service packages</a>
          </div>
        </section>
      </FocusCard>

      {featured.title && (
        <FocusCard>
          <CaseStudyCard {...featured} featured />
        </FocusCard>
      )}

      {others.length > 0 && (
        <FocusCard>
          <div className="grid gap-4 sm:grid-cols-2">
            {others.map((cs) => (
              <CaseStudyCard key={cs.title} {...cs} />
            ))}
          </div>
        </FocusCard>
      )}

      <FocusCard>
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">Live pipeline demo</h2>
            <p className="mt-1 text-sm text-zinc-400">Bronze → Silver → Gold medallion transform over the live NIST NVD CVE feed, running right here in your browser.</p>
          </div>
          <MedallionDemo defaultLayer="gold" />
        </section>
      </FocusCard>

      <FocusCard>
        <BuildStatusSection />
      </FocusCard>

      <FocusCard>
        <section className="surface-card rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white">The full lifecycle, including the shutdown</h2>
          <p className="mt-2 text-sm text-zinc-400">
            The platform shipped 15 minor versions, from the first Cloud Run deploy through
            deployment safety, SLO monitoring, and distributed state. Then it was deliberately
            decommissioned to zero infrastructure cost: databases and registries deleted,
            volumes destroyed, every recurring line item eliminated. Real infrastructure work includes knowing when
            and how to turn things off. The reusable parts live on as published, documented Rust
            crates on crates.io.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="fx-chip">FinOps teardown to $0</span>
            <span className="fx-chip">axum-api-kit on crates.io</span>
            <span className="fx-chip">slokit (SLO tooling)</span>
            <span className="fx-chip">svccat (drift detection)</span>
            <span className="fx-chip">Terraform IaC</span>
            <span className="fx-chip">SOC 2 controls</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {SCHEDULING_URL ? (
              <a href={SCHEDULING_URL} target="_blank" rel="noopener noreferrer" className="btn-accent px-5 py-2 text-sm">
                Book discovery
              </a>
            ) : (
              <a href="#/contact" className="btn-accent px-5 py-2 text-sm">Plan the next release</a>
            )}
            <a href="#/pricing" className="btn-neutral px-5 py-2 text-sm">View engagement options</a>
          </div>
        </section>
      </FocusCard>

      <FocusCard>
        <ContactCTA />
      </FocusCard>
    </PageLayout>
  )
}
