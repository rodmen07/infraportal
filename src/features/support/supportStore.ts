export type SupportStatus = 'open' | 'in_progress' | 'resolved'

export const SUPPORT_CATEGORIES = ['Maintenance', 'Bug', 'Question', 'Change request'] as const
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]

export interface SupportRequest {
  id: string
  projectId: string
  category: SupportCategory
  subject: string
  message: string
  status: SupportStatus
  createdAt: string
}

export interface SupportRequestInput {
  projectId: string
  category: SupportCategory
  subject: string
  message: string
}

const STORAGE_PREFIX = 'managed-hosting-support:'

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`
}

function readRequests(projectId: string): SupportRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SupportRequest[]) : []
  } catch {
    return []
  }
}

function writeRequests(projectId: string, requests: SupportRequest[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(requests))
}

export function getSupportRequests(projectId: string): SupportRequest[] {
  return readRequests(projectId)
}

/**
 * Aggregates support requests across every project, for the admin queue.
 * Scans localStorage keys with the support prefix so the team can triage all
 * incoming requests in one place.
 */
export function getAllSupportRequests(): SupportRequest[] {
  if (typeof window === 'undefined') return []
  const all: SupportRequest[] = []
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue
    const projectId = key.slice(STORAGE_PREFIX.length)
    all.push(...readRequests(projectId))
  }
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createSupportRequest(input: SupportRequestInput): SupportRequest {
  const request: SupportRequest = {
    id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    category: input.category,
    subject: input.subject.trim(),
    message: input.message.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  writeRequests(input.projectId, [request, ...readRequests(input.projectId)])
  return request
}

export function updateSupportStatus(projectId: string, id: string, status: SupportStatus): SupportRequest[] {
  const next = readRequests(projectId).map((request) =>
    request.id === id ? { ...request, status } : request,
  )
  writeRequests(projectId, next)
  return next
}

export function removeSupportRequest(projectId: string, id: string): SupportRequest[] {
  const next = readRequests(projectId).filter((request) => request.id !== id)
  writeRequests(projectId, next)
  return next
}

export function clearSupportRequests(projectId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(storageKey(projectId))
}
