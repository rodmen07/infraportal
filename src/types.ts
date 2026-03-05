export type PlannerTone = 'info' | 'success' | 'warning'

export interface SiteContent {
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

export interface HomeSectionCard {
  heading: string
  body: string
  image?: string
  link?: string
}

export interface HomeSectionsContent {
  title: string
  cards: HomeSectionCard[]
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqContent {
  title: string
  items: FaqItem[]
}

export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Task {
  id: number
  title: string
  completed: boolean
  difficulty: number
  goal: string | null
  status: TaskStatus
  source: string
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

export interface AdminMetrics {
  total_tasks: number
  completed_tasks: number
  pending_tasks: number
  total_requests: number
  unique_subjects: number
}

export interface AdminRequestLog {
  id: number
  occurred_at: string
  subject: string | null
  method: string
  path: string
  status_code: number
  duration_ms: number
  user_agent: string | null
}

export interface AdminUserActivity {
  subject: string
  request_count: number
  first_seen_at: string
  last_seen_at: string
}
