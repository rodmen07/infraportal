import { describe, expect, it } from 'vitest'
import { computeServiceHealth } from './serviceHealth'

describe('computeServiceHealth', () => {
  it('marks onboarding good when complete and support good when clear', () => {
    const indicators = computeServiceHealth({ onboardingPercent: 100, openSupportCount: 0 })
    const onboarding = indicators.find((i) => i.id === 'onboarding')
    const support = indicators.find((i) => i.id === 'support')

    expect(onboarding?.level).toBe('good')
    expect(support?.level).toBe('good')
  })

  it('marks onboarding pending and shows percent when incomplete', () => {
    const onboarding = computeServiceHealth({ onboardingPercent: 40, openSupportCount: 0 }).find(
      (i) => i.id === 'onboarding',
    )

    expect(onboarding?.level).toBe('pending')
    expect(onboarding?.detail).toContain('40%')
  })

  it('flags support attention with a pluralized count', () => {
    const single = computeServiceHealth({ onboardingPercent: 100, openSupportCount: 1 }).find(
      (i) => i.id === 'support',
    )
    const many = computeServiceHealth({ onboardingPercent: 100, openSupportCount: 3 }).find(
      (i) => i.id === 'support',
    )

    expect(single?.level).toBe('attention')
    expect(single?.detail).toBe('1 open request')
    expect(many?.detail).toBe('3 open requests')
  })

  it('clamps out-of-range onboarding percent', () => {
    const low = computeServiceHealth({ onboardingPercent: -20, openSupportCount: 0 }).find(
      (i) => i.id === 'onboarding',
    )
    const high = computeServiceHealth({ onboardingPercent: 140, openSupportCount: 0 }).find(
      (i) => i.id === 'onboarding',
    )

    expect(low?.detail).toContain('0%')
    expect(high?.level).toBe('good')
  })

  it('always includes the baseline uptime and backups indicators', () => {
    const ids = computeServiceHealth({ onboardingPercent: 0, openSupportCount: 0 }).map((i) => i.id)
    expect(ids).toContain('uptime')
    expect(ids).toContain('backups')
  })
})
