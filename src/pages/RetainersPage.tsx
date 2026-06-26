import { PageLayout } from './PageLayout'
import { FocusCard } from '../features/layout/FocusCard'
import { PricingCard } from '../features/consulting/PricingCard'
import { ContactCTA } from '../features/site/ContactCTA'
import { trackPortfolioEvent } from '../utils/analytics'

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
        price: '$800/week · 6–8 hrs/week',
        description: 'Part-time hands-on engineering for smaller teams and early-stage projects. Perfect for adding infrastructure capacity without hiring full-time. Ideal for CI/CD setup, containerization, or initial cloud platform design.',
        features: [
          '6–8 hrs/week of hands-on work',
          'Standard response (1-2 business days)',
          'Bi-weekly sync call',
          'Email and async communication',
          'Month-to-month flexibility'
        ],
        highlighted: false,
        ctaLabel: 'Start Starter Retainer',
        ctaHref: '#/contact',
        checkoutUrl: 'https://buy.stripe.com/bJe4gy3TR8fq5Y8cF4ffy00'
      },
      {
        tier: 'Standard Retainer',
        price: '$1,500/week · 10–15 hrs/week',
        description: 'Reliable hands-on engineering every week with consistent capacity and same-day response times. Shift priorities week-to-week based on what matters most. Ideal for ongoing optimization, feature development, infrastructure scaling, technical debt reduction, or keeping cloud infrastructure lean and efficient.',
        features: [
          '10–15 hrs/week of hands-on work',
          'Priority response (same business day)',
          'Weekly sync and progress update',
          'Slack/Discord access during business hours',
          'Flexible scope — shift priorities week to week'
        ],
        highlighted: true,
        ctaLabel: 'Start Standard Retainer',
        ctaHref: '#/contact',
        checkoutUrl: 'https://buy.stripe.com/bJedR87632V6euEfRgffy01'
      },
      {
        tier: 'Premium Retainer',
        price: '$3,000/week · 20–25 hrs/week',
        description: 'Deep partnership with dedicated engineering capacity for complex, ongoing technical leadership. Best for teams scaling infrastructure, running critical compliance programs, or building new cloud platforms. Includes architecture review, mentoring, and hands-on implementation.',
        features: [
          '20–25 hrs/week of hands-on work',
          'Immediate response (same-day or on-call)',
          'Weekly architecture review sync',
          'Real-time Slack/Discord access with mentoring',
          'Quarterly strategic planning session',
          'Unlimited scope changes within hours'
        ],
        highlighted: false,
        ctaLabel: 'Discuss Premium Retainer',
        ctaHref: '#/contact',
        checkoutUrl: 'https://buy.stripe.com/bJedR87632V6euEfRgffy02'
      }
    ]
  }

  if (!retainersData) {
    return (
      <PageLayout>
        <FocusCard>
          <div className="forge-panel rounded-3xl p-8 text-center">
            <p className="text-red-400">Failed to load retainer plans</p>
          </div>
        </FocusCard>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <FocusCard>
        <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 sm:p-10">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-white">Retainer Plans</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Dedicated engineering capacity, every week. Pick the hours and responsiveness that fit your team. All retainers include weekly syncs, flexible scope, and priority support.
            </p>
            <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <span className="font-semibold">Availability:</span> {retainersData.availability}
            </p>
          </div>

          {retainersData.note && (
            <p className="mt-6 text-sm text-zinc-400">
              {retainersData.note}
            </p>
          )}

          {retainersData.tiers.length > 0 && (
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {retainersData.tiers.map((tier, index) => (
                <div
                  key={tier.tier}
                  onClick={() => {
                    trackPortfolioEvent('pricing_tier_view', {
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
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <p>
                <span className="font-medium text-zinc-100">1. Discovery call:</span> Share your current stack, pain points, and team size. I recommend the right tier based on scope.
              </p>
              <p>
                <span className="font-medium text-zinc-100">2. Signed agreement:</span> A simple 1-page SOW covering hours, rates, and expectations. No lock-in — month-to-month on Starter and Standard.
              </p>
              <p>
                <span className="font-medium text-zinc-100">3. Weekly delivery:</span> Dedicated hours each week for implementation, code review, architecture guidance, or whatever moves the needle most for your team.
              </p>
              <p>
                <span className="font-medium text-zinc-100">4. Flexible scope:</span> Priorities shift week-to-week. One week it might be DevOps automation, the next week mentoring junior engineers or infrastructure refactoring.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#/contact"
              onClick={() => trackPortfolioEvent('retainers_contact_cta', { location: 'retainers_page' })}
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
      </FocusCard>

      <FocusCard>
        <ContactCTA />
      </FocusCard>
    </PageLayout>
  )
}
