import { PageLayout } from './PageLayout'
import { FocusCard } from '../features/layout/FocusCard'
import { ServiceCard } from '../features/consulting/ServiceCard'
import { HowItWorksSection } from '../features/site/HowItWorksSection'
import { ContactCTA } from '../features/site/ContactCTA'
import { useServicesContent } from '../features/consulting/useServicesContent'

const STANDARD_DELIVERABLES = [
  'A clear launch plan with deployment milestones and ownership',
  'Domain setup, SSL, and hosting configuration for your app',
  'Monitoring and maintenance check-ins so issues are caught early',
  'A simple runbook for updates, support requests, and handoffs',
  'Ongoing support for launches, fixes, and operational questions',
]

const SERVICE_HIGHLIGHTS = [
  {
    title: 'Launch support',
    description: 'Get your app online without wrestling with cloud setup or deployment pipelines.',
  },
  {
    title: 'Reliable hosting',
    description: 'We keep your environment stable with monitoring, updates, and operational oversight.',
  },
  {
    title: 'Hands-on maintenance',
    description: 'From small fixes to rollout support, we handle the operational details for you.',
  },
]

export function ServicesPage() {
  const baseUrl = import.meta.env.BASE_URL
  const { intro, services } = useServicesContent(baseUrl)

  return (
    <PageLayout>
      <FocusCard>
        <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-bold text-white">Managed hosting services</h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{intro}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                We help founders and small teams launch and maintain web products without taking on the infrastructure burden themselves.
              </p>
            </div>

            <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center sm:w-auto">
              <div className="surface-card rounded-xl px-3 py-2">
                <div className="text-base font-bold text-white">Deploy</div>
                <div className="text-[11px] text-zinc-400">Hosting</div>
              </div>
              <div className="surface-card rounded-xl px-3 py-2">
                <div className="text-base font-bold text-white">Maintain</div>
                <div className="text-[11px] text-zinc-400">Operations</div>
              </div>
              <div className="surface-card rounded-xl px-3 py-2">
                <div className="text-base font-bold text-white">Support</div>
                <div className="text-[11px] text-zinc-400">Assistance</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#/contact" className="btn-accent px-4 py-2 text-sm">Book a consultation</a>
            <a href="#/portal" className="btn-neutral px-4 py-2 text-sm">See your client workspace</a>
          </div>

          {services.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {services.map((service) => (
                <ServiceCard key={service.title} {...service} />
              ))}
            </div>
          )}
        </section>
      </FocusCard>

      <FocusCard>
        <section className="forge-panel surface-card rounded-2xl p-6 shadow-xl shadow-black/30">
          <h2 className="text-base font-semibold text-white">What is included</h2>
          <p className="mt-1 text-xs text-zinc-500">We keep the service simple, practical, and focused on launch readiness.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {SERVICE_HIGHLIGHTS.map((item) => (
              <div key={item.title} className="rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-4">
                <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
          <ul className="mt-5 space-y-2">
            {STANDARD_DELIVERABLES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <span className="mt-0.5 shrink-0 text-amber-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </FocusCard>

      <FocusCard>
        <HowItWorksSection />
      </FocusCard>

      <FocusCard>
        <ContactCTA />
      </FocusCard>
    </PageLayout>
  )
}
