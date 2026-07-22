import { resolveAdminToken } from '../../config'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const CONTACTS_URL   = (import.meta.env.VITE_CONTACTS_API_BASE_URL      ?? '').replace(/\/$/, '')
export const ACCOUNTS_URL   = (import.meta.env.VITE_ACCOUNTS_API_BASE_URL      ?? '').replace(/\/$/, '')
export const OPPS_URL       = (import.meta.env.VITE_OPPORTUNITIES_API_BASE_URL  ?? '').replace(/\/$/, '')
export const ACTIVITIES_URL = (import.meta.env.VITE_ACTIVITIES_API_BASE_URL     ?? '').replace(/\/$/, '')
export const STREAM_URL     = (import.meta.env.VITE_EVENT_STREAM_URL            ?? '').replace(/\/$/, '')
export const PROJECTS_URL   = (import.meta.env.VITE_PROJECTS_API_BASE_URL       ?? '').replace(/\/$/, '')
export const SPEND_URL      = (import.meta.env.VITE_SPEND_API_BASE_URL          ?? '').replace(/\/$/, '')

// When a CRM service URL is unset (the backend was decommissioned on
// 2026-06-04), the tab falls back to the in-memory demo dataset behind the
// clearly marked mock boundary in `src/lib/crmStore.mock.ts`. Bulk selection
// and bulk edit are only offered in this demo mode, so no call site pretends
// the backend is live.
export const CONTACTS_DEMO = !CONTACTS_URL
export const ACCOUNTS_DEMO = !ACCOUNTS_URL
export const OPPS_DEMO     = !OPPS_URL
// Same discipline for the Projects tab (v1.16.5): with no projects-service
// URL it renders the demo dataset in `src/lib/projectsStore.mock.ts`, and
// cloning plus the template library are only offered in this demo mode.
export const PROJECTS_DEMO = !PROJECTS_URL

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
export async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolveAdminToken()}`, ...opts.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}
