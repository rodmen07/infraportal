import { useMemo, useSyncExternalStore } from 'react'
import { computeServiceHealth, type HealthIndicator, type HealthLevel } from './serviceHealth'
import {
  getCompletedStepIdsSnapshot,
  onboardingPercentFor,
  subscribeToOnboardingStore,
} from '../onboarding/onboardingStore'
import { getSupportRequestsSnapshot, subscribeToSupportStore } from '../support/supportStore'

const LEVEL_DOT: Record<HealthLevel, string> = {
  good: 'bg-emerald-400',
  attention: 'bg-amber-400',
  pending: 'bg-sky-400',
}

/**
 * Reads both portal stores directly rather than caching them into state, so a
 * write from either sibling panel on this page is reflected here immediately.
 * The panel previously re-read only when `projectId` changed, which meant a
 * completed onboarding step or a newly filed support request left this summary
 * contradicting the panel right under it until the page remounted.
 */
export function ServiceHealthIndicators({ projectId }: { projectId: string }) {
  const completedSteps = useSyncExternalStore(subscribeToOnboardingStore, () =>
    getCompletedStepIdsSnapshot(projectId),
  )
  const requests = useSyncExternalStore(subscribeToSupportStore, () =>
    getSupportRequestsSnapshot(projectId),
  )

  const indicators: HealthIndicator[] = useMemo(
    () =>
      computeServiceHealth({
        onboardingPercent: onboardingPercentFor(completedSteps.length),
        openSupportCount: requests.filter((r) => r.status === 'open').length,
      }),
    [completedSteps, requests],
  )

  return (
    <div className="forge-panel surface-card-strong p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Service health</p>
          <h2 className="mt-2 text-lg font-semibold text-text-primary">Live status at a glance</h2>
          <p className="mt-1 text-sm text-text-muted">A quick read on hosting, onboarding, and support.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {indicators.map((indicator) => (
          <div key={indicator.id} className="rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT[indicator.level]}`} />
              <p className="text-sm font-semibold text-text-primary">{indicator.label}</p>
            </div>
            <p className="mt-1 text-xs text-text-muted">{indicator.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
