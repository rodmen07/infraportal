import { PageLayout } from './PageLayout'
import { FocusCard } from '../features/layout/FocusCard'
import { SCHEDULING_URL } from '../config'

function getTierLabel(hash: string): string {
  const value = new URLSearchParams(hash.split('?')[1] ?? '').get('tier')
  if (!value) return 'your engagement'

  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function CheckoutThankYouPage() {
  const tierLabel = getTierLabel(window.location.hash)

  return (
    <PageLayout>
      <FocusCard>
        <section className="forge-panel surface-card-strong rounded-3xl p-8 shadow-2xl shadow-black/50 sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/90">Payment received</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Thank you - your checkout is confirmed.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
            We received payment for <span className="font-semibold text-zinc-100">{tierLabel}</span>. You will
            receive a confirmation email from Stripe, and we will follow up within 1 business day with next steps.
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-zinc-700/40 bg-zinc-900/50 p-5 text-sm text-zinc-300 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-zinc-100">1. Confirmation</p>
              <p className="mt-1 text-zinc-400">Stripe sends your receipt instantly.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-100">2. Follow-up</p>
              <p className="mt-1 text-zinc-400">We reach out within one business day.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-100">3. Delivery</p>
              <p className="mt-1 text-zinc-400">We start with your scoped plan and timeline.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
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
          </div>
        </section>
      </FocusCard>
    </PageLayout>
  )
}
