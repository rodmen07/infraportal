export function getSearchStateCopy(query: string, resultCount: number) {
  const trimmed = query.trim()

  if (!trimmed) {
    return {
      badge: 'Search ready',
      title: 'Start your search',
      description: 'Type a name, company, or keyword to search across accounts, contacts, opportunities, and activity.',
      actionLabel: 'Try sample search',
    }
  }

  if (resultCount === 0) {
    return {
      badge: '0 matches',
      title: `No results for “${trimmed}”`,
      description: 'Try a broader phrase, fewer filters, or a different keyword to surface matching records.',
      actionLabel: 'Clear search',
    }
  }

  return {
    badge: `${resultCount} match${resultCount === 1 ? '' : 'es'}`,
    title: `Results for “${trimmed}”`,
    description: 'Review the grouped results below and open the records most relevant to your query.',
    actionLabel: 'Clear search',
  }
}
