const configuredUrl = (import.meta.env.VITE_INTEGRATIONS_API_BASE_URL ?? '').trim()
export const INTEGRATIONS_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:3015'

export interface IntegrationConnection {
  id: string
  provider: string
  account_ref: string
  status: string
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${INTEGRATIONS_BASE_URL}${path}`, {
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

export async function listConnections(token: string): Promise<IntegrationConnection[]> {
  return request<IntegrationConnection[]>(token, '/api/v1/connections')
}

export async function getConnection(token: string, id: string): Promise<IntegrationConnection> {
  return request<IntegrationConnection>(token, `/api/v1/connections/${id}`)
}

export async function createConnection(
  token: string,
  body: { provider: string; account_ref: string },
): Promise<IntegrationConnection> {
  return request<IntegrationConnection>(token, '/api/v1/connections', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateConnection(
  token: string,
  id: string,
  body: { status?: string; last_synced_at?: string },
): Promise<IntegrationConnection> {
  return request<IntegrationConnection>(token, `/api/v1/connections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteConnection(token: string, id: string): Promise<void> {
  return request<void>(token, `/api/v1/connections/${id}`, { method: 'DELETE' })
}
