// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearConsultationRequests,
  getConsultationRequests,
  saveConsultationRequest,
  updateConsultationStatus,
} from './consultationStore'

describe('consultationStore', () => {
  beforeEach(() => {
    clearConsultationRequests()
  })

  it('persists consultation requests in local storage', () => {
    const request = {
      id: 'req-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      projectType: 'Web app',
      timeline: 'Within 2 weeks',
      message: 'Need help launching an app.',
      createdAt: '2026-06-23T12:00:00.000Z',
      status: 'new' as const,
    }

    saveConsultationRequest(request)

    expect(getConsultationRequests()).toEqual([request])
  })

  it('advances a request through its review lifecycle', () => {
    const request = {
      id: 'req-2',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      projectType: 'Client portal',
      timeline: 'Next month',
      message: 'Want managed hosting for a launch.',
      createdAt: '2026-06-23T12:00:00.000Z',
      status: 'new' as const,
    }

    saveConsultationRequest(request)
    updateConsultationStatus('req-2', 'reviewed')

    expect(getConsultationRequests()[0].status).toBe('reviewed')

    updateConsultationStatus('req-2', 'accepted')
    expect(getConsultationRequests()[0].status).toBe('accepted')
  })

  it('leaves other requests untouched when updating one status', () => {
    const base = {
      email: 'team@example.com',
      projectType: 'Internal tool',
      timeline: 'Planning stage',
      message: 'Exploring options.',
      createdAt: '2026-06-23T12:00:00.000Z',
      status: 'new' as const,
    }

    saveConsultationRequest({ ...base, id: 'req-a', name: 'Alan Turing' })
    saveConsultationRequest({ ...base, id: 'req-b', name: 'Katherine Johnson' })

    updateConsultationStatus('req-b', 'accepted')

    const requests = getConsultationRequests()
    expect(requests.find((r) => r.id === 'req-a')?.status).toBe('new')
    expect(requests.find((r) => r.id === 'req-b')?.status).toBe('accepted')
  })
})
