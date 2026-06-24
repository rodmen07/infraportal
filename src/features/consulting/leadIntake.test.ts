// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { buildIntakePayload, submitPublicLead } from './leadIntake'
import type { ConsultationRequest } from './consultationStore'

const baseRequest: ConsultationRequest = {
  id: 'req-1',
  name: '  Ada Lovelace  ',
  email: '  ada@example.com ',
  projectType: 'Web app',
  timeline: 'Within 2 weeks',
  message: '  Need hosting.  ',
  createdAt: '2026-06-23T12:00:00.000Z',
  status: 'new',
}

describe('buildIntakePayload', () => {
  it('trims fields and maps to the intake shape', () => {
    expect(buildIntakePayload(baseRequest)).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      project_type: 'Web app',
      timeline: 'Within 2 weeks',
      message: 'Need hosting.',
    })
  })
})

describe('submitPublicLead', () => {
  it('no-ops when no intake url is configured', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch
    const result = await submitPublicLead(baseRequest, fetchMock, '')

    expect(result).toMatchObject({ ok: false, reason: 'not-configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the lead to the configured url', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch
    const result = await submitPublicLead(baseRequest, fetchMock, 'https://intake.example/leads')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://intake.example/leads',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('reports a failed request', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'boom',
    })) as unknown as typeof fetch

    const result = await submitPublicLead(baseRequest, fetchMock, 'https://intake.example/leads')

    expect(result).toMatchObject({ ok: false, reason: 'request-failed', message: 'boom' })
  })
})
