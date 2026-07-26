import { Button } from '../../components/ui/Button'

/**
 * The visitor's control over a live badge section (v1.21.2, decision D-5).
 *
 * Reading once on mount is only honest if the reader can ask again, so every
 * consumer of `useGitHubBuildStatus` renders this beside its badges. The
 * previous design asked for them: `ProjectRepoBuildStatus` printed the caption
 * "Updates every 2 min", which was a promise the page kept by burning the
 * visitor's entire GitHub rate limit (BADGE-RATE-1) and stopped keeping
 * silently once it ran out.
 *
 * It is deliberately the shared `Button` primitive rather than a fourth
 * hand-copied class string: `.btn-neutral:focus-visible` in `src/index.css`
 * already resolves `outline: 2px solid var(--focus-ring)`, which is exactly the
 * keyboard-reachable focus ring this slice has to carry, and it is themed in
 * both light and dark by construction. `badgeCadence.test.ts` asserts that
 * pairing from both sides so it cannot be quietly replaced with raw utilities.
 *
 * No animation, so there is nothing for `prefers-reduced-motion` to suppress:
 * the in-flight state is carried by the label and the disabled attribute.
 */
export function BadgeRefresh({
  onClick,
  refreshing,
  label = 'Refresh build status',
}: {
  onClick: () => void
  refreshing: boolean
  /** Accessible name. Contains the visible "Refresh" text (WCAG 2.5.3). */
  label?: string
}) {
  return (
    <Button
      variant="neutral"
      size="sm"
      onClick={onClick}
      disabled={refreshing}
      aria-label={label}
      aria-busy={refreshing}
    >
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </Button>
  )
}
