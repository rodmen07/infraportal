export const MONITORING_URL: string =
  (import.meta.env.VITE_MONITORING_URL as string | undefined) ?? ''

export const AI_ORCHESTRATOR_URL: string =
  (import.meta.env.VITE_AI_ORCHESTRATOR_URL as string | undefined) ?? ''

export const EVENT_STREAM_URL: string =
  (import.meta.env.VITE_EVENT_STREAM_URL as string | undefined) ?? ''

export const AUTH_SERVICE_URL: string =
  (import.meta.env.VITE_AUTH_SERVICE_URL as string | undefined) ?? ''

export const PROJECTS_API_BASE_URL: string =
  ((import.meta.env.VITE_PROJECTS_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '')

const _ADMIN_JWT_ENV = (import.meta.env.VITE_ADMIN_JWT as string | undefined) ?? ''

function _jwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp
  } catch {
    return true
  }
}

/**
 * Resolves the admin bearer token.
 * Prefers VITE_ADMIN_JWT (build-time env var); falls back to the OAuth
 * portal_token stored in localStorage by AuthContext after a successful login.
 * Returns '' if the only available token is expired.
 */
export function resolveAdminToken(): string {
  if (_ADMIN_JWT_ENV) return _ADMIN_JWT_ENV
  try {
    const stored = localStorage.getItem('portal_token') ?? ''
    if (!stored || _jwtExpired(stored)) return ''
    return stored
  } catch { return '' }
}
