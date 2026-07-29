import { PageLayout } from './PageLayout'
import { PricingCard } from '../features/consulting/PricingCard'
import { ContactCTA } from '../features/site/ContactCTA'
import { trackPortfolioEvent } from '../utils/analytics'
import { PORTFOLIO_EVENTS } from '../utils/analyticsEvents'

interface RetainerTier {
  tier: string
  price: string
  description: string
  features: string[]
  highlighted: boolean
  ctaLabel: string
  ctaHref: string
  checkoutUrl: string | null
}

interface RetainersContent {
  note: string
  availability: string
  tiers: RetainerTier[]
}

export function RetainersPage() {
  // Retainer tiers data
  const retainersData: RetainersContent = {
    note: 'Retainer slots typically fill 2-3 months ahead. Early commitment secures your calendar slot.',
    availability: '2-3 months ahead',
    tiers: [
      {
        tier: 'Starter Retainer',
        price: '$640/week · 8 hrs/week',
        description: 'Part-time hands-on engineering for smaller teams and early-stage projects. Perfect for adding infrastructure capacity without hiring full-time. Ideal for CI/CD setup, containerization, or initial cloud platform design.',
        features: [
          '8 hrs/week of hands-on work',
          '$80/hr effective, 20% off the $100 base rate',
          'Standard response (1-2 business days)',
          'Bi-weekly sync call',
          'Email and async communication',
          'Month-to-month flexibility'
        ],
        highlighted: false,
        ctaLabel: 'Start Starter Retainer',
        ctaHref: '#/contact',
        // No dedicated Stripe payment link for this retainer tier yet; route to
        // the discuss/contact flow. (The old hardcoded link pointed at the
        // one-time "Architecture Review" checkout - wrong product and price.)
        checkoutUrl: null
      },
      {
        tier: 'Standard Retainer',
        price: '$1,040/week · 16 hrs/week',
        description: 'Reliable hands-on engineering every week with consistent capacity and same-day response times. Shift priorities week-to-week based on what matters most. Ideal for ongoing optimization, feature development, infrastructure scaling, technical debt reduction, or keeping cloud infrastructure lean and efficient.',
        features: [
          '16 hrs/week of hands-on work',
          '$65/hr effective, 35% off the $100 base rate',
          'Priority response (same business day)',
          'Weekly sync and progress update',
          'Slack/Discord access during business hours',
          'Flexible scope, shift priorities week to week'
        ],
        highlighted: true,
        ctaLabel: 'Start Standard Retainer',
        ctaHref: '#/contact',
        // No dedicated Stripe payment link yet; route to discuss/contact.
        // (The old hardcoded link pointed at the one-time "Project" deposit
        // checkout - wrong product and price.)
        checkoutUrl: null
      },
      {
        tier: 'Premium Retainer',
        price: '$1,200/week · 24 hrs/week',
        description: 'Deep partnership with dedicated engineering capacity for complex, ongoing technical leadership. Best for teams scaling infrastructure, running critical compliance programs, or building new cloud platforms. Includes architecture review, mentoring, and hands-on implementation.',
        features: [
          '24 hrs/week of hands-on work',
          '$50/hr effective, 50% off the $100 base rate',
          'Immediate response (same-day or on-call)',
          'Weekly architecture review sync',
          'Real-time Slack/Discord access with mentoring',
          'Quarterly strategic planning session',
          'Unlimited scope changes within hours'
        ],
        highlighted: false,
        ctaLabel: 'Discuss Premium Retainer',
        ctaHref: '#/contact',
        // No dedicated Stripe payment link yet; route to discuss/contact.
        // (The old hardcoded link was a fabricated id - "Project" checkout's id
        // with its last char incremented - so it 404'd on Stripe: the reported bug.)
        checkoutUrl: null
      }
    ]
  }

  if (!retainersData) {
    return (
      <PageLayout>
        <div className="forge-panel rounded-3xl p-8 text-center">
          <p className="text-danger-text">Failed to load retainer plans</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 sm:p-10">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-white">Retainer Plans</h1>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Dedicated engineering capacity, every week. Pick the hours and responsiveness that fit your team. Each step up deepens the discount by 15 points, from 20% off the $100 base at 8 hrs/week to half price at 24. All retainers include weekly syncs, flexible scope, and priority support.
            </p>
            <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <span className="font-semibold">Availability:</span> {retainersData.availability}
            </p>
          </div>

          {retainersData.note && (
            <p className="mt-6 text-sm text-text-muted">
              {retainersData.note}
            </p>
          )}

          {retainersData.tiers.length > 0 && (
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {retainersData.tiers.map((tier, index) => (
                <div
                  key={tier.tier}
                  onClick={() => {
                    trackPortfolioEvent(PORTFOLIO_EVENTS.pricing_tier_view, {
                      tier: tier.tier,
                      page: 'retainers',
                      index: index + 1,
                    })
                  }}
                >
                  <PricingCard {...tier} highlightLevel={index as 0 | 1 | 2} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-zinc-700/40 bg-zinc-800/40 p-6">
            <h2 className="text-base font-semibold text-white">How retainers work</h2>
            <div className="mt-4 space-y-3 text-sm text-text-secondary">
              <p>
                <span className="font-medium text-text-primary">1. Discovery call:</span> Share your current stack, pain points, and team size. I recommend the right tier based on scope.
              </p>
              <p>
                <span className="font-medium text-text-primary">2. Signed agreement:</span> A simple 1-page SOW covering hours, rates, and expectations. No lock-in, month-to-month on Starter and Standard.
              </p>
              <p>
                <span className="font-medium text-text-primary">3. Weekly delivery:</span> Dedicated hours each week for implementation, code review, architecture guidance, or whatever moves the needle most for your team.
              </p>
              <p>
                <span className="font-medium text-text-primary">4. Flexible scope:</span> Priorities shift week-to-week. One week it might be DevOps automation, the next week mentoring junior engineers or infrastructure refactoring.
              </p>
              <p>
                <span className="font-medium text-text-primary">5. Unused hours:</span> Each tier reserves a fixed block of capacity, so hours do not roll over. One week of carryover is available by request, and work beyond the tier bills at that tier&apos;s effective rate.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#/contact"
              onClick={() => trackPortfolioEvent(PORTFOLIO_EVENTS.retainers_contact_cta, { location: 'retainers_page' })}
              className="btn-accent px-5 py-2 text-sm"
            >
              Get started →
            </a>
            <a
              href="#/pricing"
              className="btn-neutral px-5 py-2 text-sm"
            >
              View other services
            </a>
          </div>
      </section>

      <ContactCTA />
    </PageLayout>
  )
}
