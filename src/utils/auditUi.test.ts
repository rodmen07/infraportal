import { describe, expect, it } from 'vitest'
import { countActiveAuditFilters, getAuditEmptyState } from './auditUi'

describe('auditUi', () => {
  it('counts only non-empty filters', () => {
    expect(countActiveAuditFilters({
      entity_type: 'contact',
      action: '',
      actor_id: 'user-123',
      created_after: '',
      created_before: '2026-04-18T06:00',
    })).toBe(3)
  })

  it('returns the default empty state when no filters are active', () => {
    expect(getAuditEmptyState({
      entity_type: '',
      action: '',
      actor_id: '',
      created_after: '',
      created_before: '',
    })).toEqual({
      badge: 'Awaiting activity',
      title: 'No audit events yet',
      description: 'When CRM actions are created, updated, or deleted, they will appear here for review.',
      actionLabel: 'Refresh',
    })
  })

  it('returns a filtered empty state when filters are active', () => {
    expect(getAuditEmptyState({
      entity_type: 'account',
      action: 'deleted',
      actor_id: '',
      created_after: '',
      created_before: '',
    })).toEqual({
      badge: '2 filters active',
      title: 'No matching audit events',
      description: 'Try broadening the filters or clearing them to surface more activity in the audit stream.',
      actionLabel: 'Clear filters',
    })
  })
})
