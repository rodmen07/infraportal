// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSupportRequests,
  createSupportRequest,
  getAllSupportRequests,
  getSupportRequests,
  removeSupportRequest,
  updateSupportStatus,
} from './supportStore'

describe('supportStore', () => {
  beforeEach(() => {
    clearSupportRequests('project-1')
    clearSupportRequests('project-2')
  })

  it('creates a request with open status and prepends it', () => {
    createSupportRequest({ projectId: 'project-1', category: 'Bug', subject: 'First', message: 'one' })
    createSupportRequest({ projectId: 'project-1', category: 'Maintenance', subject: 'Second', message: 'two' })

    const requests = getSupportRequests('project-1')
    expect(requests).toHaveLength(2)
    expect(requests[0].subject).toBe('Second')
    expect(requests[0].status).toBe('open')
  })

  it('trims subject and message', () => {
    const request = createSupportRequest({
      projectId: 'project-1',
      category: 'Question',
      subject: '  spaced  ',
      message: '  body  ',
    })

    expect(request.subject).toBe('spaced')
    expect(request.message).toBe('body')
  })

  it('updates the status of a request', () => {
    const request = createSupportRequest({ projectId: 'project-1', category: 'Bug', subject: 'S', message: 'm' })
    updateSupportStatus('project-1', request.id, 'resolved')

    expect(getSupportRequests('project-1')[0].status).toBe('resolved')
  })

  it('removes a request', () => {
    const request = createSupportRequest({ projectId: 'project-1', category: 'Bug', subject: 'S', message: 'm' })
    removeSupportRequest('project-1', request.id)

    expect(getSupportRequests('project-1')).toHaveLength(0)
  })

  it('keeps requests isolated per project', () => {
    createSupportRequest({ projectId: 'project-1', category: 'Bug', subject: 'S', message: 'm' })

    expect(getSupportRequests('project-1')).toHaveLength(1)
    expect(getSupportRequests('project-2')).toHaveLength(0)
  })

  it('aggregates requests across all projects, newest first', () => {
    createSupportRequest({ projectId: 'project-1', category: 'Bug', subject: 'Older', message: 'm' })
    createSupportRequest({ projectId: 'project-2', category: 'Maintenance', subject: 'Newer', message: 'm' })

    const all = getAllSupportRequests()
    expect(all).toHaveLength(2)
    expect(all.map((r) => r.subject)).toContain('Older')
    expect(all.map((r) => r.subject)).toContain('Newer')
  })
})
