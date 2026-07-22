import { useState, useEffect, useCallback } from 'react'
import { resolveAdminToken } from '../../config'
import type { Activity, ModalMode } from './types'
import { api, ACTIVITIES_URL } from './api'
import {
  Spinner, ErrorBox, CustomEmptyState, DocumentIcon, Badge, ACTIVITY_COLOR,
  ActionButtons, Modal, FormField, INPUT_CLS, SaveError, DeleteModal, NO_TOKEN_MSG,
} from './ui'

// ---------------------------------------------------------------------------
// ActivitiesTab
// ---------------------------------------------------------------------------
export function ActivitiesTab() {
  const [rows, setRows]       = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [modal, setModal]     = useState<ModalMode<Activity>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [form, setForm]       = useState({ activity_type: 'email', subject: '', account_id: '', contact_id: '', notes: '', due_at: '', completed: false })

  const load = useCallback(async () => {
    if (!ACTIVITIES_URL) { setError('VITE_ACTIVITIES_API_BASE_URL not configured.'); return }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try   { setRows(await api<Activity[]>(`${ACTIVITIES_URL}/api/v1/activities`)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setForm({ activity_type: 'email', subject: '', account_id: '', contact_id: '', notes: '', due_at: '', completed: false }); setSaveErr(null); setModal({ mode: 'create' }) }
  function openEdit(a: Activity) {
    setForm({ activity_type: a.activity_type, subject: a.subject, account_id: a.account_id ?? '', contact_id: a.contact_id ?? '', notes: a.notes ?? '', due_at: a.due_at ? a.due_at.slice(0, 16) : '', completed: a.completed })
    setSaveErr(null); setModal({ mode: 'edit', record: a }) }
  function openDelete(a: Activity) { setSaveErr(null); setModal({ mode: 'delete', id: a.id, label: a.subject }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { activity_type: form.activity_type, subject: form.subject.trim(), account_id: form.account_id.trim() || undefined, contact_id: form.contact_id.trim() || undefined, notes: form.notes.trim() || undefined, due_at: form.due_at || undefined, ...(modal?.mode === 'edit' ? { completed: form.completed } : {}) }
    try {
      if (modal?.mode === 'create')        await api(`${ACTIVITIES_URL}/api/v1/activities`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${ACTIVITIES_URL}/api/v1/activities/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    try { await api(`${ACTIVITIES_URL}/api/v1/activities/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  return (
    <>
      {loading && <Spinner label="Loading activities…" />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <CustomEmptyState
          icon={<DocumentIcon />}
          title="No activities yet"
          description="Create your first activity to log interactions."
          onRefresh={load}
          ctaText="+ New activity"
          onCtaClick={openCreate}
        />
      )}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-text-subtle">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New activity</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[580px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-text-subtle">
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Done</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    <td className="max-w-[200px] truncate px-3 py-2 text-zinc-200">{a.subject}</td>
                    <td className="px-3 py-2"><Badge value={a.activity_type} map={ACTIVITY_COLOR} /></td>
                    <td className="px-3 py-2">{a.completed ? <span className="text-green-400">✓</span> : <span className="text-zinc-600">—</span>}</td>
                    <td className="px-3 py-2 font-mono text-text-muted">{a.due_at?.slice(0, 10) ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-text-subtle">{a.created_at.slice(0, 10)}</td>
                    <ActionButtons onEdit={() => openEdit(a)} onDelete={() => openDelete(a)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'New activity' : 'Edit activity'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type">
                <select className={INPUT_CLS} value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
                  {['email','call','meeting','task'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Due date/time">
                <input type="datetime-local" className={INPUT_CLS} value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Subject *">
              <input className={INPUT_CLS} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Account ID">
                <input className={INPUT_CLS} placeholder="UUID" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} />
              </FormField>
              <FormField label="Contact ID">
                <input className={INPUT_CLS} placeholder="UUID" value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea className={`${INPUT_CLS} resize-none`} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
            {modal.mode === 'edit' && (
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={form.completed} onChange={e => setForm(f => ({ ...f, completed: e.target.checked }))} className="rounded" />
                Mark as completed
              </label>
            )}
            {saveErr && <SaveError message={saveErr} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={handleDelete} onClose={() => setModal(null)} saving={saving} error={saveErr} />
      )}
    </>
  )
}
