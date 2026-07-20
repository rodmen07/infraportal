// ---------------------------------------------------------------------------
// Badge (v1.18.4 PR1): one status-pill recipe replacing the ad hoc per-page
// palettes this consolidates. Before this component, PatchNotesPage
// (SEVERITY_STYLES / COMPLETION_STYLES), ConsultationsPage (STATUS_META /
// PRIORITY_META), SupportQueuePage (STATUS_META), and PortalPage
// (STATUS_STYLES) each hand-rolled their own `rounded-full ... text-[11px]`
// span with a bespoke bg-*/text-*/border-* combination - several of them
// (bg-emerald-500/10, border-amber-400/30 and /60 among them) with no
// [data-theme="light"] override anywhere, so those badges rendered
// near-invisible in light mode. Badge reads the status soft/line/text token
// triples from src/styles/tokens.css (--success-*, --warning-*, --danger-*,
// --caution-*, --info-*, plus the existing --accent-* and --neutral-*
// roles), so every tone already resolves correctly in both themes with zero
// new [data-theme="light"] rule required.
//
// Tone choice mirrors the actual domain values in use, not an invented
// palette: PatchNotes' four severities map 1:1 onto danger/warning/caution/
// neutral; the three-state consultation/support/portal statuses map onto
// accent (new/pending)/info (in review)/success (accepted/resolved)/danger
// (blocked/cancelled). `sky` and `rose` (used ad hoc in a couple of the
// pre-migration palettes) are not reintroduced: D4 scopes the site's status
// vocabulary to emerald/red/orange/yellow plus the existing zinc+amber
// identity, so "reviewed"/"in progress" moves onto `info` (blue) and "hot"/
// "cancelled" onto `danger` (red) instead of adding two more one-off hues.
// ---------------------------------------------------------------------------
import type { ReactNode } from 'react'

export type BadgeTone = 'accent' | 'info' | 'success' | 'warning' | 'caution' | 'danger' | 'neutral'

const TONE_CLASSES: Record<BadgeTone, string> = {
  accent: 'border-accent-line bg-accent-soft text-accent-text',
  info: 'border-info-line bg-info-soft text-info-text',
  success: 'border-success-line bg-success-soft text-success-text',
  warning: 'border-warning-line bg-warning-soft text-warning-text',
  caution: 'border-caution-line bg-caution-soft text-caution-text',
  danger: 'border-danger-line bg-danger-soft text-danger-text',
  neutral: 'border-neutral-border bg-neutral-bg text-text-secondary',
}

/** Exported for tests: the exact class string a tone resolves to, so a test
 * can assert every tone is wired to a real (non-empty, distinct) recipe
 * without needing to render the component. */
// eslint-disable-next-line react-refresh/only-export-components
export function badgeToneClassName(tone: BadgeTone): string {
  return TONE_CLASSES[tone]
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/** A small rounded status pill. Defaults to `neutral` rather than `accent`
 * so an unset tone reads as inert, not as a call to action. */
export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-scale-xs font-semibold ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  )
}
