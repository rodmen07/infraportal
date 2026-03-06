import { API_BASE_URL, API_TIMEOUT_MS } from '../config'
import type { AdminMetrics, AdminRequestLog, AdminUserActivity, Task, TaskStatus } from '../types'

interface PlanResponse {
  goal: string
  tasks: string[]
}

interface ClearPlanResponse {
  deleted: number
  goal: string
}

let currentAccessToken = ''

export function setApiAccessToken(token: string): void {
  currentAccessToken = token.trim()
}

function buildUrl(path: string): string {
  const normalizedBase = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL
  return `${normalizedBase}${path}`
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; code?: string }
    return payload?.message || payload?.code || `Request failed (${response.status})`
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
        ...(currentAccessToken ? { Authorization: `Bearer ${currentAccessToken}` } : {}),
        ...(options.headers || {}),
      },
      signal: timeoutController.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${API_TIMEOUT_MS}ms`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

export async function listTasks(): Promise<Task[]> {
  return request<Task[]>('/api/v1/tasks?limit=100&offset=0')
}

export async function createTask(title: string): Promise<Task> {
  return request<Task>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, difficulty: 1 }),
  })
}

export async function createTaskWithDifficulty(
  title: string,
  difficulty: number,
  goal?: string,
  source?: string,
): Promise<Task> {
  return request<Task>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, difficulty, goal: goal?.trim() || undefined, source }),
  })
}

export async function updateTask(
  id: number,
  updates: Partial<Pick<Task, 'title' | 'completed' | 'difficulty' | 'goal' | 'status' | 'due_date'>>,
): Promise<Task> {
  return request<Task>(`/api/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteTask(id: number): Promise<void> {
  await request<void>(`/api/v1/tasks/${id}`, {
    method: 'DELETE',
  })
}

export async function updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
  return request<Task>(`/api/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, completed: status === 'done' }),
  })
}

export async function planTasksFromGoal(
  goal: string,
  feedback?: string,
  targetCount?: number,
): Promise<PlanResponse> {
  return request<PlanResponse>('/api/v1/tasks/plan', {
    method: 'POST',
    body: JSON.stringify({
      goal,
      ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
      ...(targetCount !== undefined ? { target_count: targetCount } : {}),
    }),
  })
}

export async function clearPlanTasks(goal: string): Promise<ClearPlanResponse> {
  return request<ClearPlanResponse>(`/api/v1/tasks/plan?goal=${encodeURIComponent(goal)}`, {
    method: 'DELETE',
  })
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  return request<AdminMetrics>('/api/v1/admin/metrics')
}

export async function getAdminRequestLogs(limit = 10): Promise<AdminRequestLog[]> {
  return request<AdminRequestLog[]>(`/api/v1/admin/requests?limit=${limit}&offset=0`)
}

export async function getAdminUserActivity(limit = 10): Promise<AdminUserActivity[]> {
  return request<AdminUserActivity[]>(`/api/v1/admin/users?limit=${limit}&offset=0`)
}

export async function listComments(taskId: number): Promise<import('../types').TaskComment[]> {
  return request<import('../types').TaskComment[]>(`/api/v1/tasks/${taskId}/comments`)
}

export async function createComment(taskId: number, body: string): Promise<import('../types').TaskComment> {
  return request<import('../types').TaskComment>(`/api/v1/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export async function updateComment(commentId: number, body: string): Promise<import('../types').TaskComment> {
  return request<import('../types').TaskComment>(`/api/v1/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  })
}

export async function deleteComment(commentId: number): Promise<void> {
  await request<void>(`/api/v1/comments/${commentId}`, {
    method: 'DELETE',
  })
}
