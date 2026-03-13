import { PageLayout } from './PageLayout'
import { CaseStudyCard } from '../features/consulting/CaseStudyCard'
import { useCaseStudiesContent } from '../features/consulting/useCaseStudiesContent'

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
          Cloud Run baseline is stable and CI/CD is fully automated. The current build queue
          spans language breadth, product depth, and portfolio polish: a Django REST API and a
          Go project to demonstrate multi-language backend range; a client-facing project
          dashboard for real-time engagement tracking; AI consulting feature completion; a
          react-router-dom migration; and a codebase audit pass to trim dead code and tighten
          reuse across all services.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="fx-chip">Django REST API</span>
          <span className="fx-chip">Go project</span>
          <span className="fx-chip">Client project dashboard</span>
          <span className="fx-chip">AI consulting (finish)</span>
          <span className="fx-chip">react-router-dom migration</span>
          <span className="fx-chip">Codebase audit</span>
          <span className="fx-chip">Workspace consolidation</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#/contact" className="btn-accent px-5 py-2 text-sm">Plan the next release</a>
          <a href="#/pricing" className="btn-neutral px-5 py-2 text-sm">View engagement options</a>
        </div>
      </section>
    </PageLayout>
  )
}
