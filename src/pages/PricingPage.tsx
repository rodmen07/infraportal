import { useEffect } from 'react'
import { PageLayout } from './PageLayout'
import { FocusCard } from '../features/layout/FocusCard'
import { PricingCard } from '../features/consulting/PricingCard'
import { PricingFaq } from '../features/consulting/PricingFaq'
import { PricingTrustStrip } from '../features/consulting/PricingTrustStrip'
import { HowItWorksSection } from '../features/site/HowItWorksSection'
import { ContactCTA } from '../features/site/ContactCTA'
import { usePricingContent } from '../features/consulting/usePricingContent'
import { trackPortfolioEvent } from '../utils/analytics'
import { SCHEDULING_URL } from '../config'

export function PricingPage() {
  const baseUrl = import.meta.env.BASE_URL
  const { note, tiers } = usePricingContent(baseUrl)

  useEffect(() => {
    trackPortfolioEvent('pricing_page_view', {
      tier_count: tiers.length,
      has_retainer_link: tiers.some(t => t.tier === 'Retainer'),
    })
    // Track individual tier impressions
    tiers.forEach((tier, index) => {
      trackPortfolioEvent('pricing_tier_impression', {
        tier: tier.tier,
        index: index + 1,
        highlighted: tier.highlighted ? 'yes' : 'no',
      })
    })
  }, [tiers])

  return (
    <PageLayout>
      <FocusCard>
        <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <h1 className="text-2xl font-bold text-white">Pricing</h1>
          {note && <p className="mt-2 text-sm text-zinc-400">{note}</p>}

          {tiers.length > 0 && (
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {tiers.map((tier, index) => (
                <PricingCard key={tier.tier} {...tier} highlightLevel={index as 0 | 1 | 2} />
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-zinc-700/40 bg-zinc-800/40 p-5 text-center">
            <p className="text-sm text-zinc-400">Not sure which option fits?</p>
            {SCHEDULING_URL ? (
              <a
                href={SCHEDULING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
              >
                Book a call →
              </a>
            ) : (
              <a
                href="#/contact"
                className="mt-3 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
              >
                Book paid discovery →
              </a>
            )}
          </div>
        </section>
      </FocusCard>

      <FocusCard>
        <PricingTrustStrip />
      </FocusCard>

      <FocusCard>
        <HowItWorksSection />
      </FocusCard>

      <FocusCard>
        <PricingFaq />
      </FocusCard>

      <FocusCard>
        <ContactCTA />
      </FocusCard>
    </PageLayout>
  )
}
