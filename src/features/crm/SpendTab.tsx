import { useState, useEffect, useCallback } from 'react'
import { resolveAdminToken } from '../../config'
import type { SpendRecord, SpendSummary, SpendListResponse, SyncResult, ModalMode } from './types'
import { api, SPEND_URL } from './api'
import {
  Spinner, ErrorBox, CustomEmptyState, DocumentIcon, Badge, FALLBACK_BADGE,
  ActionButtons, Modal, FormField, INPUT_CLS, SaveError, DeleteModal, NO_TOKEN_MSG,
} from './ui'

// ---------------------------------------------------------------------------
// Spend tab
// ---------------------------------------------------------------------------
const PLATFORM_COLOR: Record<string, string> = {
  gcp:            'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  flyio:          'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  anthropic:      'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  github_copilot: 'bg-green-500/15 text-green-300 ring-green-500/30',
  github:         'bg-green-500/15 text-green-300 ring-green-500/30',
  aws:            'bg-orange-500/15 text-orange-300 ring-orange-500/30',
}
const SOURCE_COLOR: Record<string, string> = {
  manual:              'bg-zinc-500/15 text-text-muted ring-zinc-500/30',
  bigquery:            'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  flyio_graphql:       'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  github_api:          'bg-green-500/15 text-green-300 ring-green-500/30',
  aws_cost_explorer:   'bg-orange-500/15 text-orange-300 ring-orange-500/30',
}
const PLATFORM_LABELS: Record<string, string> = {
  gcp: 'GCP', flyio: 'Fly.io', anthropic: 'Anthropic', github_copilot: 'GitHub Copilot',
  github: 'GitHub', aws: 'AWS',
}

