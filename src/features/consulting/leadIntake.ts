import { LEAD_INTAKE_URL } from '../../config'
import type { ConsultationRequest } from './consultationStore'

export interface LeadIntakePayload {
  name: string
  email: string
  project_type: string
  timeline: string
  message: string
}

export interface LeadMagnetRequest {
  email: string
  magnet: string
  source: string
  checklistWebUrl: string
  checklistPrintableUrl: string
}

export interface LeadMagnetIntakePayload extends LeadIntakePayload {
  event_type: 'lead_magnet'
  lead_source: string
  magnet_slug: string
  delivery_mode: 'hybrid'
  sequence_name: string
  sequence_days: number[]
  checklist_web_url: string
  checklist_printable_url: string
}

export type LeadIntakeResult =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'request-failed'; message: string }

export function buildIntakePayload(request: ConsultationRequest): LeadIntakePayload {
  return {
    name: request.name.trim(),
    email: request.email.trim(),
    project_type: request.projectType,
    timeline: request.timeline,
    message: request.message.trim(),
  }
}

export function buildLeadMagnetIntakePayload(request: LeadMagnetRequest): LeadMagnetIntakePayload {
  return {
    name: 'Checklist Subscriber',
    email: request.email.trim(),
    project_type: 'Infrastructure audit checklist',
    timeline: 'Self-serve resource',
    message: 'Requested the Infrastructure Audit Checklist lead magnet.',
    event_type: 'lead_magnet',
    lead_source: request.source,
    magnet_slug: request.magnet,
    delivery_mode: 'hybrid',
    sequence_name: 'infrastructure-audit-3-email',
    sequence_days: [0, 3, 7, 14],
    checklist_web_url: request.checklistWebUrl,
    checklist_printable_url: request.checklistPrintableUrl,
  }
}

/**
 * Best-effort submission of a consultation to a public lead-intake endpoint.
 * The endpoint is unauthenticated by design, so this never sends credentials.
 * When VITE_LEAD_INTAKE_URL is unset (the default), it no-ops and the caller
 * keeps the local-only behavior.
 */
export async function submitPublicLead(
  request: ConsultationRequest,
  fetchImpl: typeof fetch = fetch,
  url: string = LEAD_INTAKE_URL,
): Promise<LeadIntakeResult> {
  if (!url) {
    return { ok: false, reason: 'not-configured', message: 'Public lead intake not configured (VITE_LEAD_INTAKE_URL).' }
  }

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildIntakePayload(request)),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, reason: 'request-failed', message: detail || `${res.status} ${res.statusText}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'request-failed', message: error instanceof Error ? error.message : String(error) }
  }
}

export async function submitLeadMagnetLead(
  request: LeadMagnetRequest,
  fetchImpl: typeof fetch = fetch,
  url: string = LEAD_INTAKE_URL,
): Promise<LeadIntakeResult> {
  if (!url) {
    return { ok: false, reason: 'not-configured', message: 'Public lead intake not configured (VITE_LEAD_INTAKE_URL).' }
  }

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLeadMagnetIntakePayload(request)),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, reason: 'request-failed', message: detail || `${res.status} ${res.statusText}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'request-failed', message: error instanceof Error ? error.message : String(error) }
  }
}
