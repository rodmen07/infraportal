export type PlannerTone = 'info' | 'success' | 'warning'

export interface SiteContent {
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

export interface Task {
  id: number
  title: string
  completed: boolean
  difficulty: number
  goal: string | null
}

export interface GoalPlan {
  id: number
  goal: string
  tasks: string[]
  createdAt: string
}

export interface AuthSession {
  subject: string
  accessToken: string
  roles: string[]
  expiresAt: number
}

export interface TokenIssueResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface TokenVerifyResponse {
  active: boolean
  subject: string | null
  roles: string[] | null
  exp: number | null
  issuer: string | null
}
