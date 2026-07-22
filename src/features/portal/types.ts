// --- Types ---

export interface Project {
  id: string
  name: string
  description: string | null
  status: string
  budget: number | null
  start_date: string | null
  target_end_date: string | null
}

export interface Milestone {
  id: string
  project_id: string
  name: string
  description: string | null
  due_date: string | null
  status: string
  sort_order: number
}

export interface Deliverable {
  id: string
  milestone_id: string
  name: string
  description: string | null
  status: string
  estimated_hours?: number | null
}

export interface Message {
  id: string
  project_id: string
  author_id: string
  author_role: string
  body: string
  created_at: string
}

export interface Collaborator {
  id: string
  project_id: string
  name: string
  role: string
  avatar_url: string | null
  created_at: string
}

export interface ProgressUpdate {
  id: string
  project_id: string
  content: string
  created_at: string
}

export interface ProjectLink {
  id: string
  link_type: string
  label: string
  url: string
  sort_order: number
}

export interface ProjectEmail {
  id: string
  thread_id: string
  subject: string
  from_email: string
  snippet: string | null
  body_html: string | null
  received_at: string
}
