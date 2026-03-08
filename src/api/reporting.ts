const configuredUrl = (import.meta.env.VITE_REPORTING_API_BASE_URL ?? '').trim()
export const REPORTING_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:3017'

export interface SavedReport {
  id: string
  name: string
  description: string | null
  metric: string
  dimension: string | null
  created_at: string
  updated_at: string
}

export interface DashboardSummary {
  active_reports: number
  core_metrics: string[]
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${REPORTING_BASE_URL}${path}`, {
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

export async function getDashboardSummary(token: string): Promise<DashboardSummary> {
  return request<DashboardSummary>(token, '/api/v1/dashboard')
}

export async function listReports(token: string): Promise<SavedReport[]> {
  return request<SavedReport[]>(token, '/api/v1/reports')
}

export async function getReport(token: string, id: string): Promise<SavedReport> {
  return request<SavedReport>(token, `/api/v1/reports/${id}`)
}

export async function createReport(
  token: string,
  body: { name: string; metric: string; description?: string; dimension?: string },
): Promise<SavedReport> {
  return request<SavedReport>(token, '/api/v1/reports', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateReport(
  token: string,
  id: string,
  body: { name?: string; metric?: string; description?: string; dimension?: string },
): Promise<SavedReport> {
  return request<SavedReport>(token, `/api/v1/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteReport(token: string, id: string): Promise<void> {
  return request<void>(token, `/api/v1/reports/${id}`, { method: 'DELETE' })
}
