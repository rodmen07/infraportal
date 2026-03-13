import { PageLayout } from './PageLayout'
import { CaseStudyCard } from '../features/consulting/CaseStudyCard'
import { useCaseStudiesContent } from '../features/consulting/useCaseStudiesContent'
import { BuildStatusBadges } from '../features/site/BuildStatusBadges'

export function CaseStudiesPage() {
  const baseUrl = import.meta.env.BASE_URL
  const { intro, featured, others } = useCaseStudiesContent(baseUrl)

  return (
    <PageLayout>
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white">Case Studies</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{intro}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Focus area right now: shipping product depth on top of the new Cloud Run baseline.
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center sm:w-auto">
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">9</div>
              <div className="text-[11px] text-zinc-400">Services</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">GCP</div>
              <div className="text-[11px] text-zinc-400">Deployed</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">CI/CD</div>
              <div className="text-[11px] text-zinc-400">Active</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#/contact" className="btn-accent px-4 py-2 text-sm">
            Start a similar project
          </a>
          <a href="#/services" className="btn-neutral px-4 py-2 text-sm">
            See service packages
          </a>
        </div>
      </section>

      <BuildStatusBadges repos={['microservices', 'backend-service', 'frontend-service', 'auth-service', 'ai-orchestrator-service', 'dynamodb_prototype']} />

      {featured.title && (
        <CaseStudyCard {...featured} featured />
      )}

      {others.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {others.map((cs) => (
            <CaseStudyCard key={cs.title} {...cs} />
          ))}
        </div>
      )}

      <section className="surface-card rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white">What comes next</h2>
        <p className="mt-2 text-sm text-zinc-400">
          The infrastructure migration is complete. Current iteration focus is UX depth,
          usability polish, and faster product feedback loops — including the medallion pipeline
          spinout, a Django REST API project, and a client-facing project dashboard where
          clients can track their individual engagement status in real time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="fx-chip">UX hardening</span>
          <span className="fx-chip">Observability</span>
          <span className="fx-chip">Performance tuning</span>
          <span className="fx-chip">Feature iteration</span>
          <span className="fx-chip">Medallion pipeline split</span>
          <span className="fx-chip">Django REST API</span>
          <span className="fx-chip">Client project dashboard</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#/contact" className="btn-accent px-5 py-2 text-sm">Plan the next release</a>
          <a href="#/pricing" className="btn-neutral px-5 py-2 text-sm">View engagement options</a>
        </div>
      </section>
    </PageLayout>
  )
}
