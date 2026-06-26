// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  buildIntakePayload,
  buildLeadMagnetIntakePayload,
  submitLeadMagnetLead,
  submitPublicLead,
} from './leadIntake'
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

const leadMagnetRequest = {
  email: '  founder@example.com ',
  magnet: 'infrastructure-audit-checklist',
  source: 'lead-magnet-page',
  checklistWebUrl: '#/lead-magnet',
  checklistPrintableUrl: '/infraportal/downloads/infrastructure-audit-checklist.html',
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

describe('buildLeadMagnetIntakePayload', () => {
  it('maps lead magnet data into the intake shape with metadata', () => {
    expect(buildLeadMagnetIntakePayload(leadMagnetRequest)).toEqual({
      name: 'Checklist Subscriber',
      email: 'founder@example.com',
      project_type: 'Infrastructure audit checklist',
      timeline: 'Self-serve resource',
      message: 'Requested the Infrastructure Audit Checklist lead magnet.',
      event_type: 'lead_magnet',
      lead_source: 'lead-magnet-page',
      magnet_slug: 'infrastructure-audit-checklist',
      delivery_mode: 'hybrid',
      sequence_name: 'infrastructure-audit-3-email',
      sequence_days: [0, 3, 7, 14],
      checklist_web_url: '#/lead-magnet',
      checklist_printable_url: '/infraportal/downloads/infrastructure-audit-checklist.html',
    })
  })
})

describe('submitLeadMagnetLead', () => {
  it('no-ops when no intake url is configured', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch
    const result = await submitLeadMagnetLead(leadMagnetRequest, fetchMock, '')

    expect(result).toMatchObject({ ok: false, reason: 'not-configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts lead magnet metadata to configured endpoint', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch
    const result = await submitLeadMagnetLead(leadMagnetRequest, fetchMock, 'https://intake.example/leads')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://intake.example/leads',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
