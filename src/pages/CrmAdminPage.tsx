import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { resolveAdminToken } from '../config'
import { useAuth } from '../features/auth/useAuth'
import { HealthView } from './ServiceHealthPage'
import { BulkImportModal } from '../components/BulkImportModal'
import type { ImportEntity } from '../lib/bulkImportCsv'
import type { Tab } from '../features/crm/types'
import { ContactsTab } from '../features/crm/ContactsTab'
import { AccountsTab } from '../features/crm/AccountsTab'
import { OpportunitiesTab } from '../features/crm/OpportunitiesTab'
import { ActivitiesTab } from '../features/crm/ActivitiesTab'
import { LiveFeedTab } from '../features/crm/LiveFeedTab'
import { ProjectsTab } from '../features/crm/ProjectsTab'
import { SpendTab } from '../features/crm/SpendTab'
import { PortalLoginGate } from '../features/crm/PortalLoginGate'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const TABS: { id: Tab; label: string }[] = [
  { id: 'leads',         label: 'Leads' },
  { id: 'contacts',      label: 'Contacts' },
  { id: 'accounts',      label: 'Accounts' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'activities',    label: 'Activities' },
  { id: 'live-feed',     label: 'Live Feed' },
  { id: 'projects',      label: 'Projects' },
  { id: 'spend',          label: 'Spend' },
  { id: 'health',         label: 'Service Health' },
]

// Tabs that map to a bulk-importable entity (others fall back to contacts).
const BULK_ENTITY_BY_TAB: Partial<Record<Tab, ImportEntity>> = {
  leads: 'contacts',
  contacts: 'contacts',
  accounts: 'accounts',
  opportunities: 'opportunities',
}

export function CrmAdminPage() {
  const [tab, setTab] = useState<Tab>('leads')
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const { token } = useAuth()

  if (!token && !resolveAdminToken()) return (
    <PageLayout><PortalLoginGate /></PageLayout>
  )

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">CRM — Admin</h1>
            <p className="mt-1 text-sm text-text-muted">Live data from the microservices. Requires service URLs configured and either <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">VITE_ADMIN_JWT</code> set or an active portal login.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setBulkImportOpen(true)} className="btn-neutral px-3 py-1.5 text-xs">Bulk import</button>
            <a href="#/admin/consultations" className="btn-neutral px-3 py-1.5 text-xs">← Admin</a>
          </div>
        </div>

        {/* Scrollable tab bar */}
        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-max gap-1 rounded-xl bg-zinc-800/50 p-1">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  tab === t.id ? 'bg-amber-500/20 text-amber-300' : 'text-text-muted hover:text-zinc-200'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab content */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        {tab === 'leads'         && <ContactsTab stageFilter="lead" />}
        {tab === 'contacts'      && <ContactsTab />}
        {tab === 'accounts'      && <AccountsTab />}
        {tab === 'opportunities' && <OpportunitiesTab />}
        {tab === 'activities'    && <ActivitiesTab />}
        {tab === 'live-feed'     && <LiveFeedTab />}
        {tab === 'projects'      && <ProjectsTab />}
        {tab === 'spend'         && <SpendTab />}
        {tab === 'health'        && <HealthView />}
      </section>

      {bulkImportOpen && (
        <BulkImportModal
          initialEntity={BULK_ENTITY_BY_TAB[tab] ?? 'contacts'}
          onClose={() => setBulkImportOpen(false)}
        />
      )}
    </PageLayout>
  )
}
