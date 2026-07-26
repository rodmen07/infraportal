// Two exports were deleted here in v1.21.1 (2026-07-26): the monitoring URL and
// AI_ORCHESTRATOR_URL. Both read repo variables that have never been set
// (`actions/variables` returns total_count: 0) and both pointed at the
// Fly-hosted observaboard destroyed in the 2026-06-04 teardown, which now
// answers 404. The first had three consumers that rendered null rather than
// saying so; the second had zero consumers at all. See ROADMAP.md, v1.21.1.
// envContract.test.ts now fails on either shape returning.

export const EVENT_STREAM_URL: string =
  (import.meta.env.VITE_EVENT_STREAM_URL as string | undefined) ?? ''

export const AUTH_SERVICE_URL: string =
  (import.meta.env.VITE_AUTH_SERVICE_URL as string | undefined) ?? ''

// Same empty-means-unset handling as LEAD_INTAKE_URL: CI exports unset repo
// variables as empty strings, so || (not ??) is required for the fallback.
export const SCHEDULING_URL: string =
  (((import.meta.env.VITE_SCHEDULING_URL as string | undefined) ?? '').trim() ||
    'https://cal.com/roderick-mendoza-nr7vdc/30min').replace(/\/$/, '')

export const PROJECTS_API_BASE_URL: string =
  ((import.meta.env.VITE_PROJECTS_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '')

export const CONTACTS_API_BASE_URL: string =
  ((import.meta.env.VITE_CONTACTS_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '')

// Fallback relays form submissions to the owner's inbox via FormSubmit so leads
// are never stranded in the visitor's localStorage when no backend is deployed.
// CI exports unset repo variables as empty strings, so empty must count as
// unset here (|| rather than ??).
export const LEAD_INTAKE_URL: string =
  (((import.meta.env.VITE_LEAD_INTAKE_URL as string | undefined) ?? '').trim() ||
    'https://formsubmit.co/ajax/rodmendoza07@gmail.com').replace(/\/$/, '')

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
