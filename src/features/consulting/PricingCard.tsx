import { useTheme } from '../layout/useTheme'
import type { PricingTier } from '../../types'

type HighlightLevel = 0 | 1 | 2

interface PricingCardProps extends PricingTier {
  highlightLevel?: HighlightLevel
}

const darkCardStyles: Record<HighlightLevel, string> = {
  0: 'border-zinc-500/35 bg-zinc-800/70',
  1: 'border-amber-400/35 bg-gradient-to-br from-amber-400/8 to-amber-300/5 shadow-lg shadow-amber-400/8 ring-1 ring-amber-300/15',
  2: 'border-amber-300/60 bg-gradient-to-br from-amber-400/18 via-orange-300/10 to-amber-200/12 shadow-xl shadow-amber-400/20 ring-2 ring-amber-300/30',
}

const lightCardStyles: Record<HighlightLevel, string> = {
  0: 'border-zinc-200 bg-zinc-50',
  1: 'border-amber-300/70 bg-amber-50 shadow-sm shadow-amber-100',
  2: 'border-amber-400 bg-amber-100/70 shadow-lg shadow-amber-200/60 ring-1 ring-amber-300/60',
}

const darkPriceStyles: Record<HighlightLevel, string> = {
  0: 'text-zinc-100',
  1: 'text-amber-200/90',
  2: 'text-amber-200',
}

const lightPriceStyles: Record<HighlightLevel, string> = {
  0: 'text-zinc-800',
  1: 'text-amber-700',
  2: 'text-amber-800',
}

const darkCtaStyles: Record<HighlightLevel, string> = {
  0: 'border-zinc-600/50 bg-zinc-700/50 text-zinc-300 hover:border-zinc-500/60 hover:bg-zinc-600/60 hover:text-zinc-100',
  1: 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:border-amber-300/60 hover:bg-amber-400/20 hover:text-amber-100',
  2: 'border-amber-300/60 bg-amber-400/18 text-amber-100 hover:border-amber-300/80 hover:bg-amber-400/28 hover:text-white',
}

const lightCtaStyles: Record<HighlightLevel, string> = {
  0: 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-900',
  1: 'border-amber-300 bg-amber-100/80 text-amber-800 hover:border-amber-400 hover:bg-amber-100 hover:text-amber-900',
  2: 'border-amber-400 bg-amber-200/60 text-amber-900 font-bold hover:border-amber-500 hover:bg-amber-200 hover:text-amber-950',
}

const badgeLabel: Partial<Record<HighlightLevel, string>> = {
  2: 'Best value',
}

export function PricingCard({ tier, price, description, features, ctaLabel, ctaHref, highlightLevel = 0 }: PricingCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const cardStyles = isLight ? lightCardStyles : darkCardStyles
  const priceStyles = isLight ? lightPriceStyles : darkPriceStyles
  const ctaStyles = isLight ? lightCtaStyles : darkCtaStyles

  const titleClass = isLight ? 'text-zinc-900' : 'text-white'
  const descClass = isLight ? 'text-zinc-600' : 'text-zinc-400'
  const featureClass = isLight ? 'text-zinc-700' : 'text-zinc-300'
  const checkClass = isLight ? 'text-emerald-600' : 'text-emerald-400'

  const badge = badgeLabel[highlightLevel]

  return (
    <article className={`flex flex-col gap-4 rounded-2xl border p-6 transition-transform duration-200 hover:-translate-y-1 ${cardStyles[highlightLevel]}`}>
      {badge && (
        <span className={`self-start rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
          isLight
            ? 'border-amber-400/60 bg-amber-200/60 text-amber-800'
            : 'border-amber-300/50 bg-amber-400/12 text-amber-200'
        }`}>
          {badge}
        </span>
      )}
      <div>
        <h3 className={`text-base font-semibold ${titleClass}`}>{tier}</h3>
        <p className={`mt-1 text-2xl font-bold ${priceStyles[highlightLevel]}`}>{price}</p>
        <p className={`mt-2 text-sm leading-relaxed ${descClass}`}>{description}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {features.map((f) => (
          <li key={f} className={`flex items-start gap-2 text-sm ${featureClass}`}>
            <span className={`mt-px shrink-0 ${checkClass}`}>✓</span>
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
