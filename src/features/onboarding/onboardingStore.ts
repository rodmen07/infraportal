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
}

/**
 * Returns the completed step ids for a project, filtered to known steps and
 * ordered to match DEFAULT_ONBOARDING_STEPS so the UI stays stable.
 */
export function getCompletedStepIds(projectId: string): string[] {
  const completed = new Set(readCompleted(projectId))
  return DEFAULT_ONBOARDING_STEPS.filter((step) => completed.has(step.id)).map((step) => step.id)
}

export function setStepCompleted(projectId: string, stepId: string, completed: boolean): string[] {
  const current = new Set(getCompletedStepIds(projectId))
  if (completed) current.add(stepId)
  else current.delete(stepId)

  const next = DEFAULT_ONBOARDING_STEPS.filter((step) => current.has(step.id)).map((step) => step.id)
  writeCompleted(projectId, next)
  return next
}

export function getOnboardingProgress(projectId: string): { completed: number; total: number; percent: number } {
  const total = DEFAULT_ONBOARDING_STEPS.length
  const completed = getCompletedStepIds(projectId).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { completed, total, percent }
}
