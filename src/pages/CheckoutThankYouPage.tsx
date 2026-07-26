import { PageLayout } from './PageLayout'
import { PageHeader } from '../features/site/PageHeader'
import { SCHEDULING_URL } from '../config'
import { checkoutTierLabel } from '../features/consulting/checkoutTier'

export function CheckoutThankYouPage() {
  // Both sources are read on purpose: the hash is where the fixed generator
  // puts the tier, the search component is where the payment links already
  // live on Stripe put it. See features/consulting/checkoutTier.ts.
  const tierLabel = checkoutTierLabel(window.location.hash, window.location.search)

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
            {SCHEDULING_URL ? (
              <a
                href={SCHEDULING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent px-5 py-2 text-sm"
              >
                Book kickoff call
              </a>
            ) : (
              <a href="#/contact" className="btn-accent px-5 py-2 text-sm">
                Share project details
              </a>
            )}
            <a href="#/pricing" className="btn-neutral px-5 py-2 text-sm">
              Back to pricing
            </a>
            <a href="#/" className="btn-neutral px-5 py-2 text-sm">
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
