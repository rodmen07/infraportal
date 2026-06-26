import TopNav from './features/layout/TopNav'
import { FocusCard } from './features/layout/FocusCard'
import { HowItWorksSection } from './features/site/HowItWorksSection'
import { HeroSection } from './features/site/HeroSection'
import { ContactCTA } from './features/site/ContactCTA'
import { useSiteContent } from './features/site/useSiteContent'
import { PricingCard } from './features/consulting/PricingCard'
import { usePricingContent } from './features/consulting/usePricingContent'
import { SCHEDULING_URL } from './config'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const content = useSiteContent(baseUrl)
  const pricing = usePricingContent(baseUrl)

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-2 py-4 sm:px-4 lg:px-8 xl:px-10 2xl:px-14">
        <TopNav />
        
        <div className="mt-6 space-y-6">
          <FocusCard>
            <HeroSection content={content} />
          </FocusCard>
          <FocusCard>
            <HowItWorksSection />
          </FocusCard>
          <FocusCard>
            <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">Productionized offers</p>
                  <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Turn interest into a paid engagement.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Start with a short architecture review, move into a launch sprint, or keep a retainer open after delivery.
                    The offer stack is designed to make the next paid step obvious.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
                  Replies within 1 business day
                </div>
              </div>

              {pricing.note && <p className="mt-4 text-sm text-zinc-400">{pricing.note}</p>}

              {pricing.tiers.length > 0 && (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {pricing.tiers.map((tier, index) => (
                    <PricingCard key={tier.tier} {...tier} highlightLevel={index as 0 | 1 | 2} />
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#/pricing" className="btn-accent px-4 py-2 text-sm">
                  View pricing →
                </a>
                {SCHEDULING_URL ? (
                  <a href={SCHEDULING_URL} target="_blank" rel="noopener noreferrer" className="btn-neutral px-4 py-2 text-sm">
                    Book a call
                  </a>
                ) : (
                  <a href="#/contact" className="btn-neutral px-4 py-2 text-sm">
                    Request a proposal
                  </a>
                )}
              </div>
            </section>
          </FocusCard>
          <FocusCard>
            <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/90">Free Resource</p>
                  <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">20-point infrastructure audit checklist</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Self-assess your cloud setup against DevSecOps best practices. Identifies gaps in auto-scaling, security, compliance, and cost optimization.
                  </p>
                  <p className="mt-4 text-xs text-zinc-400">
                    After download, I'll send a 3-email sequence with specific recommendations for your stack (Day 0, Day 3, Day 7).
                  </p>
                  <a href="#/lead-magnet" className="mt-4 inline-block rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/25">
                    Get the checklist →
                  </a>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/40 p-3">
                    <p className="text-xs font-semibold text-zinc-300">✓ 4 categories</p>
                    <p className="mt-1 text-xs text-zinc-400">Security, Reliability, Operations, Cost</p>
                  </div>
                  <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/40 p-3">
                    <p className="text-xs font-semibold text-zinc-300">✓ 20 assessment items</p>
                    <p className="mt-1 text-xs text-zinc-400">Self-evaluate in 5-10 minutes</p>
                  </div>
                  <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/40 p-3">
                    <p className="text-xs font-semibold text-zinc-300">✓ Actionable next steps</p>
                    <p className="mt-1 text-xs text-zinc-400">30-minute free consultation offer</p>
                  </div>
                </div>
              </div>
            </section>
          </FocusCard>
          <FocusCard>
            <ContactCTA />
          </FocusCard>
        </div>
      </div>
    </main>
  )
}

export default App
