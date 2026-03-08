import { AUTH_API_BASE_URL, API_TIMEOUT_MS } from '../config'
import type { AuthUserResponse, TokenIssueResponse, TokenVerifyResponse } from '../types'

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

export async function registerUser(username: string, password: string): Promise<AuthUserResponse> {
  return request<AuthUserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<AuthUserResponse> {
  return request<AuthUserResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request<{ message: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await request<{ message: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  })
}

const OAUTH_POPUP_TIMEOUT_MS = 120_000

export function openOAuthPopup(provider: 'github' | 'google'): Promise<AuthUserResponse> {
  return new Promise((resolve, reject) => {
    const authUrl = buildUrl(`/user/oauth/${provider}`)
    const popup = window.open(authUrl, `oauth_${provider}`, 'width=600,height=700')

    if (!popup) {
      reject(new Error('Could not open sign-in popup. Check your browser popup settings.'))
      return
    }

    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('OAuth sign-in timed out. Please try again.'))
    }, OAUTH_POPUP_TIMEOUT_MS)

    function onMessage(event: MessageEvent): void {
      if (event.source !== popup) return

      const data = typeof event.data === 'string' ? event.data : ''

      if (data === 'authorizing:user') {
        popup.postMessage('authorizing:user', event.origin)
        return
      }

      if (data.startsWith('authorization:user:success:')) {
        const json = data.slice('authorization:user:success:'.length)
        try {
          const payload = JSON.parse(json) as AuthUserResponse
          cleanup()
          resolve(payload)
        } catch {
          cleanup()
          reject(new Error('Received malformed OAuth response'))
        }
        return
      }

      if (data.startsWith('authorization:user:error:')) {
        const json = data.slice('authorization:user:error:'.length)
        try {
          const payload = JSON.parse(json) as { message?: string }
          cleanup()
          reject(new Error(payload?.message || 'OAuth sign-in failed'))
        } catch {
          cleanup()
          reject(new Error('OAuth sign-in failed'))
        }
      }
    }

    function cleanup(): void {
      window.clearTimeout(timeoutId)
      window.removeEventListener('message', onMessage)
    }

    window.addEventListener('message', onMessage)
  })
}
