import { useState, useEffect, useCallback } from 'react'
import { resolveAdminToken } from '../../config'
import { BulkEditModal } from '../../components/BulkEditModal'
import { crmStore } from '../../lib/crmStore.mock'
import { clearSelection, pruneSelection, toggleAll, toggleRow } from '../../lib/rowSelection'
import type { Opportunity, ModalMode } from './types'
import { api, OPPS_URL, OPPS_DEMO } from './api'
import {
  Spinner, ErrorBox, CustomEmptyState, DocumentIcon, DemoDataBadge,
  SelectionToolbar, SelectAllCheckbox, Badge, STAGE_COLOR, ActionButtons,
  Modal, FormField, INPUT_CLS, SaveError, DeleteModal, NO_TOKEN_MSG,
} from './ui'

// ---------------------------------------------------------------------------
// OpportunitiesTab
// ---------------------------------------------------------------------------
export function OpportunitiesTab() {
  const [rows, setRows]       = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [modal, setModal]     = useState<ModalMode<Opportunity>>(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [form, setForm]       = useState({ name: '', account_id: '', stage: 'qualification', amount: '', close_date: '' })

  const load = useCallback(async () => {
    if (OPPS_DEMO) {
      setRows(crmStore.list('opportunities'))
      setError(null)
      return
    }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try   { setRows(await api<Opportunity[]>(`${OPPS_URL}/api/v1/opportunities`)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!OPPS_DEMO) return
    return crmStore.subscribe(load)
  }, [load])
  useEffect(() => {
    setSelected(prev => pruneSelection(prev, rows.map(r => r.id)))
  }, [rows])

  function openCreate() { setForm({ name: '', account_id: '', stage: 'qualification', amount: '', close_date: '' }); setSaveErr(null); setModal({ mode: 'create' }) }
  function openEdit(o: Opportunity) {
    setForm({ name: o.name, account_id: o.account_id, stage: o.stage, amount: o.amount > 0 ? String(o.amount) : '', close_date: o.close_date?.slice(0, 10) ?? '' })
    setSaveErr(null); setModal({ mode: 'edit', record: o }) }
  function openDelete(o: Opportunity) { setSaveErr(null); setModal({ mode: 'delete', id: o.id, label: o.name }) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaveErr(null)
    const body = { name: form.name.trim(), account_id: form.account_id.trim(), stage: form.stage, amount: form.amount ? parseFloat(form.amount) : undefined, close_date: form.close_date || undefined }
    if (OPPS_DEMO) {
      if (modal?.mode === 'create') crmStore.insertFromImport('opportunities', { name: body.name, account_id: body.account_id, stage: body.stage, amount: form.amount.trim(), close_date: form.close_date })
      else if (modal?.mode === 'edit') crmStore.updateFields('opportunities', modal.record.id, body)
      setSaving(false); setModal(null); load()
      return
    }
    try {
      if (modal?.mode === 'create')        await api(`${OPPS_URL}/api/v1/opportunities`, { method: 'POST', body: JSON.stringify(body) })
      else if (modal?.mode === 'edit') await api(`${OPPS_URL}/api/v1/opportunities/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModal(null); load()
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally     { setSaving(false) }
  }

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setSaving(true); setSaveErr(null)
    if (OPPS_DEMO) {
      crmStore.remove('opportunities', modal.id)
      setSaving(false); setModal(null); load()
      return
    }
    try { await api(`${OPPS_URL}/api/v1/opportunities/${modal.id}`, { method: 'DELETE' }); setModal(null); load() }
    catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)) }
    finally   { setSaving(false) }
  }

  const totalValue = rows.reduce((s, o) => s + o.amount, 0)
  const pageIds = rows.map(o => o.id)

  return (
    <>
      {loading && <Spinner label="Loading opportunities…" />}
      {error   && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <CustomEmptyState
          icon={<DocumentIcon />}
          title="No opportunities yet"
          description="Create your first opportunity to track deals."
          onRefresh={load}
          ctaText="+ New opportunity"
          onCtaClick={openCreate}
        />
      )}
      {!loading && !error && rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-xs text-text-subtle">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-text-subtle">Total: <span className="text-text-secondary">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span></p>
              {OPPS_DEMO && <DemoDataBadge />}
              <SelectionToolbar count={selected.size} onBulkEdit={() => setBulkEditOpen(true)} onClear={() => setSelected(clearSelection())} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
              <button type="button" onClick={openCreate} className="btn-accent px-3 py-1.5 text-xs">+ New opportunity</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[600px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-text-subtle">
                  {OPPS_DEMO && (
                    <th className="w-8 px-3 py-2">
                      <SelectAllCheckbox pageIds={pageIds} selected={selected} onToggle={() => setSelected(s => toggleAll(s, pageIds))} />
                    </th>
                  )}
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Close date</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o, i) => (
                  <tr key={o.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    {OPPS_DEMO && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selected.has(o.id)}
                          onChange={() => setSelected(s => toggleRow(s, o.id))}
                          aria-label={`Select ${o.name}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-zinc-200">{o.name}</td>
                    <td className="px-3 py-2"><Badge value={o.stage} map={STAGE_COLOR} /></td>
                    <td className="px-3 py-2 text-text-secondary">{o.amount > 0 ? `$${o.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}</td>
                    <td className="px-3 py-2 font-mono text-text-muted">{o.close_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-text-subtle">{o.created_at.slice(0, 10)}</td>
                    <ActionButtons onEdit={() => openEdit(o)} onDelete={() => openDelete(o)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'New opportunity' : 'Edit opportunity'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <FormField label="Name *">
              <input className={INPUT_CLS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="Account ID *">
              <input className={INPUT_CLS} placeholder="UUID of linked account" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Stage">
                <select className={INPUT_CLS} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  {['qualification','proposal','negotiation','closed-won','closed-lost'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Amount ($)">
                <input type="number" min="0" step="0.01" className={INPUT_CLS} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Close date">
              <input type="date" className={INPUT_CLS} value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
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
          entity="opportunities"
          targets={rows.filter(o => selected.has(o.id)).map(o => ({ id: o.id, label: o.name }))}
          onApplied={() => setSelected(clearSelection())}
          onClose={() => { setBulkEditOpen(false); load() }}
        />
      )}
    </>
  )
}
