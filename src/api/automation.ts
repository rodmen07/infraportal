const configuredUrl = (import.meta.env.VITE_AUTOMATION_API_BASE_URL ?? '').trim()
export const AUTOMATION_BASE_URL =
  configuredUrl.length > 0 ? configuredUrl : 'http://localhost:3014'

export interface Workflow {
  id: string
  name: string
  trigger_event: string
  action_type: string
  enabled: boolean
  created_at: string
  updated_at: string
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AUTOMATION_BASE_URL}${path}`, {
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

export async function listWorkflows(token: string): Promise<Workflow[]> {
  return request<Workflow[]>(token, '/api/v1/workflows')
}

export async function getWorkflow(token: string, id: string): Promise<Workflow> {
  return request<Workflow>(token, `/api/v1/workflows/${id}`)
}

export async function createWorkflow(
  token: string,
  body: {
    name: string
    trigger_event: string
    action_type: string
  },
): Promise<Workflow> {
  return request<Workflow>(token, '/api/v1/workflows', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateWorkflow(
  token: string,
  id: string,
  body: {
    name?: string
    trigger_event?: string
    action_type?: string
    enabled?: boolean
  },
): Promise<Workflow> {
  return request<Workflow>(token, `/api/v1/workflows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteWorkflow(token: string, id: string): Promise<void> {
  return request<void>(token, `/api/v1/workflows/${id}`, { method: 'DELETE' })
}
