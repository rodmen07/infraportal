// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Contact {
  id: string; account_id?: string; first_name: string; last_name: string
  email?: string; phone?: string; lifecycle_stage: string
  created_at: string; updated_at: string
}
export interface Account {
  id: string; name: string; domain?: string; status: string
  created_at: string; updated_at: string
}
export interface Opportunity {
  id: string; account_id: string; name: string; stage: string
  amount: number; close_date?: string; created_at: string; updated_at: string
}
export interface Activity {
  id: string; account_id?: string; contact_id?: string
  activity_type: string; subject: string; notes?: string
  due_at?: string; completed: boolean; created_at: string; updated_at: string
}
export interface StreamEvent {
  id: string; source: string; type: string
  payload?: unknown; timestamp: string
}
export interface PagedResponse<T> { data: T[]; total: number; limit: number; offset: number }

export interface Project {
  id: string; account_id: string; client_user_id: string | null
  name: string; description: string | null; status: string
  budget: number | null
  start_date: string | null; target_end_date: string | null
  created_at: string; updated_at: string
}
export interface Milestone {
  id: string; project_id: string; name: string; description: string | null
  due_date: string | null; status: string; sort_order: number
  created_at: string; updated_at: string
}
export interface Deliverable {
  id: string; milestone_id: string; name: string
  description: string | null; status: string
  estimated_hours?: number | null
}
export interface ProjectLink {
  id: string; project_id: string; link_type: string
  label: string; url: string; sort_order: number
}
export interface PMessage {
  id: string; project_id: string; author_id: string
  author_role: string; body: string; created_at: string
}
export interface Collaborator {
  id: string; project_id: string; name: string; role: string
  avatar_url: string | null; created_at: string
}
export interface ProgressUpdate {
  id: string; project_id: string; content: string; created_at: string
}

export interface SpendRecord {
  id: string; platform: string; date: string; amount_usd: number
  granularity: string; service_label?: string; source: string
  notes?: string; created_at: string; updated_at: string
}
export interface SpendSummary {
  total_usd: number
  by_platform: { platform: string; total_usd: number }[]
  by_month: { month: string; total_usd: number }[]
}
export interface SpendListResponse { data: SpendRecord[]; total: number; limit: number; offset: number }
export interface SyncResult { platform: string; records_imported: number; records_skipped: number; errors: string[] }

export type Tab = 'leads' | 'contacts' | 'accounts' | 'opportunities' | 'activities' | 'live-feed' | 'projects' | 'spend' | 'health'
export type ModalMode<T> = null | { mode: 'create' } | { mode: 'edit'; record: T } | { mode: 'delete'; id: string; label: string }
