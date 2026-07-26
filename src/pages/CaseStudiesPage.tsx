import { PageLayout } from './PageLayout'
import { PageHeader } from '../features/site/PageHeader'
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
      <PageHeader
        title="Case Studies"
        subtitle={<p className="text-base font-semibold text-text-primary">{intro}</p>}
        stats={[
          { value: '16', label: 'Microservices' },
          { value: '4+', label: 'Languages' },
          { value: 'Multi', label: 'Cloud' },
        ]}
        actions={
          <>
            {SCHEDULING_URL ? (
              <a href={SCHEDULING_URL} target="_blank" rel="noopener noreferrer" className="btn-accent px-4 py-2 text-sm">
                Book a call
              </a>
            ) : (
              <a href="#/contact" className="btn-accent px-4 py-2 text-sm">Start a similar project</a>
            )}
            <a href="#/services" className="btn-neutral px-4 py-2 text-sm">See service packages</a>
          </>
        }
      />

      {featured.title && <CaseStudyCard {...featured} featured />}

      {others.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          {others.map((cs) => (
            <CaseStudyCard key={cs.title} {...cs} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Live pipeline demo</h2>
          <p className="mt-1 text-sm text-text-muted">Bronze → Silver → Gold medallion transform over the live NIST NVD CVE feed, running right here in your browser.</p>
        </div>
        <MedallionDemo defaultLayer="gold" />
      </section>

      <BuildStatusSection />

      <section className="surface-card rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white">The full lifecycle, shutdown and restart included</h2>
        <p className="mt-2 text-sm text-text-muted">
          The platform shipped 15 minor versions, from the first Cloud Run deploy through
          deployment safety, SLO monitoring, and distributed state. Then it was deliberately torn
          down to zero infrastructure cost: databases and registries deleted, volumes destroyed,
          every recurring line item eliminated. When the portfolio needed a live demo, the Cloud
          Run half was rebuilt on a small managed Postgres instance for about $9 a month, and
          every service now publishes its health to the{' '}
          <a href="#/status" className="text-accent-text underline underline-offset-4 hover:text-text-primary">
            platform status board
          </a>
          . Real infrastructure work includes knowing when to turn things off, and what it costs
          to turn them back on. The reusable parts live on as published, documented Rust crates on
          crates.io.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="fx-chip">FinOps teardown, then a measured restart</span>
          <span className="fx-chip">axum-api-kit on crates.io</span>
          <span className="fx-chip">slokit (SLO tooling)</span>
          <span className="fx-chip">svccat (drift detection)</span>
          <span className="fx-chip">Terraform IaC</span>
          <span className="fx-chip">SOC 2 controls</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {SCHEDULING_URL ? (
            <a href={SCHEDULING_URL} target="_blank" rel="noopener noreferrer" className="btn-accent px-5 py-2 text-sm">
              Book a free discovery call
            </a>
          ) : (
            <a href="#/contact" className="btn-accent px-5 py-2 text-sm">Plan the next release</a>
          )}
          <a href="#/pricing" className="btn-neutral px-5 py-2 text-sm">View engagement options</a>
        </div>
      </section>

      <ContactCTA />
    </PageLayout>
  )
}
