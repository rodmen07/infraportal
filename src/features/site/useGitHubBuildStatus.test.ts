import { describe, expect, it } from 'vitest'
import { mapStatus } from './useGitHubBuildStatus'

describe('mapStatus', () => {
  it('returns unknown for missing run', () => {
    expect(mapStatus(undefined)).toBe('unknown')
  })

  it('maps queued and in_progress to yellow', () => {
    expect(
      mapStatus({
        status: 'queued',
        conclusion: null,
        html_url: '',
        created_at: '',
      }),
    ).toBe('yellow')

    expect(
      mapStatus({
        status: 'in_progress',
        conclusion: null,
        html_url: '',
        created_at: '',
      }),
    ).toBe('yellow')
  })

  it('maps completed success/skipped to green', () => {
    expect(
      mapStatus({
        status: 'completed',
        conclusion: 'success',
        html_url: '',
        created_at: '',
      }),
    ).toBe('green')

    expect(
      mapStatus({
        status: 'completed',
        conclusion: 'skipped',
        html_url: '',
        created_at: '',
      }),
    ).toBe('green')
  })

  it('maps completed failures to red', () => {
    expect(
      mapStatus({
        status: 'completed',
        conclusion: 'failure',
        html_url: '',
        created_at: '',
      }),
    ).toBe('red')
  })
})
