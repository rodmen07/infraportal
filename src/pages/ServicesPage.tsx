import { PageLayout } from './PageLayout'
import { ServiceCard } from '../features/consulting/ServiceCard'
import { HowItWorksSection } from '../features/site/HowItWorksSection'
import { useServicesContent } from '../features/consulting/useServicesContent'

const STANDARD_DELIVERABLES = [
  'Written proposal and scope before any work begins',
  'All code delivered via pull request with review comments',
  'Architecture decision records (ADRs) for non-obvious choices',
  'Runbook: how to operate, monitor, and troubleshoot what was built',
  'One month of post-delivery email support',
]

export function ServicesPage() {
  const baseUrl = import.meta.env.BASE_URL
  const { intro, services } = useServicesContent(baseUrl)

  return (
    <PageLayout>
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50 reveal">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white">Services</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{intro}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Built to move from MVP deployment to an operable production baseline without unnecessary complexity.
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center sm:w-auto">
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">Cloud</div>
              <div className="text-[11px] text-zinc-400">Foundations</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">CI/CD</div>
              <div className="text-[11px] text-zinc-400">Delivery</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">UX</div>
              <div className="text-[11px] text-zinc-400">Iteration</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#/contact" className="btn-accent px-4 py-2 text-sm">Book a discovery call</a>
          <a href="#/case-studies" className="btn-neutral px-4 py-2 text-sm">See delivery examples</a>
        </div>

        {services.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 reveal reveal-delay-1">
            {services.map((service) => (
              <ServiceCard key={service.title} {...service} />
            ))}
          </div>
        )}
      </section>

      <section className="forge-panel surface-card rounded-2xl p-6 shadow-xl shadow-black/30 reveal reveal-delay-2">
        <h2 className="text-base font-semibold text-white">Included with every engagement</h2>
        <p className="mt-1 text-xs text-zinc-500">Regardless of scope or tier — no extras to negotiate.</p>
        <ul className="mt-4 space-y-2">
          {STANDARD_DELIVERABLES.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
              <span className="mt-0.5 shrink-0 text-amber-400">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <HowItWorksSection />

      <section className="surface-card rounded-2xl p-5 reveal reveal-delay-3">
        <h2 className="text-lg font-semibold text-white">Engagement start</h2>
        <p className="mt-2 text-sm text-zinc-400">
          30-minute scoping call, then a concrete plan with milestones and delivery order.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#/contact" className="btn-accent px-5 py-2 text-sm">Let's discuss your project</a>
          <a href="#/pricing" className="btn-neutral px-5 py-2 text-sm">View pricing</a>
        </div>
      </section>
    </PageLayout>
  )
}
