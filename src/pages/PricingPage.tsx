import { PageLayout } from './PageLayout'
import { PricingCard } from '../features/consulting/PricingCard'
import { usePricingContent } from '../features/consulting/usePricingContent'

export function PricingPage() {
  const baseUrl = import.meta.env.BASE_URL
  const { note, tiers } = usePricingContent(baseUrl)

  return (
    <PageLayout>
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-white">Pricing</h1>
        {note && (
          <p className="mt-2 text-sm text-zinc-400">{note}</p>
        )}
      </section>

      {tiers.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-3">
          {tiers.map((tier) => (
            <PricingCard key={tier.tier} {...tier} />
          ))}
        </div>
      )}

      <div className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
        <p className="text-sm text-zinc-400">Not sure which option fits?</p>
        <a
          href="#/contact"
          className="mt-3 inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          Let's talk first →
        </a>
      </div>
    </PageLayout>
  )
}
