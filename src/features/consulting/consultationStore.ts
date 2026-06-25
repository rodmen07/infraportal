import { calculateLeadScore, extractLegacyBudgetFromMessage, getLeadPriority, type LeadPriority } from './leadScoring'

export type ConsultationStatus = 'new' | 'reviewed' | 'accepted'

export interface ConsultationRequest {
  id: string
  name: string
  email: string
  projectType: string
  budget?: string
  timeline: string
  message: string
  createdAt: string
  status: ConsultationStatus
  crmContactId?: string
  leadScore?: number
  leadPriority?: LeadPriority
  firstResponseAt?: string
  firstResponseMinutes?: number
}

const STORAGE_KEY = 'managed-hosting-consultations'

function readStoredRequests(): ConsultationRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.map((request) => {
      const base = request as ConsultationRequest
      const budget = (base.budget && base.budget.trim()) || extractLegacyBudgetFromMessage(base.message)
      const leadScore =
        typeof base.leadScore === 'number'
          ? Math.max(0, Math.min(100, base.leadScore))
          : calculateLeadScore({
              engagement: base.projectType,
              timeline: base.timeline,
              budget,
              message: base.message,
            })

      return {
        ...base,
        budget,
        leadScore,
        leadPriority: base.leadPriority ?? getLeadPriority(leadScore),
        firstResponseAt:
          typeof base.firstResponseAt === 'string' && base.firstResponseAt.trim() ? base.firstResponseAt : undefined,
        firstResponseMinutes:
          typeof base.firstResponseMinutes === 'number' && Number.isFinite(base.firstResponseMinutes)
            ? Math.max(0, Math.round(base.firstResponseMinutes))
            : undefined,
      }
    })
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
  const nowIso = new Date().toISOString()
  const nextRequests = readStoredRequests().map((request) => {
    if (request.id !== id) return request

    const shouldCaptureFirstResponse =
      request.status === 'new' &&
      status === 'reviewed' &&
      typeof request.firstResponseAt !== 'string'

    if (!shouldCaptureFirstResponse) {
      return { ...request, status }
    }

    const createdAtMs = Date.parse(request.createdAt)
    const nowMs = Date.parse(nowIso)
    const firstResponseMinutes =
      Number.isFinite(createdAtMs) && Number.isFinite(nowMs) && nowMs >= createdAtMs
        ? Math.round((nowMs - createdAtMs) / 60000)
        : undefined

    return {
      ...request,
      status,
      firstResponseAt: nowIso,
      firstResponseMinutes,
    }
  })
  writeStoredRequests(nextRequests)
  return nextRequests
}

export function attachCrmContact(id: string, crmContactId: string): ConsultationRequest[] {
  const nextRequests = readStoredRequests().map((request) =>
    request.id === id ? { ...request, crmContactId } : request,
  )
  writeStoredRequests(nextRequests)
  return nextRequests
}

export function clearConsultationRequests(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}
