// ---------------------------------------------------------------------------
// NotFoundPage (2026-07-25): the router's catch-all for any hash that no
// explicit route in src/main.tsx handles. It replaces the old behaviour where
// an unknown hash fell through to `<App />` (Home) with no signal at all, so a
// stale bookmark, a typo'd deep link, or a route renamed out of the router
// dropped the visitor on the marketing home page as if nothing were wrong.
//
// Structure only leans on shipped, tokenized building blocks so it is correct
// in both themes and keyboard-reachable by construction:
//   - PageLayout  gives the TopNav (a real <nav> the boot watchdog looks for),
//                 the SkipLink, and the labelled <main id="main-content">
//                 landmark, all on semantic tokens.
//   - PageHeader  gives the one shared page-heading shape.
//   - Button      gives focus-visible, reduced-motion-safe CTAs (btn-accent /
//                 btn-neutral recipes), so no raw amber/opacity classes are
//                 introduced here.
// The recovery links point only at funnel-safe, publicly viewable surfaces.
// ---------------------------------------------------------------------------
import { useEffect } from 'react'
import { PageLayout } from './PageLayout'
import { PageHeader } from '../features/site/PageHeader'
import { Button } from '../components/ui/Button'
import { trackPortfolioEvent } from '../utils/analytics'
import { PORTFOLIO_EVENTS } from '../utils/analyticsEvents'
import { NOT_FOUND_RECOVERY_LINKS } from './notFoundLinks'

export function NotFoundPage() {
  // The hash the visitor actually landed on, shown back so a broken link is
  // legible rather than mysterious. Read once at render; the router remounts
  // this component on every hashchange, so it always reflects the live hash.
  const attempted = typeof window !== 'undefined' ? window.location.hash : ''

  useEffect(() => {
    // Fires the registered route_not_found event for broken inbound links
    // (stale bookmarks, mistyped share URLs). Until the v1.22.2 sink is wired
    // this reaches only the in-page portfolio:analytics CustomEvent (see
    // src/utils/analytics.ts); once a sink records it, these become
    // measurable rather than invisible.
    trackPortfolioEvent(PORTFOLIO_EVENTS.route_not_found, { path: attempted || '(root)' })
  }, [attempted])

  return (
    <PageLayout>
      <PageHeader
        kicker="404"
        title="Page not found"
        subtitle={
          <>
            <p>
              The page you were looking for does not exist, or the link that brought you here is out of date. Nothing is
              broken on your end.
            </p>
            {attempted && attempted !== '#/' && (
              <p className="mt-3">
                You tried to reach{' '}
                <code className="rounded bg-surface-control px-1.5 py-0.5 font-mono text-scale-xs text-text-secondary">
                  {attempted}
                </code>
                .
              </p>
            )}
          </>
        }
        actions={NOT_FOUND_RECOVERY_LINKS.map((link) => (
          <Button key={link.href} as="a" href={link.href} variant={link.variant}>
            {link.label}
          </Button>
        ))}
      />
    </PageLayout>
  )
}
