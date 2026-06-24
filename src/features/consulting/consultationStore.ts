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
  const nextRequests = readStoredRequests().map((request) =>
    request.id === id ? { ...request, status } : request,
  )
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
