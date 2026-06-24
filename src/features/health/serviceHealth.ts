export type HealthLevel = 'good' | 'attention' | 'pending'

export interface HealthIndicator {
  id: string
  label: string
  level: HealthLevel
  detail: string
}

export interface ServiceHealthInput {
  onboardingPercent: number
  openSupportCount: number
}

/**
 * Derives a small set of service health indicators from the client's current
 * state. Onboarding and support reflect live local data; uptime and backups
 * represent the always-on managed-service baseline.
 */
export function computeServiceHealth(input: ServiceHealthInput): HealthIndicator[] {
  const percent = Math.max(0, Math.min(100, Math.round(input.onboardingPercent)))
  const openCount = Math.max(0, Math.round(input.openSupportCount))

  const onboarding: HealthIndicator =
    percent >= 100
      ? { id: 'onboarding', label: 'Onboarding', level: 'good', detail: 'All launch steps complete' }
      : { id: 'onboarding', label: 'Onboarding', level: 'pending', detail: `${percent}% complete` }

  const support: HealthIndicator =
    openCount === 0
      ? { id: 'support', label: 'Support queue', level: 'good', detail: 'No open requests' }
      : {
          id: 'support',
          label: 'Support queue',
          level: 'attention',
          detail: `${openCount} open request${openCount === 1 ? '' : 's'}`,
        }

  const uptime: HealthIndicator = { id: 'uptime', label: 'Uptime monitoring', level: 'good', detail: 'Checks running' }
  const backups: HealthIndicator = { id: 'backups', label: 'Backups', level: 'good', detail: 'Scheduled daily' }

  return [uptime, onboarding, support, backups]
}
