import { useEffect } from 'react'
import { PageLayout } from './PageLayout'
import { PageHeader } from '../features/site/PageHeader'
import { SCHEDULING_URL } from '../config'
import { checkoutLandingParams, checkoutTierLabel } from '../features/consulting/checkoutTier'
import { trackPortfolioEvent } from '../utils/analytics'
import { PORTFOLIO_EVENTS } from '../utils/analyticsEvents'

export function CheckoutThankYouPage() {
  // Both sources are read on purpose: the hash is where the fixed generator
  // puts the tier, the search component is where the payment links already
  // live on Stripe put it. See features/consulting/checkoutTier.ts.
  const tierLabel = checkoutTierLabel(window.location.hash, window.location.search)

  // The completed-payment landing event (v1.22.1). This page is the highest
  // value conversion on the site and fired nothing until this hook: even with
  // a sink wired, a purchase would not have been counted. The params carry
  // the tier read by checkoutTier.ts from either URL position.
  useEffect(() => {
    trackPortfolioEvent(
      PORTFOLIO_EVENTS.checkout_thank_you_view,
      checkoutLandingParams(window.location.hash, window.location.search),
    )
  }, [])

  return (
    <PageLayout>
      <PageHeader
        kicker="Payment received"
        title="Thank you - your checkout is confirmed."
        subtitle={
          <p>
            I received payment for <span className="font-semibold text-text-primary">{tierLabel}</span>. You will
            receive a confirmation email from Stripe, and I will follow up within 1 business day with next steps.
          </p>
        }
        actions={
          <>
            {/* Every anchor here is click-tracked (contract D of
                conversionInstrumentation.test.ts covers this page): these are
                the first clicks a paying customer makes, and they reuse the
                existing consulting_cta_click name at a page-scoped location
                rather than widening the registry. */}
            {SCHEDULING_URL ? (
              <a
                href={SCHEDULING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent px-5 py-2 text-sm"
                onClick={() => trackPortfolioEvent(PORTFOLIO_EVENTS.consulting_cta_click, { location: 'checkout-thank-you', label: 'Book kickoff call' })}
              >
                Book kickoff call
              </a>
            ) : (
              <a
                href="#/contact"
                className="btn-accent px-5 py-2 text-sm"
                onClick={() => trackPortfolioEvent(PORTFOLIO_EVENTS.consulting_cta_click, { location: 'checkout-thank-you', label: 'Share project details' })}
              >
                Share project details
              </a>
            )}
            <a
              href="#/pricing"
              className="btn-neutral px-5 py-2 text-sm"
              onClick={() => trackPortfolioEvent(PORTFOLIO_EVENTS.consulting_cta_click, { location: 'checkout-thank-you', label: 'Back to pricing' })}
            >
              Back to pricing
            </a>
            <a
              href="#/"
              className="btn-neutral px-5 py-2 text-sm"
              onClick={() => trackPortfolioEvent(PORTFOLIO_EVENTS.consulting_cta_click, { location: 'checkout-thank-you', label: 'Home' })}
            >
              Home
            </a>
          </>
        }
      />

      <section className="grid gap-3 rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5 text-sm text-text-secondary sm:grid-cols-3">
        <div>
          <p className="font-semibold text-text-primary">1. Confirmation</p>
          <p className="mt-1 text-text-muted">Stripe sends your receipt instantly.</p>
        </div>
        <div>
          <p className="font-semibold text-text-primary">2. Follow-up</p>
          <p className="mt-1 text-text-muted">I reach out within one business day.</p>
        </div>
        <div>
          <p className="font-semibold text-text-primary">3. Delivery</p>
          <p className="mt-1 text-text-muted">I start with your scoped plan and timeline.</p>
        </div>
      </section>
    </PageLayout>
  )
}
