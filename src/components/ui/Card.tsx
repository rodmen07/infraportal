// ---------------------------------------------------------------------------
// Card (v1.18.4 PR1): a thin wrapper choosing among the three token-built
// surface classes already defined in src/styles/tokens.css since v1.18.1
// PR1 (surface-card, surface-card-strong, interactive-card), so a new
// component reaches for `<Card>` instead of re-deciding which of the three
// class names it needs and hand-copying `rounded-3xl p-6` alongside it.
// ---------------------------------------------------------------------------
import type { HTMLAttributes, ReactNode } from 'react'

export type CardVariant = 'default' | 'strong' | 'interactive'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'surface-card',
  strong: 'surface-card-strong',
  interactive: 'interactive-card',
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

/** Exported for tests: the class string for a variant/padding pair. */
// eslint-disable-next-line react-refresh/only-export-components
export function cardClassName(variant: CardVariant, padding: CardPadding, className = ''): string {
  return `${VARIANT_CLASSES[variant]} ${PADDING_CLASSES[padding]} ${className}`.trim()
}

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  variant?: CardVariant
  padding?: CardPadding
  className?: string
  children?: ReactNode
}

export function Card({ variant = 'default', padding = 'md', className = '', children, ...rest }: CardProps) {
  return (
    <div className={cardClassName(variant, padding, className)} {...rest}>
      {children}
    </div>
  )
}
