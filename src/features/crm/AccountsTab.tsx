import { useState, useEffect, useCallback } from 'react'
import { resolveAdminToken } from '../../config'
import { BulkEditModal } from '../../components/BulkEditModal'
import { crmStore } from '../../lib/crmStore.mock'
import { clearSelection, toggleAll, toggleRow } from '../../lib/rowSelection'
import { useRowSelection } from '../../lib/useRowSelection'
import type { Account, ModalMode, PagedResponse } from './types'
import { api, ACCOUNTS_URL, ACCOUNTS_DEMO } from './api'
import { useResource } from './useResource'
import { ACCOUNT_STATUSES } from './vocabulary'
import {
  Spinner, ErrorBox, CustomEmptyState, DocumentIcon, DemoDataBadge,
  SelectionToolbar, SelectAllCheckbox, Badge, STATUS_COLOR, ActionButtons,
  Modal, FormField, INPUT_CLS, SaveError, DeleteModal, NO_TOKEN_MSG,
} from './ui'

const NO_ACCOUNTS: Account[] = []

// ---------------------------------------------------------------------------
// AccountsTab
// ---------------------------------------------------------------------------
export function AccountsTab() {
  const [modal, setModal]     = useState<ModalMode<Account>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [form, setForm]       = useState({ name: '', domain: '', status: 'active' })

  // Evaluated during render, so a refused load is the FIRST paint's state
  // instead of a second render pass over a briefly-wrong empty-state card.
  const blocked = !ACCOUNTS_DEMO && !resolveAdminToken() ? NO_TOKEN_MSG : null

  const fetchAccounts = useCallback(async () => {
    if (ACCOUNTS_DEMO) return crmStore.list('accounts')
    const body = await api<PagedResponse<Account>>(`${ACCOUNTS_URL}/api/v1/accounts?limit=100`)
    return body.data
  }, [])
  const { data: rows, loading, error, reload: load } = useResource(NO_ACCOUNTS, fetchAccounts, blocked)
  // Selection is pruned against the rendered rows (refresh, delete).
  const [selected, setSelected] = useRowSelection(rows)

  // In demo mode, re-read whenever the shared mock store changes (bulk
  // import, bulk edit, or CRUD from another tab).
  useEffect(() => {
    if (!ACCOUNTS_DEMO) return
    return crmStore.subscribe(load)
  }, [load])

  function openCreate() { setForm({ name: '', domain: '', status: 'active' }); setSaveErr(null); setModal({ mode: 'create' }) }
  function openEdit(a: Account) { setForm({ name: a.name, domain: a.domain ?? '', status: a.status }); setSaveErr(null); setModal({ mode: 'edit', record: a }) }
  function openDelete(a: Account) { setSaveErr(null); setModal({ mode: 'delete', id: a.id, label: a.name }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { name: form.name.trim(), domain: form.domain.trim() || undefined, status: form.status }
    if (ACCOUNTS_DEMO) {
      if (modal?.mode === 'create') crmStore.insertFromImport('accounts', { name: body.name, domain: body.domain ?? '', status: body.status })
      else if (modal?.mode === 'edit') crmStore.updateFields('accounts', modal.record.id, body)
      setSaving(false); setModal(null); load()
      return
    }
    try {
      if (modal?.mode === 'create')        await api(`${ACCOUNTS_URL}/api/v1/accounts`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${ACCOUNTS_URL}/api/v1/accounts/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    if (ACCOUNTS_DEMO) {
      crmStore.remove('accounts', modal.id)
      setSaving(false); setModal(null); load()
      return
    }
    try { await api(`${ACCOUNTS_URL}/api/v1/accounts/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  const pageIds = rows.map(a => a.id)

  return (
    <>
      {loading && <Spinner label="Loading accounts…" />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <CustomEmptyState
          icon={<DocumentIcon />}
          title="No accounts yet"
          description="Create your first account to get started."
          onRefresh={load}
          ctaText="+ New account"
          onCtaClick={openCreate}
        />
      )}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-text-subtle">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
              {ACCOUNTS_DEMO && <DemoDataBadge />}
              <SelectionToolbar count={selected.size} onBulkEdit={() => setBulkEditOpen(true)} onClear={() => setSelected(clearSelection())} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New account</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[500px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-text-subtle">
                  {ACCOUNTS_DEMO && (
                    <th className="w-8 px-3 py-2">
                      <SelectAllCheckbox pageIds={pageIds} selected={selected} onToggle={() => setSelected(s => toggleAll(s, pageIds))} />
                    </th>
                  )}
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    {ACCOUNTS_DEMO && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selected.has(a.id)}
                          onChange={() => setSelected(s => toggleRow(s, a.id))}
                          aria-label={`Select ${a.name}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-zinc-200">{a.name}</td>
                    <td className="px-3 py-2 text-text-secondary">{a.domain ?? '—'}</td>
                    <td className="px-3 py-2"><Badge value={a.status} map={STATUS_COLOR} /></td>
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
        <Modal title={modal.mode === 'create' ? 'New account' : 'Edit account'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <FormField label="Name *">
              <input className={INPUT_CLS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="Domain">
              <input className={INPUT_CLS} placeholder="example.com" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} />
            </FormField>
            <FormField label="Status">
              <select className={INPUT_CLS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {ACCOUNT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
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

      {/* Bulk edit modal (demo mode only) */}
      {bulkEditOpen && (
        <BulkEditModal
          entity="accounts"
          targets={rows.filter(a => selected.has(a.id)).map(a => ({ id: a.id, label: a.name }))}
          onApplied={() => setSelected(clearSelection())}
          onClose={() => { setBulkEditOpen(false); load() }}
        />
      )}
    </>
  )
}
