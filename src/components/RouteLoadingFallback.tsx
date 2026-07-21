// v1.18.5 (F12): shared Suspense fallback for lazy-loaded routes. Reuses the
// existing Skeleton primitives (src/components/Skeleton.tsx, already used by
// ObservaboardPage/AuditPage/ReportsPage/SearchPage/ServiceHealthPage/
// UserDashboardPage for their own in-page loading states) instead of
// inventing a new loading convention, and mirrors PageLayout's shell
// (forge-grid background, TopNav, max-w-5xl container) so the chrome stays
// on screen while a route chunk downloads rather than flashing to a blank
// frame. TopNav is already part of the initial chunk (statically imported by
// App.tsx and PageLayout.tsx), so rendering it here during Suspense adds no
// extra weight to any lazy chunk.
import { TopNav } from '../features/layout/TopNav'
import { SkipLink } from '../features/layout/SkipLink'
import { Skeleton, SkeletonText } from './Skeleton'

export function RouteLoadingFallback() {
  return (
    <>
      <SkipLink />
      <div className="forge-grid relative min-h-screen px-2 py-6 text-text-primary sm:px-4 sm:py-8 lg:px-8 xl:px-10">
        <div className="pointer-events-none absolute inset-0 overflow-clip">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        </div>

        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
          <TopNav />

          <main aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
            <span className="sr-only">Loading page…</span>
            <div className="forge-panel surface-card-strong space-y-4 p-5 sm:p-6">
              <Skeleton height="1.75rem" width="40%" />
              <SkeletonText lines={3} />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
