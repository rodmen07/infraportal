import { useState, useEffect, useCallback } from 'react'
import { TemplateLibrary } from '../../components/TemplateLibrary'
import { ProjectCloneModal } from '../../components/ProjectCloneModal'
import { PROJECTS_STORE_BOUNDARY, projectsStore } from '../../lib/projectsStore.mock'
import {
  DELIVERABLE_STATUSES,
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
  RESET_DELIVERABLE_STATUS,
  RESET_MILESTONE_STATUS,
  statusLabel,
} from '../../lib/projectStatusVocabulary'
import type { Project, Milestone, Deliverable, ProjectLink, PMessage, Collaborator, ProgressUpdate } from './types'
import { api, PROJECTS_URL, PROJECTS_DEMO } from './api'
import {
  Spinner, ErrorBox, CustomEmptyState, ProjectIcon, FlagIcon, UsersIcon,
  DocumentIcon, DemoDataBadge, Modal, FormField, SaveError, INPUT_CLS,
} from './ui'

// ---------------------------------------------------------------------------
// Projects tab. Status vocabularies come from the spec-locked module
// (src/lib/projectStatusVocabulary.ts), so no select here can offer a value
// the projects-service contract would reject.
// ---------------------------------------------------------------------------
const STATUS_PILL: Record<string, string> = {
  // Project statuses
  planning:    'bg-zinc-700/40 text-text-secondary',
  active:      'bg-emerald-500/15 text-success-text',
  on_hold:     'bg-amber-500/15 text-amber-300',
  completed:   'bg-blue-500/15 text-info-text',
  cancelled:   'bg-red-500/15 text-danger-text',
  // Milestone statuses (completed shared above)
  pending:     'bg-zinc-700/40 text-text-muted',
  in_progress: 'bg-amber-500/15 text-amber-300',
  // Deliverable statuses (in_progress shared above)
  not_started: 'bg-zinc-700/40 text-text-muted',
  in_review:   'bg-blue-500/15 text-info-text',
  accepted:    'bg-emerald-500/15 text-success-text',
}

