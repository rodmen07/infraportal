import type { PricingTier } from '../../types'

export function PricingCard({ tier, price, description, features, highlighted, ctaLabel, ctaHref }: PricingTier) {
  return (
    <article className={`flex flex-col gap-4 rounded-2xl border p-6 transition-transform duration-200 hover:-translate-y-1 ${
      highlighted
        ? 'border-amber-300/50 bg-gradient-to-br from-amber-400/10 via-orange-300/6 to-amber-200/8 shadow-xl shadow-amber-400/10 ring-1 ring-amber-300/20'
        : 'border-zinc-500/35 bg-zinc-800/70'
    }`}>
      {highlighted && (
        <span className="self-start rounded-full border border-amber-300/50 bg-amber-400/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
          Most popular
        </span>
      )}
      <div>
        <h3 className="text-base font-semibold text-white">{tier}</h3>
        <p className={`mt-1 text-2xl font-bold ${highlighted ? 'text-amber-200' : 'text-zinc-100'}`}>{price}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className="mt-px shrink-0 text-emerald-400">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={ctaHref}
        className={`mt-auto rounded-xl border px-4 py-2.5 text-center text-sm font-semibold transition ${
          highlighted
            ? 'border-amber-300/55 bg-amber-400/15 text-amber-100 hover:border-amber-300/75 hover:bg-amber-400/25 hover:text-white'
            : 'border-zinc-600/50 bg-zinc-700/50 text-zinc-300 hover:border-zinc-500/60 hover:bg-zinc-600/60 hover:text-zinc-100'
        }`}
      >
        {ctaLabel}
      </a>
    </article>
  )
}
