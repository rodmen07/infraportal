// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLeadPayload, pushConsultationToCrm } from './consultationLead'
import type { ConsultationRequest } from './consultationStore'

const baseRequest: ConsultationRequest = {
  id: 'req-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  projectType: 'Web app',
  timeline: 'Within 2 weeks',
  message: 'Need hosting.',
  createdAt: '2026-06-23T12:00:00.000Z',
  status: 'new',
}

function freshAdminToken(): string {
  const payload = btoa(JSON.stringify({ exp: 9_999_999_999 }))
  return `header.${payload}.signature`
}

describe('buildLeadPayload', () => {
  it('splits a full name into first and last with a lead stage', () => {
    expect(buildLeadPayload(baseRequest)).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      lifecycle_stage: 'lead',
    })
  })

  it('keeps multi-word last names together', () => {
    expect(buildLeadPayload({ ...baseRequest, name: 'Grace  Brewster Hopper' })).toMatchObject({
      first_name: 'Grace',
      last_name: 'Brewster Hopper',
    })
  })

  it('falls back when only one name token is given', () => {
    expect(buildLeadPayload({ ...baseRequest, name: 'Madonna' })).toMatchObject({
      first_name: 'Madonna',
      last_name: 'Lead',
    })
  })

  it('falls back when the name is empty', () => {
    expect(buildLeadPayload({ ...baseRequest, name: '   ' })).toMatchObject({
      first_name: 'Consultation',
      last_name: 'Lead',
    })
  })

  it('omits an empty email', () => {
    expect(buildLeadPayload({ ...baseRequest, email: '  ' }).email).toBeUndefined()
  })
})

describe('pushConsultationToCrm', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('requires an admin token', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch
    const result = await pushConsultationToCrm(baseRequest, fetchMock)

    expect(result).toMatchObject({ ok: false, reason: 'no-token' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts a lead and returns the new contact id', async () => {
    const token = freshAdminToken()
    window.localStorage.setItem('portal_token', token)

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'contact-123' }),
    })) as unknown as typeof fetch

    const result = await pushConsultationToCrm(baseRequest, fetchMock)

    expect(result).toEqual({ ok: true, contactId: 'contact-123' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3011/api/v1/contacts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      }),
    )
  })

  it('reports a failed request', async () => {
    window.localStorage.setItem('portal_token', freshAdminToken())

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: async () => 'validation failed',
    })) as unknown as typeof fetch

    const result = await pushConsultationToCrm(baseRequest, fetchMock)

    expect(result).toMatchObject({ ok: false, reason: 'request-failed', message: 'validation failed' })
  })
})
