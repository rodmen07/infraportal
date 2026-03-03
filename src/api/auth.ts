import { AUTH_API_BASE_URL, API_TIMEOUT_MS } from '../config'
import type { TokenIssueResponse, TokenVerifyResponse } from '../types'

function buildUrl(path: string): string {
  const normalizedBase = AUTH_API_BASE_URL.endsWith('/')
    ? AUTH_API_BASE_URL.slice(0, -1)
    : AUTH_API_BASE_URL
  return `${normalizedBase}${path}`
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string; message?: string }
    return payload?.detail || payload?.message || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeoutController = new AbortController()
  const timeoutId = window.setTimeout(() => timeoutController.abort(), API_TIMEOUT_MS)

  let response: Response

  try {
    response = await fetch(buildUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: timeoutController.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Auth request timed out after ${API_TIMEOUT_MS}ms`)
    }

    if (error instanceof TypeError) {
      throw new Error(
        'Unable to reach auth service. Check VITE_AUTH_API_BASE_URL and auth-service CORS settings.',
      )
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as T
}

export async function issueToken(subject: string, roles: string[]): Promise<TokenIssueResponse> {
  return request<TokenIssueResponse>('/auth/token', {
    method: 'POST',
    body: JSON.stringify({ subject, roles }),
  })
}

export async function verifyToken(token: string): Promise<TokenVerifyResponse> {
  return request<TokenVerifyResponse>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}
