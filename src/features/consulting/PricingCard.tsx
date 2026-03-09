import type { PricingTier } from '../../types'

export function PricingCard({ tier, price, description, features, highlighted, ctaLabel, ctaHref }: PricingTier) {
  return (
    <article className={`flex flex-col gap-4 rounded-2xl border p-6 ${
      highlighted
        ? 'border-amber-400/40 bg-gradient-to-b from-amber-500/10 to-zinc-800/70 shadow-xl shadow-amber-900/20'
        : 'border-zinc-500/35 bg-zinc-800/70'
    }`}>
      {highlighted && (
        <span className="self-start rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
          Most popular
        </span>
      )}
      <div>
        <h3 className="text-base font-semibold text-white">{tier}</h3>
        <p className={`mt-1 text-2xl font-bold ${highlighted ? 'text-amber-300' : 'text-zinc-100'}`}>{price}</p>
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
            ? 'border-amber-400/50 bg-amber-500/20 text-amber-200 hover:border-amber-400/70 hover:bg-amber-500/30 hover:text-amber-100'
            : 'border-zinc-600/50 bg-zinc-700/50 text-zinc-300 hover:border-zinc-500/60 hover:bg-zinc-600/60 hover:text-zinc-100'
        }`}
      >
        {ctaLabel}
      </a>
    </article>
  )
}
