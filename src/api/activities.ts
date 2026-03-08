const configuredUrl = (import.meta.env.VITE_ACTIVITIES_API_BASE_URL ?? '').trim()
export const ACTIVITIES_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:8083'

export interface Activity {
  id: string
  account_id: string | null
  contact_id: string | null
  activity_type: string
  subject: string
  notes: string | null
  due_at: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ACTIVITIES_BASE_URL}${path}`, {
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

export async function listActivities(token: string): Promise<Activity[]> {
  return request<Activity[]>(token, '/api/v1/activities')
}

export async function getActivity(token: string, id: string): Promise<Activity> {
  return request<Activity>(token, `/api/v1/activities/${id}`)
}

export async function createActivity(
  token: string,
  body: {
    activity_type: string
    subject: string
    notes?: string
    due_at?: string
    account_id?: string
    contact_id?: string
  },
): Promise<Activity> {
  return request<Activity>(token, '/api/v1/activities', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateActivity(
  token: string,
  id: string,
  body: {
    activity_type?: string
    subject?: string
    notes?: string
    due_at?: string
    completed?: boolean
  },
): Promise<Activity> {
  return request<Activity>(token, `/api/v1/activities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteActivity(token: string, id: string): Promise<void> {
  return request<void>(token, `/api/v1/activities/${id}`, { method: 'DELETE' })
}
