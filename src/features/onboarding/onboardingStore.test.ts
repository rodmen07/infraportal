// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ONBOARDING_STEPS,
  getCompletedStepIds,
  getOnboardingProgress,
  setStepCompleted,
} from './onboardingStore'

describe('onboardingStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts with no completed steps', () => {
    expect(getCompletedStepIds('project-1')).toEqual([])
    expect(getOnboardingProgress('project-1')).toEqual({
      completed: 0,
      total: DEFAULT_ONBOARDING_STEPS.length,
      percent: 0,
    })
  })

  it('marks a step complete and persists it', () => {
    setStepCompleted('project-1', 'deploy', true)

    expect(getCompletedStepIds('project-1')).toContain('deploy')
    expect(getOnboardingProgress('project-1').completed).toBe(1)
  })

  it('unmarks a completed step', () => {
    setStepCompleted('project-1', 'deploy', true)
    setStepCompleted('project-1', 'deploy', false)

    expect(getCompletedStepIds('project-1')).not.toContain('deploy')
    expect(getOnboardingProgress('project-1').completed).toBe(0)
  })

  it('orders completed ids to match the default step order', () => {
    setStepCompleted('project-1', 'monitoring', true)
    setStepCompleted('project-1', 'kickoff', true)

    expect(getCompletedStepIds('project-1')).toEqual(['kickoff', 'monitoring'])
  })

  it('ignores unknown step ids', () => {
    setStepCompleted('project-1', 'not-a-real-step', true)

    expect(getCompletedStepIds('project-1')).toEqual([])
  })

  it('keeps progress isolated per project', () => {
    setStepCompleted('project-1', 'deploy', true)

    expect(getOnboardingProgress('project-1').completed).toBe(1)
    expect(getOnboardingProgress('project-2').completed).toBe(0)
  })

  it('reaches 100 percent when every step is complete', () => {
    for (const step of DEFAULT_ONBOARDING_STEPS) {
      setStepCompleted('project-1', step.id, true)
    }

    expect(getOnboardingProgress('project-1').percent).toBe(100)
  })
})
