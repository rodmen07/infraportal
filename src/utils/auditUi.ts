export interface AuditFiltersLike {
  entity_type?: string
  action?: string
  actor_id?: string
  created_after?: string
  created_before?: string
}

export function countActiveAuditFilters(filters: AuditFiltersLike): number {
  return [
    filters.entity_type,
    filters.action,
    filters.actor_id,
    filters.created_after,
    filters.created_before,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).length
}

export function getAuditEmptyState(filters: AuditFiltersLike) {
  const activeFilters = countActiveAuditFilters(filters)

  if (activeFilters === 0) {
    return {
      badge: 'Awaiting activity',
      title: 'No audit events yet',
      description: 'When CRM actions are created, updated, or deleted, they will appear here for review.',
      actionLabel: 'Refresh',
    }
  }

  return {
    badge: `${activeFilters} filter${activeFilters === 1 ? '' : 's'} active`,
    title: 'No matching audit events',
    description: 'Try broadening the filters or clearing them to surface more activity in the audit stream.',
    actionLabel: 'Clear filters',
  }
}
