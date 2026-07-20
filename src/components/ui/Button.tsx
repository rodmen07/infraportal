// ---------------------------------------------------------------------------
// Button (v1.18.4 PR1): a thin wrapper over the existing `.btn-accent` /
// `.btn-neutral` recipes (src/index.css, tokenized since v1.18.1 PR2), so a
// component can get a themed, focus-visible, reduced-motion-safe button
// without hand-copying those classes.
//
// Also absorbs the ad hoc "amber CTA link" pattern that was hand-copied
// across 18+ files (ContactCTA, HeroSection, SupportRequestPanel,
// CicdCaseStudyPage, ConsultationsPage, ContactPage, LeadMagnetPage,
// MicroservicesCaseStudyPage, Soc2CaseStudyPage, SupportQueuePage, and
// more): `border border-amber-400/40 bg-amber-500/15 ... text-amber-200
// hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100`.
// `border-amber-400/30` and `/60` (used by a couple of that pattern's
// variants) had NO [data-theme="light"] override anywhere, so those links
// rendered with an invisible border in light mode - one of the two named
// v1.18.4 contrast bugs. `.btn-accent` already reads --accent-line/
// --accent-soft/--accent-text, which resolve correctly in both themes, so
// replacing the ad hoc class strings with `<Button as="a" variant="accent">`
// fixes the contrast bug by removing the raw utility classes from source
// entirely, rather than adding another override-sheet patch.
// ---------------------------------------------------------------------------
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'accent' | 'neutral'
export type ButtonSize = 'md' | 'sm'

interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
  className?: string
}

/** Exported for tests: the base class string for a variant/size pair, so a
 * test can assert every combination resolves to real, already-tokenized
 * classes without rendering the component. */
// eslint-disable-next-line react-refresh/only-export-components
export function buttonClassName(variant: ButtonVariant, size: ButtonSize, className = ''): string {
  const base = variant === 'accent' ? 'btn-accent' : 'btn-neutral'
  const sizing = size === 'sm' ? 'btn-sm' : 'px-4 py-2 text-sm'
  return `${base} ${sizing} inline-flex items-center justify-center gap-2 ${className}`.trim()
}

type ButtonAsButton = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { as?: 'button' }

type ButtonAsAnchor = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { as: 'a' }

export type ButtonProps = ButtonAsButton | ButtonAsAnchor

export function Button(props: ButtonProps) {
  const { variant = 'accent', size = 'md', className = '', children, ...rest } = props
  const cls = buttonClassName(variant, size, className)

  if (props.as === 'a') {
    const anchorRest = rest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>
    return (
      <a className={cls} {...anchorRest}>
        {children}
      </a>
    )
  }

  const buttonRest = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>
  return (
    <button type={buttonRest.type ?? 'button'} className={cls} {...buttonRest}>
      {children}
    </button>
  )
}
