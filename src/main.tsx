import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AccountsPage } from './pages/AccountsPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { ApiReferencePage } from './pages/ApiReferencePage'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { AutomationPage } from './pages/AutomationPage'
import { ContactsPage } from './pages/ContactsPage'
import { GuidePage } from './pages/GuidePage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { OpportunitiesPage } from './pages/OpportunitiesPage'
import { ReportingPage } from './pages/ReportingPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { TasksPage } from './pages/TasksPage'
import { TiersPage } from './pages/TiersPage'
import { UpdatesPage } from './pages/UpdatesPage'

function Root() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#/tasks') return <TasksPage />
  if (hash === '#/updates') return <UpdatesPage />
  if (hash === '#/tiers') return <TiersPage />
  if (hash === '#/guide') return <GuidePage />
  if (hash === '#/architecture') return <ArchitecturePage />
  if (hash === '#/api') return <ApiReferencePage />
  if (hash === '#/accounts') return <AccountsPage />
  if (hash === '#/contacts') return <ContactsPage />
  if (hash === '#/activities') return <ActivitiesPage />
  if (hash === '#/opportunities') return <OpportunitiesPage />
  if (hash === '#/automation') return <AutomationPage />
  if (hash === '#/integrations') return <IntegrationsPage />
  if (hash === '#/reporting') return <ReportingPage />
  if (hash.startsWith('#/reset-password/')) {
    const token = hash.slice('#/reset-password/'.length)
    return <ResetPasswordPage token={token} />
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
