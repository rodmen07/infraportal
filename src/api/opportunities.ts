const configuredUrl = (import.meta.env.VITE_OPPORTUNITIES_API_BASE_URL ?? '').trim()
export const OPPORTUNITIES_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:3012'

export interface Opportunity {
  id: string
  name: string
  account_id: string
  stage: string
  amount: number
  close_date: string | null
  created_at: string
  updated_at: string
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${OPPORTUNITIES_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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

export async function listOpportunities(token: string): Promise<Opportunity[]> {
  return request<Opportunity[]>(token, '/api/v1/opportunities')
}

export async function getOpportunity(token: string, id: string): Promise<Opportunity> {
  return request<Opportunity>(token, `/api/v1/opportunities/${id}`)
}

export async function createOpportunity(
  token: string,
  body: {
    name: string
    account_id: string
    stage?: string
    amount?: number
    close_date?: string
  },
): Promise<Opportunity> {
  return request<Opportunity>(token, '/api/v1/opportunities', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateOpportunity(
  token: string,
  id: string,
  body: {
    name?: string
    stage?: string
    amount?: number
    close_date?: string
  },
): Promise<Opportunity> {
  return request<Opportunity>(token, `/api/v1/opportunities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteOpportunity(token: string, id: string): Promise<void> {
  return request<void>(token, `/api/v1/opportunities/${id}`, { method: 'DELETE' })
}
