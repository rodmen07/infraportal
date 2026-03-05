const configuredUrl = (import.meta.env.VITE_ACCOUNTS_API_BASE_URL ?? '').trim()
export const ACCOUNTS_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:3010'

export interface Account {
  id: string
  name: string
  domain: string | null
  status: 'active' | 'inactive' | 'churned'
  created_at: string
  updated_at: string
}

export interface ListAccountsResponse {
  data: Account[]
  total: number
  limit: number
  offset: number
}

export interface ListAccountsParams {
  limit?: number
  offset?: number
  status?: string
  q?: string
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ACCOUNTS_BASE_URL}${path}`, {
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

export async function listAccounts(
  token: string,
  params: ListAccountsParams = {},
): Promise<ListAccountsResponse> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  if (params.status) qs.set('status', params.status)
  if (params.q) qs.set('q', params.q)
  const query = qs.toString()
  return request<ListAccountsResponse>(token, `/api/v1/accounts${query ? `?${query}` : ''}`)
}

export async function createAccount(
  token: string,
  body: { name: string; domain?: string; status?: string },
): Promise<Account> {
  return request<Account>(token, '/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAccount(
  token: string,
  id: string,
  body: { name?: string; domain?: string; status?: string },
): Promise<Account> {
  return request<Account>(token, `/api/v1/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteAccount(token: string, id: string): Promise<void> {
  return request<void>(token, `/api/v1/accounts/${id}`, { method: 'DELETE' })
}
