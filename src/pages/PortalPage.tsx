import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from './PageLayout'
import { useAuth } from '../features/auth/useAuth'
import { PROJECTS_API_BASE_URL, AUTH_SERVICE_URL } from '../config'
import { OnboardingChecklist } from '../features/onboarding/OnboardingChecklist'
import { SupportRequestPanel } from '../features/support/SupportRequestPanel'
import { ServiceHealthIndicators } from '../features/health/ServiceHealthIndicators'
import type {
  Project,
  Milestone,
  Deliverable,
  Message,
  Collaborator,
  ProgressUpdate,
  ProjectLink,
  ProjectEmail,
} from '../features/portal/types'
import { Spinner, ClientLoginGate, ClientHeader } from '../features/portal/auth'
import {
  ProjectSummaryCard,
  LinksSection,
  EmailsSection,
  MilestoneCard,
  CollaboratorsSection,
  ProgressUpdatesSection,
  MessageThread,
  NoProjectPanel,
} from '../features/portal/projectDetail'
import { ManagedServiceSnapshot, ProjectRepoBuildStatus } from '../features/portal/buildStatus'

// --- API helper ---

async function api<T>(path: string, token: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PROJECTS_API_BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? `${res.status} ${res.statusText}`)
  }
  return res.json()
}

export function PortalPage() {
  const { token, claims, login, logout } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [deliverablesByMilestone, setDeliverablesByMilestone] = useState<Record<string, Deliverable[]>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([])
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [emails, setEmails] = useState<ProjectEmail[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'no_project'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const tryRefresh = useCallback(async (): Promise<string | null> => {
    if (!AUTH_SERVICE_URL) return null
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) { logout(); return null }
      const { access_token } = await res.json() as { access_token: string }
      login(access_token)
      return access_token
    } catch {
      logout()
      return null
    }
  }, [login, logout])

  const load = useCallback(async () => {
    if (!token) return
    setStatus('loading')
    setError(null)

    try {
      const projects = await api<Project[]>('/api/v1/projects', token)
      if (projects.length === 0) {
        setStatus('no_project')
        return
      }

      const p = projects[0]
      setProject(p)

      const [ms, msgs, lnks, emls, collabs, updates] = await Promise.all([
        api<Milestone[]>(`/api/v1/projects/${p.id}/milestones`, token),
        api<Message[]>(`/api/v1/projects/${p.id}/messages`, token),
        api<ProjectLink[]>(`/api/v1/projects/${p.id}/links`, token).catch(() => [] as ProjectLink[]),
        api<ProjectEmail[]>(`/api/v1/projects/${p.id}/emails`, token).catch(() => [] as ProjectEmail[]),
        api<Collaborator[]>(`/api/v1/projects/${p.id}/collaborators`, token).catch(() => [] as Collaborator[]),
        api<ProgressUpdate[]>(`/api/v1/projects/${p.id}/progress-updates`, token).catch(() => [] as ProgressUpdate[]),
      ])

      const sorted = [...ms].sort((a, b) => a.sort_order - b.sort_order)
      setMilestones(sorted)
      setMessages(msgs)
      setLinks(lnks)
      setEmails(emls)
      setCollaborators(collabs)
      setProgressUpdates(updates)

      const deliverables = await Promise.all(
        sorted.map((m) =>
          api<Deliverable[]>(`/api/v1/milestones/${m.id}/deliverables`, token)
            .then((ds) => ({ id: m.id, ds }))
            .catch(() => ({ id: m.id, ds: [] }))
        )
      )

      const byId: Record<string, Deliverable[]> = {}
      deliverables.forEach(({ id, ds }) => { byId[id] = ds })
      setDeliverablesByMilestone(byId)
      setStatus('idle')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to load project data'
      if (errMsg.includes('401')) {
        await tryRefresh() // on success, token state changes → useEffect re-runs load()
        return
      }
      setError(errMsg)
      setStatus('error')
    }
  }, [token, tryRefresh])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  const sendMessage = async (body: string) => {
    if (!token || !project) return
    setSending(true)
    setSendError(null)
    try {
      const msg = await api<Message>(
        `/api/v1/projects/${project.id}/messages`,
        token,
        { method: 'POST', body: JSON.stringify({ body }) }
      )
      setMessages((prev) => [...prev, msg])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : ''
      if (errMsg.includes('401')) {
        const newToken = await tryRefresh()
        if (newToken) {
          try {
            const retryMsg = await api<Message>(
              `/api/v1/projects/${project.id}/messages`,
              newToken,
              { method: 'POST', body: JSON.stringify({ body }) }
            )
            setMessages((prev) => [...prev, retryMsg])
            return
          } catch { /* fall through to set error */ }
        } else {
          return // logout triggered, login gate will appear
        }
      }
      setSendError(errMsg || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  if (!PROJECTS_API_BASE_URL) {
    return (
      <PageLayout title="Client portal">
        <p className="text-sm text-amber-400">VITE_PROJECTS_API_BASE_URL is not configured.</p>
      </PageLayout>
    )
  }

  // Not authenticated — show inline login gate
  if (!token) {
    return (
      <PageLayout title="Client portal">
        <ClientLoginGate />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Client portal">
      <ClientHeader claims={claims!} onLogout={logout} />

      {status === 'loading' && <Spinner />}

      {status === 'error' && (
        <div className="forge-panel surface-card-strong p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button className="btn-neutral btn-sm mt-3" onClick={load}>Retry</button>
        </div>
      )}

      {status === 'no_project' && claims && (
        <NoProjectPanel sub={claims.sub} />
      )}

      {status === 'idle' && project && (
        <div className="space-y-5">
          <ManagedServiceSnapshot project={project} />
          <ServiceHealthIndicators projectId={project.id} />
          <OnboardingChecklist projectId={project.id} />
          <SupportRequestPanel projectId={project.id} />
          <ProjectSummaryCard
            project={project}
            deliverablesByMilestone={deliverablesByMilestone}
          />
          <CollaboratorsSection collaborators={collaborators} />
          <ProgressUpdatesSection updates={progressUpdates} />
          <LinksSection links={links} />

          {milestones.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Timeline</h3>
              {milestones.map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  deliverables={deliverablesByMilestone[m.id] ?? []}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No milestones have been set yet.</p>
          )}

          <EmailsSection emails={emails} />

          <MessageThread
            messages={messages}
            onSend={sendMessage}
            currentUserId={claims?.sub ?? ''}
            sending={sending}
            sendError={sendError}
          />
          <ProjectRepoBuildStatus links={links} />
        </div>
      )}
    </PageLayout>
  )
}
