import { useState, useEffect, useCallback } from 'react'
import { resolveAdminToken } from '../../config'
import { BulkEditModal } from '../../components/BulkEditModal'
import { crmStore } from '../../lib/crmStore.mock'
import { clearSelection, toggleAll, toggleRow } from '../../lib/rowSelection'
import { useRowSelection } from '../../lib/useRowSelection'
import type { Contact, ModalMode, PagedResponse } from './types'
import { api, CONTACTS_URL, CONTACTS_DEMO } from './api'
import { useResource } from './useResource'
import { CONTACT_LIFECYCLE_STAGES } from './vocabulary'
import {
  Spinner, ErrorBox, CustomEmptyState, DocumentIcon, DemoDataBadge,
  SelectionToolbar, SelectAllCheckbox, Badge, LIFECYCLE_COLOR, ActionButtons,
  Modal, FormField, INPUT_CLS, SaveError, DeleteModal, NO_TOKEN_MSG,
} from './ui'

const NO_CONTACTS: Contact[] = []

// ---------------------------------------------------------------------------
// ContactsTab (shared with LeadsTab via stageFilter prop)
// ---------------------------------------------------------------------------
export function ContactsTab({ stageFilter }: { stageFilter?: string }) {
  const [modal, setModal]     = useState<ModalMode<Contact>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', lifecycle_stage: stageFilter ?? 'lead', account_id: '' })

  // Evaluated during render, so a refused load is the FIRST paint's state
  // instead of a second render pass over a briefly-wrong empty-state card.
  const blocked = !CONTACTS_DEMO && !resolveAdminToken() ? NO_TOKEN_MSG : null

  // `stageFilter` is part of the fetcher's identity, so a stage change
  // re-loads (and shows the spinner again) without extra bookkeeping.
  const fetchContacts = useCallback(async () => {
    if (CONTACTS_DEMO) {
      const all = crmStore.list('contacts')
      return stageFilter ? all.filter(c => c.lifecycle_stage === stageFilter) : all
    }
    const qs = stageFilter ? `lifecycle_stage=${stageFilter}&limit=100` : 'limit=100'
    const body = await api<PagedResponse<Contact>>(`${CONTACTS_URL}/api/v1/contacts?${qs}`)
    return body.data
  }, [stageFilter])
  const { data: rows, loading, error, reload: load } = useResource(NO_CONTACTS, fetchContacts, blocked)
  // Selection is pruned against the rendered rows (refresh, delete, stage change).
  const [selected, setSelected] = useRowSelection(rows)

  // In demo mode, re-read whenever the shared mock store changes (bulk
  // import, bulk edit, or CRUD from another tab).
  useEffect(() => {
    if (!CONTACTS_DEMO) return
    return crmStore.subscribe(load)
  }, [load])

  function openCreate() {
    setForm({ first_name: '', last_name: '', email: '', phone: '', lifecycle_stage: stageFilter ?? 'lead', account_id: '' })
    setSaveErr(null); setModal({ mode: 'create' })
  }
  function openEdit(c: Contact) {
    setForm({ first_name: c.first_name, last_name: c.last_name, email: c.email ?? '', phone: c.phone ?? '', lifecycle_stage: c.lifecycle_stage, account_id: c.account_id ?? '' })
    setSaveErr(null); setModal({ mode: 'edit', record: c })
  }
  function openDelete(c: Contact) { setSaveErr(null); setModal({ mode: 'delete', id: c.id, label: `${c.first_name} ${c.last_name}` }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, lifecycle_stage: form.lifecycle_stage, account_id: form.account_id.trim() || undefined }
    if (CONTACTS_DEMO) {
      if (modal?.mode === 'create') crmStore.insertFromImport('contacts', { first_name: body.first_name, last_name: body.last_name, email: body.email ?? '', phone: body.phone ?? '', lifecycle_stage: body.lifecycle_stage, account_id: body.account_id ?? '' })
      else if (modal?.mode === 'edit') crmStore.updateFields('contacts', modal.record.id, body)
      setSaving(false); setModal(null); load()
      return
    }
    try {
      if (modal?.mode === 'create')        await api(`${CONTACTS_URL}/api/v1/contacts`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${CONTACTS_URL}/api/v1/contacts/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    if (CONTACTS_DEMO) {
      crmStore.remove('contacts', modal.id)
      setSaving(false); setModal(null); load()
      return
    }
    try { await api(`${CONTACTS_URL}/api/v1/contacts/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  const entity = stageFilter === 'lead' ? 'lead' : 'contact'
  const pageIds = rows.map(c => c.id)

  return (
    <>
      {loading && <Spinner label={`Loading ${entity}s…`} />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <CustomEmptyState
          icon={<DocumentIcon />}
          title={`No ${entity}s yet`}
          description={`Create your first ${entity} to get started.`}
          onRefresh={load}
          ctaText={`+ New ${entity}`}
          onCtaClick={openCreate}
        />
      )}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-text-subtle">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
              {CONTACTS_DEMO && <DemoDataBadge />}
              <SelectionToolbar count={selected.size} onBulkEdit={() => setBulkEditOpen(true)} onClear={() => setSelected(clearSelection())} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New {entity}</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-text-subtle">
                  {CONTACTS_DEMO && (
                    <th className="w-8 px-3 py-2">
                      <SelectAllCheckbox pageIds={pageIds} selected={selected} onToggle={() => setSelected(s => toggleAll(s, pageIds))} />
                    </th>
                  )}
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    {CONTACTS_DEMO && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selected.has(c.id)}
                          onChange={() => setSelected(s => toggleRow(s, c.id))}
                          aria-label={`Select ${c.first_name} ${c.last_name}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-zinc-200">{c.first_name} {c.last_name}</td>
                    <td className="px-3 py-2 text-text-secondary">{c.email ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2"><Badge value={c.lifecycle_stage} map={LIFECYCLE_COLOR} /></td>
                    <td className="px-3 py-2 font-mono text-text-subtle">{c.created_at.slice(0, 10)}</td>
                    <ActionButtons onEdit={() => openEdit(c)} onDelete={() => openDelete(c)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? `New ${entity}` : `Edit ${entity}`} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name *">
                <input className={INPUT_CLS} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
              </FormField>
              <FormField label="Last name *">
                <input className={INPUT_CLS} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
              </FormField>
            </div>
            <FormField label="Email">
              <input type="email" className={INPUT_CLS} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </FormField>
            <FormField label="Phone">
              <input className={INPUT_CLS} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </FormField>
            <FormField label="Lifecycle stage">
              <select className={INPUT_CLS} value={form.lifecycle_stage} onChange={e => setForm(f => ({ ...f, lifecycle_stage: e.target.value }))}>
                {CONTACT_LIFECYCLE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Account ID (optional)">
              <input className={INPUT_CLS} placeholder="UUID of linked account" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} />
            </FormField>
            {saveErr && <SaveError message={saveErr} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={handleDelete} onClose={() => setModal(null)} saving={saving} error={saveErr} />
      )}

      {/* Bulk edit modal (demo mode only) */}
      {bulkEditOpen && (
        <BulkEditModal
          entity="contacts"
          targets={rows.filter(c => selected.has(c.id)).map(c => ({ id: c.id, label: `${c.first_name} ${c.last_name}` }))}
          onApplied={() => setSelected(clearSelection())}
          onClose={() => { setBulkEditOpen(false); load() }}
        />
      )}
    </>
  )
}