export function SpendTab() {
  const [rows, setRows] = useState<SpendRecord[]>([])
  const [summary, setSummary] = useState<SpendSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalMode<SpendRecord>>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Filters
  const [filterPlatform, setFilterPlatform] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    if (!SPEND_URL)  { setError('VITE_SPEND_API_BASE_URL not configured.'); return }
    if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      if (filterPlatform) params.set('platform', filterPlatform)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const [list, sum] = await Promise.all([
        api<SpendListResponse>(`${SPEND_URL}/api/v1/spend?${params}`),
        api<SpendSummary>(`${SPEND_URL}/api/v1/spend/summary?${params}`),
      ])
      setRows(list.data)
      setSummary(sum)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally     { setLoading(false) }
  }, [filterPlatform, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  async function handleSync(platform: 'gcp' | 'flyio' | 'github' | 'aws') {
    setSyncing(platform); setSyncMsg(null)
    try {
      const result = await api<SyncResult>(`${SPEND_URL}/api/v1/spend/sync/${platform}`, { method: 'POST' })
      const parts = [`${result.records_imported} imported, ${result.records_skipped} skipped`]
      if (result.errors.length) parts.push(`${result.errors.length} error(s)`)
      setSyncMsg(`${PLATFORM_LABELS[platform]}: ${parts.join(' — ')}`)
      load()
    } catch (e) { setSyncMsg(`Sync failed: ${e instanceof Error ? e.message : String(e)}`) }
    finally { setSyncing(null) }
  }

  async function handleSave(form: HTMLFormElement) {
    setSaving(true); setSaveError(null)
    const fd = Object.fromEntries(new FormData(form))
    const body: Record<string, unknown> = {
      platform: fd.platform as string,
      date: fd.date as string,
      amount_usd: parseFloat(fd.amount_usd as string) || 0,
      granularity: fd.granularity as string || 'daily',
    }
    if (fd.service_label) body.service_label = fd.service_label
    if (fd.notes) body.notes = fd.notes
    try {
      if (modal?.mode === 'edit') {
        await api(`${SPEND_URL}/api/v1/spend/${modal.record.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await api(`${SPEND_URL}/api/v1/spend`, { method: 'POST', body: JSON.stringify(body) })
      }
      setModal(null); load()
    } catch (e) { setSaveError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setSaving(true); setSaveError(null)
    try {
      await api(`${SPEND_URL}/api/v1/spend/${id}`, { method: 'DELETE' })
      setModal(null); load()
    } catch (e) { setSaveError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner label="Loading spend data…" />
  if (error) return <ErrorBox message={error} onRetry={load} />

  const fmt = (n: number) => `$${n.toFixed(2)}`

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
            <p className="text-xs font-medium text-text-subtle uppercase">Total</p>
            <p className="mt-1 text-xl font-bold text-white">{fmt(summary.total_usd)}</p>
          </div>
          {summary.by_platform.map(p => (
            <div key={p.platform} className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
              <p className="text-xs font-medium text-text-subtle uppercase">{PLATFORM_LABELS[p.platform] ?? p.platform}</p>
              <p className="mt-1 text-xl font-bold text-white">{fmt(p.total_usd)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={load} className="btn-neutral px-3 py-1.5 text-xs">Refresh</button>
        <button type="button" onClick={() => handleSync('gcp')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'gcp' ? 'Syncing…' : 'Sync GCP'}
        </button>
        <button type="button" onClick={() => handleSync('flyio')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'flyio' ? 'Syncing…' : 'Sync Fly.io'}
        </button>
        <button type="button" onClick={() => handleSync('github')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'github' ? 'Syncing…' : 'Sync GitHub'}
        </button>
        <button type="button" onClick={() => handleSync('aws')} disabled={!!syncing} className="btn-neutral px-3 py-1.5 text-xs disabled:opacity-50">
          {syncing === 'aws' ? 'Syncing…' : 'Sync AWS'}
        </button>
        <div className="flex-1" />
        {rows.length > 0 && ( /* Only show if there are rows, otherwise the empty state has it */
          <button type="button" onClick={() => { setModal({ mode: 'create' }); setSaveError(null) }} className="btn-accent px-3 py-1.5 text-xs">+ Manual Entry</button>
        )}
      </div>

      {syncMsg && (
        <p className="rounded-lg bg-zinc-800 px-3 py-2 text-xs text-text-secondary">{syncMsg}</p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
          className={`${INPUT_CLS} w-auto min-w-[130px]`}>
          <option value="">All platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" className={`${INPUT_CLS} w-auto`} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" className={`${INPUT_CLS} w-auto`} />
        {(filterPlatform || dateFrom || dateTo) && (
          <button type="button" onClick={() => { setFilterPlatform(''); setDateFrom(''); setDateTo('') }} className="text-xs text-text-muted hover:text-white">Clear</button>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <CustomEmptyState
          icon={<DocumentIcon />}
          title="No spend records found"
          description="Add a manual entry or sync from a platform."
          onRefresh={load}
          ctaText="+ Manual Entry"
          onCtaClick={() => { setModal({ mode: 'create' }); setSaveError(null) }}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700/50">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-700/50 bg-zinc-800/30 text-xs text-text-subtle">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Platform</th>
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 ? 'bg-zinc-800/20' : ''}>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2"><Badge value={PLATFORM_LABELS[r.platform] ?? r.platform} map={Object.fromEntries(Object.entries(PLATFORM_LABELS).map(([k, v]) => [v, PLATFORM_COLOR[k] ?? FALLBACK_BADGE]))} /></td>
                  <td className="px-3 py-2 text-text-muted">{r.service_label ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-200">{fmt(r.amount_usd)}</td>
                  <td className="px-3 py-2"><Badge value={r.source} map={SOURCE_COLOR} /></td>
                  <td className="px-3 py-2 text-text-subtle max-w-[200px] truncate">{r.notes ?? ''}</td>
                  {r.source === 'manual' ? (
                    <ActionButtons
                      onEdit={() => { setModal({ mode: 'edit', record: r }); setSaveError(null) }}
                      onDelete={() => { setModal({ mode: 'delete', id: r.id, label: `${r.platform} ${r.date}` }); setSaveError(null) }}
                    />
                  ) : <td className="px-3 py-2" />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly breakdown */}
      {summary && summary.by_month.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-text-subtle uppercase">Monthly Totals</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {summary.by_month.map(m => (
              <div key={m.month} className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2">
                <p className="text-xs text-text-subtle">{m.month}</p>
                <p className="text-sm font-semibold text-white">{fmt(m.total_usd)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (modal.mode === 'create' || modal.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'Add spend record' : 'Edit spend record'} onClose={() => setModal(null)}>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(e.currentTarget) }}>
            <FormField label="Platform">
              <select name="platform" defaultValue={modal.mode === 'edit' ? modal.record.platform : ''} required className={INPUT_CLS}>
                <option value="" disabled>Select platform</option>
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="Date">
              <input type="date" name="date" defaultValue={modal.mode === 'edit' ? modal.record.date : ''} required className={INPUT_CLS} />
            </FormField>
            <FormField label="Amount (USD)">
              <input type="number" name="amount_usd" step="0.01" min="0" defaultValue={modal.mode === 'edit' ? modal.record.amount_usd : ''} required className={INPUT_CLS} />
            </FormField>
            <FormField label="Granularity">
              <select name="granularity" defaultValue={modal.mode === 'edit' ? modal.record.granularity : 'daily'} className={INPUT_CLS}>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </FormField>
            <FormField label="Service label (optional)">
              <input type="text" name="service_label" defaultValue={modal.mode === 'edit' ? modal.record.service_label ?? '' : ''} placeholder="e.g. Cloud Run" className={INPUT_CLS} />
            </FormField>
            <FormField label="Notes (optional)">
              <input type="text" name="notes" defaultValue={modal.mode === 'edit' ? modal.record.notes ?? '' : ''} className={INPUT_CLS} />
            </FormField>
            {saveError && <SaveError message={saveError} />}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="btn-neutral px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-accent px-4 py-2 text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal?.mode === 'delete' && (
        <DeleteModal label={modal.label} onConfirm={() => handleDelete(modal.id)} onClose={() => setModal(null)} saving={saving} error={saveError} />
      )}
    </div>
  )
}
