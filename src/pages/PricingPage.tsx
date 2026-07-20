import { useEffect } from 'react'
import { PageLayout } from './PageLayout'
import { PageHeader } from '../features/site/PageHeader'
import { PricingCard } from '../features/consulting/PricingCard'
import { PricingFaq } from '../features/consulting/PricingFaq'
import { PricingTrustStrip } from '../features/consulting/PricingTrustStrip'
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
      <PageHeader title="Pricing" subtitle={note ? <p>{note}</p> : undefined} />

      {tiers.length > 0 && (
        <section className="grid gap-5 sm:grid-cols-3">
          {tiers.map((tier, index) => (
            <PricingCard key={tier.tier} {...tier} highlightLevel={index as 0 | 1 | 2} />
          ))}
        </section>
      )}

      <section className="forge-panel surface-card rounded-2xl p-5 text-center">
        <p className="text-sm text-text-muted">Not sure which option fits?</p>
        {SCHEDULING_URL ? (
          <a
            href={SCHEDULING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neutral mt-3 inline-block px-5 py-2 text-sm"
          >
            Book a call →
          </a>
        ) : (
          <a href="#/contact" className="btn-neutral mt-3 inline-block px-5 py-2 text-sm">
            Book paid discovery →
          </a>
        )}
      </section>

      <PricingTrustStrip />

      <PricingFaq />

      <ContactCTA />
    </PageLayout>
  )
}
