import { SCHEDULING_URL } from '../../config'

const STEPS = [
  {
    number: '01',
    heading: 'Tell me about your app',
    body: 'Share your product, launch timeline, and support needs. I make the onboarding simple and fast.',
    accent: 'border-amber-400/30 bg-amber-500/5',
    numColor: 'text-amber-500/50',
  },
  {
    number: '02',
    heading: 'I set up the hosting',
    body: 'I handle deployment, domain setup, SSL, and the initial environment so your app is ready to launch.',
    accent: 'border-amber-400/25 bg-amber-500/5',
    numColor: 'text-amber-500/40',
  },
  {
    number: '03',
    heading: 'I keep it running',
    body: 'From updates to monitoring and support requests, I maintain the operational side so you can stay focused on the product.',
    accent: 'border-amber-400/20 bg-amber-500/[0.03]',
    numColor: 'text-amber-500/30',
  },
] as const

export function HowItWorksSection() {
  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-6 text-center text-xl font-semibold text-white">How the service works</h2>

      <div className="relative grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <article
            key={step.number}
            className={`relative flex flex-col gap-3 rounded-2xl border p-5 ${step.accent}`}
          >
            <span className={`text-4xl font-black leading-none ${step.numColor}`}>
              {step.number}
            </span>
            <h3 className="text-sm font-semibold text-white">{step.heading}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">{step.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 text-center">
        {SCHEDULING_URL ? (
          <a
            href={SCHEDULING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-100"
          >
            Book a call →
          </a>
        ) : (
          <a
            href="#/contact"
            className="inline-block rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-100"
          >
            Book a consultation →
          </a>
        )}
      </div>
    </section>
  )
}