export function ProjectsTab() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [selected, setSelected]   = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [deliverables, setDeliverables] = useState<Record<string, Deliverable[]>>({})
  const [messages, setMessages]   = useState<PMessage[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [reply, setReply]         = useState('')
  const [sending, setSending]     = useState(false)

  // project create form
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', account_id: '', client_user_id: '', status: 'planning', start_date: '', target_end_date: '', description: '', budget: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // milestone create form
  const [showMilestone, setShowMilestone] = useState(false)
  const [msForm, setMsForm] = useState({ name: '', due_date: '', status: RESET_MILESTONE_STATUS as string, sort_order: '0', description: '' })

  // deliverable create form
  const [showDeliverable, setShowDeliverable] = useState<string | null>(null) // milestone id
  const [dlForm, setDlForm] = useState({ name: '', description: '', status: RESET_DELIVERABLE_STATUS as string, estimated_hours: '' })

  // project links
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [linkForm, setLinkForm] = useState({ link_type: 'other', label: '', url: '' })
  const [savingLink, setSavingLink] = useState(false)

  // collaborators
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [collabForm, setCollabForm] = useState({ name: '', role: 'contributor' })
  const [savingCollab, setSavingCollab] = useState(false)

  // progress updates
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([])
  const [updateContent, setUpdateContent] = useState('')
  const [savingUpdate, setSavingUpdate] = useState(false)

  // message send error
  const [sendError, setSendError] = useState<string | null>(null)

  // clone modal (demo mode only)
  const [cloneOpen, setCloneOpen] = useState(false)

  const loadProjects = useCallback(async () => {
    if (PROJECTS_DEMO) {
      setProjects(projectsStore.listProjects())
      setError(null)
      return
    }
    setLoading(true); setError(null)
    try {
      const rows = await api<Project[]>(`${PROJECTS_URL}/api/v1/projects`)
      setProjects(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProject = useCallback(async (p: Project) => {
    setSelected(p); setMilestones([]); setDeliverables({}); setMessages([]); setLinks([])
    setCollaborators([]); setProgressUpdates([])
    if (PROJECTS_DEMO) {
      const ms = projectsStore.listMilestones(p.id)
      setMilestones(ms)
      const dlMap: Record<string, Deliverable[]> = {}
      for (const m of ms) dlMap[m.id] = projectsStore.listDeliverables(m.id)
      setDeliverables(dlMap)
      return
    }
    try {
      const [ms, msgs, lnks, collabs, updates] = await Promise.all([
        api<Milestone[]>(`${PROJECTS_URL}/api/v1/projects/${p.id}/milestones`),
        api<PMessage[]>(`${PROJECTS_URL}/api/v1/projects/${p.id}/messages`),
        api<ProjectLink[]>(`${PROJECTS_URL}/api/v1/projects/${p.id}/links`).catch(() => [] as ProjectLink[]),
        api<Collaborator[]>(`${PROJECTS_URL}/api/v1/projects/${p.id}/collaborators`).catch(() => [] as Collaborator[]),
        api<ProgressUpdate[]>(`${PROJECTS_URL}/api/v1/projects/${p.id}/progress-updates`).catch(() => [] as ProgressUpdate[]),
      ])
      const sorted = [...ms].sort((a, b) => a.sort_order - b.sort_order)
      setMilestones(sorted)
      setMessages(msgs)
      setLinks(lnks)
      setCollaborators(collabs)
      setProgressUpdates(updates)
      const dlMap: Record<string, Deliverable[]> = {}
      await Promise.all(sorted.map(async (m) => {
        const ds = await api<Deliverable[]>(`${PROJECTS_URL}/api/v1/milestones/${m.id}/deliverables`).catch(() => [])
        dlMap[m.id] = ds
      }))
      setDeliverables(dlMap)
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])
  // In demo mode, re-read whenever the shared mock store changes (clone,
  // template create, or a mutation from another component).
  useEffect(() => {
    if (!PROJECTS_DEMO) return
    return projectsStore.subscribe(loadProjects)
  }, [loadProjects])

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      await api(`${PROJECTS_URL}/api/v1/projects`, { method: 'POST', body: JSON.stringify({
        name: form.name, account_id: form.account_id,
        client_user_id: form.client_user_id || null,
        status: form.status,
        budget: form.budget ? parseFloat(form.budget) : null,
        start_date: form.start_date || null,
        target_end_date: form.target_end_date || null,
        description: form.description || null,
      })})
      setShowCreate(false)
      setForm({ name: '', account_id: '', client_user_id: '', status: 'planning', start_date: '', target_end_date: '', description: '', budget: '' })
      loadProjects()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createMilestone = async (e: React.FormEvent) => {
    if (!selected) return
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      await api(`${PROJECTS_URL}/api/v1/projects/${selected.id}/milestones`, { method: 'POST', body: JSON.stringify({
        name: msForm.name, status: msForm.status,
        due_date: msForm.due_date || null,
        sort_order: parseInt(msForm.sort_order) || milestones.length,
        description: msForm.description || null,
      })})
      setShowMilestone(false)
      setMsForm({ name: '', due_date: '', status: RESET_MILESTONE_STATUS, sort_order: '0', description: '' })
      if (selected) loadProject(selected)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createDeliverable = async (e: React.FormEvent) => {
    if (!showDeliverable) return
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      await api(`${PROJECTS_URL}/api/v1/milestones/${showDeliverable}/deliverables`, { method: 'POST', body: JSON.stringify({
        name: dlForm.name, status: dlForm.status,
        description: dlForm.description || null,
        estimated_hours: dlForm.estimated_hours ? parseFloat(dlForm.estimated_hours) : null,
      })})
      setShowDeliverable(null)
      setDlForm({ name: '', description: '', status: RESET_DELIVERABLE_STATUS, estimated_hours: '' })
      if (selected) loadProject(selected)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createLink = async (e: React.FormEvent) => {
    if (!selected) return
    e.preventDefault(); setSavingLink(true)
    try {
      await api(`${PROJECTS_URL}/api/v1/projects/${selected.id}/links`, { method: 'POST', body: JSON.stringify({
        link_type: linkForm.link_type, label: linkForm.label, url: linkForm.url,
      })})
      setLinkForm({ link_type: 'other', label: '', url: '' })
      const lnks = await api<ProjectLink[]>(`${PROJECTS_URL}/api/v1/projects/${selected.id}/links`).catch(() => [] as ProjectLink[])
      setLinks(lnks)
    } catch { /* silent */ } finally {
      setSavingLink(false)
    }
  }

  const deleteLink = async (linkId: string) => {
    if (!selected) return
    try {
      await api(`${PROJECTS_URL}/api/v1/links/${linkId}`, { method: 'DELETE' })
      setLinks(prev => prev.filter(l => l.id !== linkId))
    } catch { /* silent */ }
  }

  const createCollaborator = async (e: React.FormEvent) => {
    if (!selected) return
    e.preventDefault(); setSavingCollab(true)
    try {
      const c = await api<Collaborator>(`${PROJECTS_URL}/api/v1/projects/${selected.id}/collaborators`, {
        method: 'POST', body: JSON.stringify({ name: collabForm.name.trim(), role: collabForm.role }),
      })
      setCollaborators(prev => [...prev, c])
      setCollabForm({ name: '', role: 'contributor' })
    } catch { /* silent */ } finally {
      setSavingCollab(false)
    }
  }

  const createProgressUpdate = async (e: React.FormEvent) => {
    if (!selected || !updateContent.trim()) return
    e.preventDefault(); setSavingUpdate(true)
    try {
      const u = await api<ProgressUpdate>(`${PROJECTS_URL}/api/v1/projects/${selected.id}/progress-updates`, {
        method: 'POST', body: JSON.stringify({ content: updateContent.trim() }),
      })
      setProgressUpdates(prev => [u, ...prev])
      setUpdateContent('')
    } catch { /* silent */ } finally {
      setSavingUpdate(false)
    }
  }

  const sendReply = async (e: React.FormEvent) => {
    if (!selected) return
    e.preventDefault()
    const body = reply.trim()
    if (!body) return
    setSending(true); setSendError(null)
    try {
      const msg = await api<PMessage>(`${PROJECTS_URL}/api/v1/projects/${selected.id}/messages`, {
        method: 'POST', body: JSON.stringify({ body }),
      })
      setMessages(prev => [...prev, msg])
      setReply('')
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Project list */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">Projects</h3>
          {PROJECTS_DEMO && <DemoDataBadge note={PROJECTS_STORE_BOUNDARY} />}
        </div>
        {projects.length > 0 && (
          PROJECTS_DEMO ? (
            <button className="btn-accent btn-sm" onClick={() => setCloneOpen(true)}>Clone project</button>
          ) : (
            <button className="btn-accent btn-sm" onClick={() => setShowCreate(true)}>+ New project</button>
          )
        )}
      </div>

      {loading && <Spinner label="Loading projects…" />}
      {error && <ErrorBox message={error} onRetry={loadProjects} />}

      {!loading && projects.length === 0 && (
        <CustomEmptyState
          icon={<ProjectIcon />}
          title="No projects yet"
          description="Create your first project to organize work."
          ctaText={PROJECTS_DEMO ? undefined : '+ New project'}
          onCtaClick={PROJECTS_DEMO ? undefined : () => setShowCreate(true)}
        />
      )}

      {projects.length > 0 && (
        <div className="space-y-1">
          {projects.map(p => (
            <button key={p.id} type="button" onClick={() => loadProject(p)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                selected?.id === p.id
                  ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                  : 'border-zinc-700/40 bg-zinc-800/30 text-zinc-200 hover:bg-zinc-800/60'
              }`}>
              <span className="font-medium">{p.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_PILL[p.status] ?? 'bg-zinc-700/40 text-text-muted'}`}>
                {statusLabel(p.status)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected project detail */}
      {selected && (
        <div className="space-y-4 border-t border-zinc-700/40 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-text-primary">{selected.name}</h4>
              {selected.client_user_id && (
                <p className="mt-0.5 font-mono text-xs text-text-subtle">client: {selected.client_user_id}</p>
              )}
              {selected.budget != null && (
                <p className="mt-0.5 text-xs text-text-muted">Budget: <span className="text-zinc-200">${selected.budget.toLocaleString()}</span></p>
              )}
            </div>
            {!PROJECTS_DEMO && (
              <button className="btn-neutral btn-sm" onClick={() => setShowMilestone(true)}>+ Milestone</button>
            )}
          </div>

          {/* Milestones */}
          {milestones.length === 0 && (
            <CustomEmptyState
              icon={<FlagIcon />}
              title="No milestones yet"
              description={PROJECTS_DEMO
                ? 'This project was cloned without milestones.'
                : 'Add milestones to track key project phases.'}
              ctaText={PROJECTS_DEMO ? undefined : '+ Milestone'}
              onCtaClick={PROJECTS_DEMO ? undefined : () => setShowMilestone(true)}
            />
          )}
          {milestones.map(m => (
            <div key={m.id} className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-200">{m.name}</span>
                <div className="flex items-center gap-2">
                  {m.due_date && <span className="text-xs text-text-subtle">{m.due_date.slice(0, 10)}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_PILL[m.status] ?? 'bg-zinc-700/40 text-text-muted'}`}>
                    {statusLabel(m.status)}
                  </span>
                  {!PROJECTS_DEMO && (
                    <button className="text-xs text-text-subtle hover:text-text-secondary" onClick={() => { setShowDeliverable(m.id); setDlForm({ name: '', description: '', status: RESET_DELIVERABLE_STATUS, estimated_hours: '' }) }}>
                      + Deliverable
                    </button>
                  )}
                </div>
              </div>
              {(deliverables[m.id] ?? []).map(d => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900/40 px-3 py-1.5 text-xs">
                  <span className="text-text-secondary">{d.name}</span>
                  <div className="flex items-center gap-2">
                    {d.estimated_hours != null && d.estimated_hours > 0 && (
                      <span className="text-text-subtle">{d.estimated_hours}h</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 ${STATUS_PILL[d.status] ?? 'bg-zinc-700/40 text-text-muted'}`}>
                      {statusLabel(d.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Links, collaborators, progress updates, and messages talk to
              live endpoints only; they are hidden in demo mode because they
              are not part of the demo store (v1.16.5 scope). */}
          {!PROJECTS_DEMO && (<>
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Project links</h5>
            {links.length === 0 && <p className="text-xs text-text-subtle">No links yet.</p>}
            {links.map(lnk => (
              <div key={lnk.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900/40 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-text-subtle">{lnk.link_type}</span>
                  <a href={lnk.url} target="_blank" rel="noopener noreferrer" className="truncate text-amber-400 hover:text-amber-300">{lnk.label}</a>
                </div>
                <button type="button" onClick={() => deleteLink(lnk.id)} className="shrink-0 text-zinc-600 hover:text-red-400">✕</button>
              </div>
            ))}
            <form onSubmit={createLink} className="flex flex-wrap gap-2 pt-1">
              <select value={linkForm.link_type} onChange={e => setLinkForm(f => ({ ...f, link_type: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-surface-control px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60">
                {['upwork', 'drive', 'github', 'figma', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Label" value={linkForm.label} onChange={e => setLinkForm(f => ({ ...f, label: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-surface-control px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60 placeholder-zinc-500" />
              <input placeholder="URL" value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
                className="min-w-0 flex-[2] rounded-lg border border-zinc-700 bg-surface-control px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60 placeholder-zinc-500" />
              <button type="submit" disabled={savingLink || !linkForm.label || !linkForm.url} className="btn-accent btn-sm disabled:opacity-50">Add link</button>
            </form>
          </div>

          {/* Collaborators */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Collaborators</h5>
            {collaborators.length === 0 && (
              <CustomEmptyState
                icon={<UsersIcon />}
                title="No collaborators yet"
                description="Add team members to collaborate on this project."
              />
            )}
            {collaborators.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg bg-zinc-900/40 px-3 py-1.5 text-xs">
                <span className="h-5 w-5 shrink-0 rounded-full bg-amber-500/20 text-center text-[10px] leading-5 text-amber-300">
                  {c.name[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="flex-1 text-zinc-200">{c.name}</span>
                <span className="text-text-subtle">{c.role}</span>
              </div>
            ))}
            <form onSubmit={createCollaborator} className="flex gap-2 pt-1">
              <input placeholder="Name" value={collabForm.name} onChange={e => setCollabForm(f => ({ ...f, name: e.target.value }))} required
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-surface-control px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60 placeholder-zinc-500" />
              <select value={collabForm.role} onChange={e => setCollabForm(f => ({ ...f, role: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-surface-control px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60">
                {['contributor', 'designer', 'developer', 'manager', 'reviewer'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="submit" disabled={savingCollab || !collabForm.name.trim()} className="btn-accent btn-sm disabled:opacity-50">Add</button>
            </form>
          </div>

          {/* Progress updates */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Progress updates</h5>
            {progressUpdates.length === 0 && (
              <CustomEmptyState
                icon={<DocumentIcon />}
                title="No updates yet"
                description="Post progress updates to keep everyone informed."
              />
            )}
            {progressUpdates.map(u => (
              <div key={u.id} className="rounded-xl bg-zinc-900/40 px-3 py-2 text-xs">
                <p className="text-zinc-200">{u.content}</p>
                <p className="mt-0.5 text-text-subtle">{u.created_at.slice(0, 16).replace('T', ' ')}</p>
              </div>
            ))}
            <form onSubmit={createProgressUpdate} className="flex gap-2 pt-1">
              <input placeholder="Post an update…" value={updateContent} onChange={e => setUpdateContent(e.target.value)} required
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-surface-control px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/60 placeholder-zinc-500" />
              <button type="submit" disabled={savingUpdate || !updateContent.trim()} className="btn-accent btn-sm disabled:opacity-50">Post</button>
            </form>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Messages</h5>
            {messages.length === 0 && (
              <CustomEmptyState
                icon={<DocumentIcon />}
                title="No messages"
                description="Messages will appear here as client and team communicate."
              />
            )}
            {messages.map(m => (
              <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.author_role === 'admin' ? 'bg-amber-500/10 text-amber-100 ml-6' : 'bg-zinc-800/40 text-zinc-200 mr-6'}`}>
                <p>{m.body}</p>
                <p className="mt-0.5 text-[10px] text-text-subtle">{m.author_role} · {m.created_at.slice(0, 16).replace('T', ' ')}</p>
              </div>
            ))}
            <form onSubmit={sendReply} className="flex flex-col gap-2 pt-1">
              {sendError && <p className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-danger-text">{sendError}</p>}
              <div className="flex gap-2">
                <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to client…"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-600/50 bg-surface-control px-3 py-2 text-sm text-text-primary placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none" />
                <button type="submit" disabled={!reply.trim() || sending} className="btn-accent btn-sm disabled:opacity-50">Send</button>
              </div>
            </form>
          </div>
          </>)}
        </div>
      )}

      {/* Template library (demo mode only) */}
      {PROJECTS_DEMO && <TemplateLibrary projects={projects} />}

      {/* Clone modal (demo mode only) */}
      {PROJECTS_DEMO && cloneOpen && (
        <ProjectCloneModal
          projects={projects}
          initialSourceId={selected?.id}
          onClose={() => setCloneOpen(false)}
        />
      )}

      {/* Create project modal */}
      {showCreate && (
        <Modal title="New project" onClose={() => setShowCreate(false)}>
          <form onSubmit={createProject} className="space-y-3">
            <FormField label="Name"><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Account ID"><input required value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} className={INPUT_CLS} placeholder="UUID from accounts-service" /></FormField>
            <FormField label="Client user ID">
              <input value={form.client_user_id} onChange={e => setForm(f => ({ ...f, client_user_id: e.target.value }))} className={INPUT_CLS} placeholder="Client's account ID from #/portal" />
              <p className="mt-1 text-[10px] text-text-subtle">Ask the client to visit <span className="font-mono text-text-muted">#/portal</span> and copy their Account ID from the &quot;no project&quot; screen.</p>
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={INPUT_CLS}>
                {PROJECT_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </FormField>
            <FormField label="Start date"><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Target end date"><input type="date" value={form.target_end_date} onChange={e => setForm(f => ({ ...f, target_end_date: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Description"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={INPUT_CLS} /></FormField>
            <FormField label="Budget (USD)"><input type="number" min="0" step="0.01" placeholder="e.g. 5000" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className={INPUT_CLS} /></FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-neutral btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent btn-sm disabled:opacity-50">{saving ? 'Saving…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create milestone modal */}
      {showMilestone && (
        <Modal title="New milestone" onClose={() => setShowMilestone(false)}>
          <form onSubmit={createMilestone} className="space-y-3">
            <FormField label="Name"><input required value={msForm.name} onChange={e => setMsForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Status">
              <select value={msForm.status} onChange={e => setMsForm(f => ({ ...f, status: e.target.value }))} className={INPUT_CLS}>
                {MILESTONE_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </FormField>
            <FormField label="Due date"><input type="date" value={msForm.due_date} onChange={e => setMsForm(f => ({ ...f, due_date: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Sort order"><input type="number" value={msForm.sort_order} onChange={e => setMsForm(f => ({ ...f, sort_order: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Description"><textarea value={msForm.description} onChange={e => setMsForm(f => ({ ...f, description: e.target.value }))} rows={2} className={INPUT_CLS} /></FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-neutral btn-sm" onClick={() => setShowMilestone(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent btn-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create deliverable modal */}
      {showDeliverable && (
        <Modal title="New deliverable" onClose={() => setShowDeliverable(null)}>
          <form onSubmit={createDeliverable} className="space-y-3">
            <FormField label="Name"><input required value={dlForm.name} onChange={e => setDlForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} /></FormField>
            <FormField label="Status">
              <select value={dlForm.status} onChange={e => setDlForm(f => ({ ...f, status: e.target.value }))} className={INPUT_CLS}>
                {DELIVERABLE_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </FormField>
            <FormField label="Estimated hours">
              <input type="number" min="0" step="0.5" placeholder="e.g. 4.5" value={dlForm.estimated_hours} onChange={e => setDlForm(f => ({ ...f, estimated_hours: e.target.value }))} className={INPUT_CLS} />
            </FormField>
            <FormField label="Description"><textarea value={dlForm.description} onChange={e => setDlForm(f => ({ ...f, description: e.target.value }))} rows={2} className={INPUT_CLS} /></FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-neutral btn-sm" onClick={() => setShowDeliverable(null)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent btn-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
