import type { PricingTier } from '../../types'
import { trackPortfolioEvent } from '../../utils/analytics'
import { resolvePricingCheckout } from './pricingCheckout'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

type HighlightLevel = 0 | 1 | 2

interface PricingCardProps extends PricingTier {
  highlightLevel?: HighlightLevel
}

// v1.18.4: migrated off a runtime theme-detection hook with a parallel
// light/dark class-string branch (mechanism 2 of the v1.18 audit's finding
// F2) onto the same --accent-* tokens `.btn-accent` already reads from
// src/styles/tokens.css. Both themes now resolve from one class string per
// level instead of two hand-tuned literal palettes, so there is no longer a
// second place a colour choice can drift from the rest of the app - and one
// of that old light palette's own classes (an amber border utility at 60
// percent opacity on the "Recommended" badge) was one of the two contrast
// bugs this milestone is scoped to fix (no light-theme override existed for
// it anywhere). See PricingCard.test.ts for the regression lock on both the
// removed hook and that literal class string.
const CARD_LEVEL_CLASSES: Record<HighlightLevel, string> = {
  0: 'border-border-soft bg-surface-1',
  1: 'border-accent-line bg-accent-soft',
  2: 'border-accent-line-hover bg-accent-soft-hover shadow-xl shadow-black/10 ring-1 ring-accent-line',
}

const PRICE_LEVEL_CLASSES: Record<HighlightLevel, string> = {
  0: 'text-text-primary',
  1: 'text-accent-text',
  2: 'text-accent-text',
}

const badgeLabel: Partial<Record<HighlightLevel, string>> = {
  2: 'Recommended',
}

export function PricingCard({ tier, price, description, features, ctaLabel, ctaHref, checkoutUrl, scarcity, highlighted, highlightLevel = 0 }: PricingCardProps) {
  const emphasisLevel: HighlightLevel = highlighted ? 2 : highlightLevel
  const badge = highlighted ? 'Recommended' : badgeLabel[emphasisLevel]
  const checkout = resolvePricingCheckout(checkoutUrl ?? undefined, ctaHref)

  return (
    <article className={`flex flex-col gap-4 rounded-2xl border p-6 transition-transform duration-200 hover:-translate-y-1 ${CARD_LEVEL_CLASSES[emphasisLevel]}`}>
      <div className="flex flex-wrap gap-2">
        {badge && <Badge tone="accent">{badge}</Badge>}
        {scarcity && <Badge tone="caution">{scarcity}</Badge>}
      </div>
      <div>
        <h3 className="text-scale-md font-semibold text-text-primary">{tier}</h3>
        <p className={`mt-1 text-2xl font-bold ${PRICE_LEVEL_CLASSES[emphasisLevel]}`}>{price}</p>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{description}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
            <span className="mt-px shrink-0 text-success">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        as="a"
        href={checkout.href}
        {...(checkout.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={() => trackPortfolioEvent(checkout.eventName, { tier, label: ctaLabel })}
        variant={emphasisLevel === 0 ? 'neutral' : 'accent'}
        className="mt-auto"
      >
        {ctaLabel}
      </Button>
      {checkout.external && (
        <p className="-mt-2 text-center text-scale-xs text-text-muted">Secure checkout</p>
      )}
    </article>
  )
}
