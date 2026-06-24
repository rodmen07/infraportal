export type ConsultationStatus = 'new' | 'reviewed' | 'accepted'

export interface ConsultationRequest {
  id: string
  name: string
  email: string
  projectType: string
  timeline: string
  message: string
  createdAt: string
  status: ConsultationStatus
}

const STORAGE_KEY = 'managed-hosting-consultations'

function readStoredRequests(): ConsultationRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ConsultationRequest[]
  } catch {
    return []
  }
}

function writeStoredRequests(requests: ConsultationRequest[]): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  }
}

export function getConsultationRequests(): ConsultationRequest[] {
  return readStoredRequests()
}

export function saveConsultationRequest(request: ConsultationRequest): ConsultationRequest {
  const requests = readStoredRequests()
  writeStoredRequests([request, ...requests])
  return request
}

export function updateConsultationStatus(id: string, status: ConsultationStatus): ConsultationRequest[] {
  const nextRequests = readStoredRequests().map((request) =>
    request.id === id ? { ...request, status } : request,
  )
  writeStoredRequests(nextRequests)
  return nextRequests
}

export function clearConsultationRequests(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}
