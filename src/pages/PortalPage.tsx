import { useState, useCallback } from 'react'
import { PageLayout } from './PageLayout'
import { useAuth } from '../features/auth/useAuth'
import { PROJECTS_API_BASE_URL, AUTH_SERVICE_URL } from '../config'
import { useResource } from '../features/crm/useResource'
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

/** Everything one load of the portal produces, settled together or not at all. */
type PortalSnapshot =
  | { kind: 'no_project' }
  | {
      kind: 'project'
      project: Project
      milestones: Milestone[]
      deliverablesByMilestone: Record<string, Deliverable[]>
      messages: Message[]
      collaborators: Collaborator[]
      progressUpdates: ProgressUpdate[]
      links: ProjectLink[]
      emails: ProjectEmail[]
    }

/**
 * The loaded thread plus anything sent into it since it was loaded. A later
 * reload that already includes a sent message wins by id, so nothing
 * duplicates; scoping to the loaded project's id keeps a message sent under a
 * previous login out of another client's thread.
 */
function mergeMessages(projectId: string, loaded: Message[], sent: Message[]): Message[] {
  const seen = new Set(loaded.map((m) => m.id))
  return [...loaded, ...sent.filter((m) => m.project_id === projectId && !seen.has(m.id))]
}

export function PortalPage() {
  const { token, claims, login, logout } = useAuth()

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sentMessages, setSentMessages] = useState<Message[]>([])

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

  const fetchPortal = useCallback(async (): Promise<PortalSnapshot | null> => {
    if (!token) return null // unreachable: the resource is blocked without a token

    try {
      const projects = await api<Project[]>('/api/v1/projects', token)
      if (projects.length === 0) return { kind: 'no_project' }

      const p = projects[0]

      const [ms, msgs, lnks, emls, collabs, updates] = await Promise.all([
        api<Milestone[]>(`/api/v1/projects/${p.id}/milestones`, token),
        api<Message[]>(`/api/v1/projects/${p.id}/messages`, token),
        api<ProjectLink[]>(`/api/v1/projects/${p.id}/links`, token).catch(() => [] as ProjectLink[]),
        api<ProjectEmail[]>(`/api/v1/projects/${p.id}/emails`, token).catch(() => [] as ProjectEmail[]),
        api<Collaborator[]>(`/api/v1/projects/${p.id}/collaborators`, token).catch(() => [] as Collaborator[]),
        api<ProgressUpdate[]>(`/api/v1/projects/${p.id}/progress-updates`, token).catch(() => [] as ProgressUpdate[]),
      ])

      const sorted = [...ms].sort((a, b) => a.sort_order - b.sort_order)

      const deliverables = await Promise.all(
        sorted.map((m) =>
          api<Deliverable[]>(`/api/v1/milestones/${m.id}/deliverables`, token)
            .then((ds) => ({ id: m.id, ds }))
            .catch(() => ({ id: m.id, ds: [] }))
        )
      )

      const byId: Record<string, Deliverable[]> = {}
      deliverables.forEach(({ id, ds }) => { byId[id] = ds })

      return {
        kind: 'project',
        project: p,
        milestones: sorted,
        deliverablesByMilestone: byId,
        messages: msgs,
        collaborators: collabs,
        progressUpdates: updates,
        links: lnks,
        emails: emls,
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to load project data'
      if (errMsg.includes('401')) {
        // On success, login() swaps the token, which re-keys the resource and
        // marks this attempt stale (its rejection never paints); on failure,
        // logout() clears the token and the login gate renders instead.
        await tryRefresh()
      }
      throw e instanceof Error ? e : new Error(errMsg)
    }
  }, [token, tryRefresh])

  const { data: snapshot, loading, error, reload } = useResource<PortalSnapshot | null>(
    null,
    fetchPortal,
    token ? null : 'Not signed in.',
  )

  const project = snapshot?.kind === 'project' ? snapshot.project : null

  // v1.25.2 (D-19, PORTAL-DRAFT-LOSS-1): answers whether the message actually
  // landed. Every early return below is a NOT-SENT, and the declared
  // `Promise<boolean>` is what makes tsc say so — a bare `return` here is a
  // type error, so a future failure path cannot silently read as success.
  const sendMessage = async (body: string): Promise<boolean> => {
    if (!token || !project) return false
    setSending(true)
    setSendError(null)
    try {
      const msg = await api<Message>(
        `/api/v1/projects/${project.id}/messages`,
        token,
        { method: 'POST', body: JSON.stringify({ body }) }
      )
      setSentMessages((prev) => [...prev, msg])
      return true
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
            setSentMessages((prev) => [...prev, retryMsg])
            return true
          } catch { /* fall through to set error */ }
        } else {
          // Logout triggered, login gate will appear. The draft survives with
          // the rest of the page state, so it is still there after signing in.
          return false
        }
      }
      setSendError(errMsg || 'Failed to send message.')
      return false
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

      {/* Exactly one branch renders, mirroring the old status machine: a
          reload keeps the previous snapshot in `data`, so the settled branches
          must yield to the spinner and the error panel rather than coexist. */}
      {loading && <Spinner />}

      {!loading && error && (
        <div className="forge-panel surface-card-strong p-4">
          <p className="text-sm text-danger-text">{error}</p>
          <button className="btn-neutral btn-sm mt-3" onClick={reload}>Retry</button>
        </div>
      )}

      {!loading && !error && snapshot?.kind === 'no_project' && claims && (
        <NoProjectPanel sub={claims.sub} />
      )}

      {!loading && !error && snapshot?.kind === 'project' && (
        <div className="space-y-5">
          <ManagedServiceSnapshot project={snapshot.project} />
          <ServiceHealthIndicators projectId={snapshot.project.id} />
          <OnboardingChecklist projectId={snapshot.project.id} />
          <SupportRequestPanel projectId={snapshot.project.id} />
          <ProjectSummaryCard
            project={snapshot.project}
            deliverablesByMilestone={snapshot.deliverablesByMilestone}
          />
          <CollaboratorsSection collaborators={snapshot.collaborators} />
          <ProgressUpdatesSection updates={snapshot.progressUpdates} />
          <LinksSection links={snapshot.links} />

          {snapshot.milestones.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Timeline</h3>
              {snapshot.milestones.map((m) => (
                <MilestoneCard
                  key={m.id}
                  milestone={m}
                  deliverables={snapshot.deliverablesByMilestone[m.id] ?? []}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-subtle">No milestones have been set yet.</p>
          )}

          <EmailsSection emails={snapshot.emails} />

          <MessageThread
            messages={mergeMessages(snapshot.project.id, snapshot.messages, sentMessages)}
            onSend={sendMessage}
            currentUserId={claims?.sub ?? ''}
            sending={sending}
            sendError={sendError}
          />
          <ProjectRepoBuildStatus links={snapshot.links} />
        </div>
      )}
    </PageLayout>
  )
}
