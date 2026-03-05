const configuredUrl = (import.meta.env.VITE_CONTACTS_API_BASE_URL ?? '').trim()
export const CONTACTS_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:3011'

export interface Contact {
  id: string
  account_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  lifecycle_stage: 'lead' | 'prospect' | 'customer' | 'churned' | 'evangelist'
  created_at: string
  updated_at: string
}

export interface ListContactsResponse {
  data: Contact[]
  total: number
  limit: number
  offset: number
}

export interface ListContactsParams {
  limit?: number
  offset?: number
  account_id?: string
  lifecycle_stage?: string
  q?: string
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CONTACTS_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(payload.message ?? `Request failed (${response.status})`)
  }

  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

export async function listContacts(
  token: string,
  params: ListContactsParams = {},
): Promise<ListContactsResponse> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  if (params.account_id) qs.set('account_id', params.account_id)
  if (params.lifecycle_stage) qs.set('lifecycle_stage', params.lifecycle_stage)
  if (params.q) qs.set('q', params.q)
  const query = qs.toString()
  return request<ListContactsResponse>(token, `/api/v1/contacts${query ? `?${query}` : ''}`)
}

export async function createContact(
  token: string,
  body: {
    first_name: string
    last_name: string
    email?: string
    phone?: string
    account_id?: string
    lifecycle_stage?: string
  },
): Promise<Contact> {
  return request<Contact>(token, '/api/v1/contacts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateContact(
  token: string,
  id: string,
  body: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    account_id?: string
    lifecycle_stage?: string
  },
): Promise<Contact> {
  return request<Contact>(token, `/api/v1/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteContact(token: string, id: string): Promise<void> {
  return request<void>(token, `/api/v1/contacts/${id}`, { method: 'DELETE' })
}
