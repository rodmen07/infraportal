import { API_BASE_URL, API_TIMEOUT_MS } from '../config'
import type { Task } from '../types'

interface PlanResponse {
  tasks: string[]
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
): Promise<Task> {
  return request<Task>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, difficulty, goal: goal?.trim() || undefined }),
  })
}

export async function updateTask(
  id: number,
  updates: Partial<Pick<Task, 'title' | 'completed' | 'difficulty' | 'goal'>>,
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

export async function planTasksFromGoal(goal: string): Promise<PlanResponse> {
  return request<PlanResponse>('/api/v1/tasks/plan', {
    method: 'POST',
    body: JSON.stringify({ goal }),
  })
}
