import { CONTACTS_API_BASE_URL, resolveAdminToken } from '../../config'
import type { ConsultationRequest } from './consultationStore'

export interface LeadPayload {
  first_name: string
  last_name: string
  email?: string
  lifecycle_stage: 'lead'
}

export interface CrmContactResponse {
  id: string
}

export type CrmSyncResult =
  | { ok: true; contactId: string }
  | { ok: false; reason: 'not-configured' | 'no-token' | 'request-failed'; message: string }

/**
 * Builds the CRM contact payload for a consultation request.
 * Splits the submitted name into first/last and tags the record as a lead so
 * it lands in the same pipeline the CRM admin page reads from.
 */
export function buildLeadPayload(request: ConsultationRequest): LeadPayload {
  const parts = request.name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  const rest = parts.slice(1).join(' ')
  const email = request.email.trim()

  return {
    first_name: first || 'Consultation',
    last_name: rest || 'Lead',
    email: email || undefined,
    lifecycle_stage: 'lead',
  }
}

/**
 * Pushes a consultation request into the CRM contacts-service as a lead.
 * Requires the admin context (resolveAdminToken) and a configured contacts URL,
 * matching the trust boundary of the rest of the admin tooling.
 */
export async function pushConsultationToCrm(
  request: ConsultationRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<CrmSyncResult> {
  if (!CONTACTS_API_BASE_URL) {
    return { ok: false, reason: 'not-configured', message: 'Contacts API not configured (VITE_CONTACTS_API_BASE_URL).' }
  }

  const token = resolveAdminToken()
  if (!token) {
    return { ok: false, reason: 'no-token', message: 'Sign in as an admin to sync leads to the CRM.' }
  }

  try {
    const res = await fetchImpl(`${CONTACTS_API_BASE_URL}/api/v1/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildLeadPayload(request)),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, reason: 'request-failed', message: detail || `${res.status} ${res.statusText}` }
    }

    const contact = (await res.json()) as CrmContactResponse
    return { ok: true, contactId: contact.id }
  } catch (error) {
    return { ok: false, reason: 'request-failed', message: error instanceof Error ? error.message : String(error) }
  }
}
