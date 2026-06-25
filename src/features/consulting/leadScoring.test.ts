import { describe, expect, it } from 'vitest'
import { calculateLeadScore, extractLegacyBudgetFromMessage, getLeadPriority } from './leadScoring'

describe('leadScoring', () => {
  it('assigns higher scores to stronger commercial signals', () => {
    const low = calculateLeadScore({
      engagement: 'Discovery audit',
      budget: 'Under $5k',
      timeline: 'Planning stage',
      message: 'Need general advice.',
    })

    const high = calculateLeadScore({
      engagement: 'Monthly retainer',
      budget: '$15k+',
      timeline: 'Within 2 weeks',
      message:
        'Need an on-call partner for releases, observability, incident response, and platform migrations this quarter.',
    })

    expect(high).toBeGreaterThan(low)
    expect(getLeadPriority(high)).toBe('hot')
  })

  it('maps score bands to lead priority', () => {
    expect(getLeadPriority(70)).toBe('hot')
    expect(getLeadPriority(45)).toBe('warm')
    expect(getLeadPriority(44)).toBe('nurture')
  })

  it('extracts legacy budget prefixes from old stored messages', () => {
    expect(extractLegacyBudgetFromMessage('Under $5k budget. Looking for a quick architecture review.')).toBe('Under $5k')
    expect(extractLegacyBudgetFromMessage('$5k–$15k budget. Ready to launch this month.')).toBe('$5k-$15k')
    expect(extractLegacyBudgetFromMessage('$15k+ budget. Need a retained team.')).toBe('$15k+')
  })
})
