export type LeadPriority = 'hot' | 'warm' | 'nurture'

const ENGAGEMENT_WEIGHTS: Record<string, number> = {
  'monthly retainer': 34,
  'launch sprint': 24,
  'security review': 18,
  'discovery audit': 10,
}

const BUDGET_WEIGHTS: Record<string, number> = {
  '$15k+': 34,
  '$5k-$15k': 20,
  'Under $5k': 8,
  'Need guidance': 12,
}

const TIMELINE_WEIGHTS: Record<string, number> = {
  'Within 2 weeks': 24,
  'Next month': 14,
  'Planning stage': 6,
}

function normalizeBudget(budget?: string): string | undefined {
  if (!budget) return undefined
  const trimmed = budget.trim()
  if (!trimmed) return undefined
  if (trimmed === '$5k–$15k') return '$5k-$15k'
  return trimmed
}

export interface LeadScoreInput {
  engagement: string
  timeline: string
  budget?: string
  message?: string
}

export function calculateLeadScore(input: LeadScoreInput): number {
  const engagement = input.engagement.trim().toLowerCase()
  const budget = normalizeBudget(input.budget)
  const timeline = input.timeline.trim()
  const messageLength = (input.message ?? '').trim().length

  const engagementScore = ENGAGEMENT_WEIGHTS[engagement] ?? 10
  const budgetScore = budget ? (BUDGET_WEIGHTS[budget] ?? 10) : 10
  const timelineScore = TIMELINE_WEIGHTS[timeline] ?? 8
  const detailScore = Math.min(8, Math.floor(messageLength / 40))

  return Math.max(0, Math.min(100, engagementScore + budgetScore + timelineScore + detailScore))
}

export function getLeadPriority(score: number): LeadPriority {
  if (score >= 70) return 'hot'
  if (score >= 45) return 'warm'
  return 'nurture'
}

export function extractLegacyBudgetFromMessage(message: string): string | undefined {
  const trimmed = message.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('Under $5k budget.')) return 'Under $5k'
  if (trimmed.startsWith('$5k–$15k budget.') || trimmed.startsWith('$5k-$15k budget.')) return '$5k-$15k'
  if (trimmed.startsWith('$15k+ budget.')) return '$15k+'
  if (trimmed.startsWith('Need guidance budget.')) return 'Need guidance'
  return undefined
}
