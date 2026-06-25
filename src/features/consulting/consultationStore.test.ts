// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  attachCrmContact,
  clearConsultationRequests,
  getConsultationRequests,
  saveConsultationRequest,
  updateConsultationStatus,
} from './consultationStore'
import { getLeadPriority } from './leadScoring'

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

    expect(getConsultationRequests()).toEqual([
      expect.objectContaining({
        ...request,
        leadScore: expect.any(Number),
        leadPriority: expect.any(String),
      }),
    ])
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
    expect(getConsultationRequests()[0].firstResponseAt).toBeTypeOf('string')
    expect(getConsultationRequests()[0].firstResponseMinutes).toBeTypeOf('number')

    updateConsultationStatus('req-2', 'accepted')
    expect(getConsultationRequests()[0].status).toBe('accepted')
    expect(getConsultationRequests()[0].firstResponseAt).toBeTypeOf('string')
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

  it('attaches a CRM contact id to a request', () => {
    const request = {
      id: 'req-3',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      projectType: 'Client portal',
      timeline: 'Next month',
      message: 'Want managed hosting for a launch.',
      createdAt: '2026-06-23T12:00:00.000Z',
      status: 'new' as const,
    }

    saveConsultationRequest(request)
    attachCrmContact('req-3', 'contact-123')

    expect(getConsultationRequests()[0].crmContactId).toBe('contact-123')
  })

  it('hydrates lead metadata for new requests', () => {
    const request = {
      id: 'req-4',
      name: 'Dorothy Vaughan',
      email: 'dorothy@example.com',
      projectType: 'Monthly retainer',
      budget: '$15k+',
      timeline: 'Within 2 weeks',
      message: 'Need an external platform engineering partner for the next quarter.',
      createdAt: '2026-06-23T12:00:00.000Z',
      status: 'new' as const,
    }

    saveConsultationRequest(request)

    const stored = getConsultationRequests()[0]
    expect(stored.leadScore).toBeTypeOf('number')
    expect(stored.leadPriority).toBe(getLeadPriority(stored.leadScore ?? 0))
  })

  it('backfills budget and lead metadata from legacy message prefixes', () => {
    const legacyRequest = {
      id: 'req-legacy',
      name: 'Legacy Lead',
      email: 'legacy@example.com',
      projectType: 'Launch sprint',
      timeline: 'Next month',
      message: '$5k–$15k budget. Need help stabilizing and shipping a release.',
      createdAt: '2026-06-23T12:00:00.000Z',
      status: 'new' as const,
    }

    window.localStorage.setItem('managed-hosting-consultations', JSON.stringify([legacyRequest]))

    const stored = getConsultationRequests()[0]
    expect(stored.budget).toBe('$5k-$15k')
    expect(stored.leadScore).toBeTypeOf('number')
    expect(stored.leadPriority).toBe(getLeadPriority(stored.leadScore ?? 0))
  })

  it('does not capture first response timestamp when skipping directly to accepted', () => {
    const request = {
      id: 'req-5',
      name: 'Direct Accept',
      email: 'accept@example.com',
      projectType: 'Security review',
      timeline: 'Within 2 weeks',
      message: 'We need fast approval support.',
      createdAt: '2026-06-23T12:00:00.000Z',
      status: 'new' as const,
    }

    saveConsultationRequest(request)
    updateConsultationStatus('req-5', 'accepted')

    const stored = getConsultationRequests()[0]
    expect(stored.status).toBe('accepted')
    expect(stored.firstResponseAt).toBeUndefined()
    expect(stored.firstResponseMinutes).toBeUndefined()
  })
})
