import { API_BASE_URL } from '../config'

function buildUrl(path) {
  const normalizedBase = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL
  return `${normalizedBase}${path}`
}

async function parseError(response) {
  try {
    const payload = await response.json()
    return payload?.message || payload?.code || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function listTasks() {
  return request('/api/v1/tasks?limit=100&offset=0')
}

export async function createTask(title) {
  return request('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function updateTask(id, updates) {
  return request(`/api/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteTask(id) {
  return request(`/api/v1/tasks/${id}`, {
    method: 'DELETE',
  })
}
