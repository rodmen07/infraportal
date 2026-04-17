import type { PricingTier } from '../../types'

type HighlightLevel = 0 | 1 | 2

interface PricingCardProps extends PricingTier {
  highlightLevel?: HighlightLevel
}

const cardStyles: Record<HighlightLevel, string> = {
  0: 'border-zinc-500/35 bg-zinc-800/70',
  1: 'border-amber-400/35 bg-gradient-to-br from-amber-400/8 to-amber-300/5 shadow-lg shadow-amber-400/8 ring-1 ring-amber-300/15',
  2: 'border-amber-300/60 bg-gradient-to-br from-amber-400/18 via-orange-300/10 to-amber-200/12 shadow-xl shadow-amber-400/20 ring-2 ring-amber-300/30',
}

const priceStyles: Record<HighlightLevel, string> = {
  0: 'text-zinc-100',
  1: 'text-amber-200/90',
  2: 'text-amber-200',
}

const ctaStyles: Record<HighlightLevel, string> = {
  0: 'border-zinc-600/50 bg-zinc-700/50 text-zinc-300 hover:border-zinc-500/60 hover:bg-zinc-600/60 hover:text-zinc-100',
  1: 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:border-amber-300/60 hover:bg-amber-400/20 hover:text-amber-100',
  2: 'border-amber-300/60 bg-amber-400/18 text-amber-100 hover:border-amber-300/80 hover:bg-amber-400/28 hover:text-white',
}

const badgeLabel: Partial<Record<HighlightLevel, string>> = {
  2: 'Best value',
}

export function PricingCard({ tier, price, description, features, ctaLabel, ctaHref, highlightLevel = 0 }: PricingCardProps) {
  const badge = badgeLabel[highlightLevel]

  return (
    <article className={`flex flex-col gap-4 rounded-2xl border p-6 transition-transform duration-200 hover:-translate-y-1 ${cardStyles[highlightLevel]}`}>
      {badge && (
        <span className="self-start rounded-full border border-amber-300/50 bg-amber-400/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
          {badge}
        </span>
      )}
      <div>
        <h3 className="text-base font-semibold text-white">{tier}</h3>
        <p className={`mt-1 text-2xl font-bold ${priceStyles[highlightLevel]}`}>{price}</p>
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
        className={`mt-auto rounded-xl border px-4 py-2.5 text-center text-sm font-semibold transition ${ctaStyles[highlightLevel]}`}
      >
        {ctaLabel}
      </a>
    </article>
  )
}
