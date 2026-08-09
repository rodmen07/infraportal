import { createRawSnapshotCache, createStoreSubscription } from '../../utils/externalStore'

export interface OnboardingStep {
  id: string
  label: string
  description: string
}

export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'kickoff', label: 'Kickoff call', description: 'Confirm goals, scope, and launch timeline.' },
  { id: 'repo-access', label: 'Share repository access', description: 'Grant access to the app you want hosted.' },
  { id: 'deploy', label: 'Deployment setup', description: 'Provision hosting and run the first deploy.' },
  { id: 'domain', label: 'Domain and SSL', description: 'Connect your domain and issue certificates.' },
  { id: 'monitoring', label: 'Monitoring and alerts', description: 'Turn on uptime checks and health alerts.' },
  { id: 'handoff', label: 'Launch review', description: 'Walk through the live setup and support plan.' },
]

const STORAGE_PREFIX = 'managed-hosting-onboarding:'

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`
}

const subscription = createStoreSubscription((key) => key.startsWith(STORAGE_PREFIX))

/** Subscribe to every onboarding write, in the shape `useSyncExternalStore` expects. */
export const subscribeToOnboardingStore = subscription.subscribe

function readRaw(projectId: string): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(storageKey(projectId)) ?? ''
}

function readCompleted(projectId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeCompleted(projectId: string, completed: string[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(completed))
  subscription.notify()
}

/**
 * Returns the completed step ids for a project, filtered to known steps and
 * ordered to match DEFAULT_ONBOARDING_STEPS so the UI stays stable.
 */
export function getCompletedStepIds(projectId: string): string[] {
  const completed = new Set(readCompleted(projectId))
  return DEFAULT_ONBOARDING_STEPS.filter((step) => completed.has(step.id)).map((step) => step.id)
}

const completedSnapshot = createRawSnapshotCache(getCompletedStepIds)

/**
 * `getCompletedStepIds` with a stable reference while the stored bytes are
 * unchanged, so a component may read it on every render.
 */
export function getCompletedStepIdsSnapshot(projectId: string): string[] {
  return completedSnapshot(projectId, readRaw(projectId))
}

export function setStepCompleted(projectId: string, stepId: string, completed: boolean): string[] {
  const current = new Set(getCompletedStepIds(projectId))
  if (completed) current.add(stepId)
  else current.delete(stepId)

  const next = DEFAULT_ONBOARDING_STEPS.filter((step) => current.has(step.id)).map((step) => step.id)
  writeCompleted(projectId, next)
  return next
}

/**
 * The one place the completion percentage is computed. The checklist renders it
 * from a snapshot it already holds and the health panel derives it from the
 * same snapshot, so neither may re-implement the formula.
 */
export function onboardingPercentFor(completedCount: number): number {
  const total = DEFAULT_ONBOARDING_STEPS.length
  return total === 0 ? 0 : Math.round((completedCount / total) * 100)
}

export function getOnboardingProgress(projectId: string): { completed: number; total: number; percent: number } {
  const completed = getCompletedStepIds(projectId).length
  return { completed, total: DEFAULT_ONBOARDING_STEPS.length, percent: onboardingPercentFor(completed) }
}
