import { describe, expect, it } from 'vitest'
import { getSearchStateCopy } from './searchUi'

describe('searchUi', () => {
  it('returns an onboarding state for empty query', () => {
    expect(getSearchStateCopy('', 0)).toEqual({
      badge: 'Search ready',
      title: 'Start your search',
      description: 'Type a name, company, or keyword to search across accounts, contacts, opportunities, and activity.',
      actionLabel: 'Try sample search',
    })
  })

  it('returns a no-results state for populated query', () => {
    expect(getSearchStateCopy('acme', 0)).toEqual({
      badge: '0 matches',
      title: 'No results for “acme”',
      description: 'Try a broader phrase, fewer filters, or a different keyword to surface matching records.',
      actionLabel: 'Clear search',
    })
  })

  it('returns a results state summary when matches exist', () => {
    expect(getSearchStateCopy('acme', 4)).toEqual({
      badge: '4 matches',
      title: 'Results for “acme”',
      description: 'Review the grouped results below and open the records most relevant to your query.',
      actionLabel: 'Clear search',
    })
  })
})
