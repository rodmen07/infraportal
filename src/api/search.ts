const configuredUrl = (import.meta.env.VITE_SEARCH_API_BASE_URL ?? '').trim()
export const SEARCH_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:3016'

export interface SearchResult {
  id: string
  entity_type: string
  entity_id: string
  title: string
  snippet: string
}

export interface SearchDocument {
  id: string
  entity_type: string
  entity_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SEARCH_BASE_URL}${path}`, {
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

export async function searchDocuments(token: string, q: string): Promise<SearchResult[]> {
  const qs = new URLSearchParams({ q })
  return request<SearchResult[]>(token, `/api/v1/search?${qs}`)
}

export async function listDocuments(token: string): Promise<SearchDocument[]> {
  return request<SearchDocument[]>(token, '/api/v1/documents')
}

export async function indexDocument(
  token: string,
  body: { entity_type: string; entity_id: string; title: string; body: string },
): Promise<SearchDocument> {
  return request<SearchDocument>(token, '/api/v1/documents', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
