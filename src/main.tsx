import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AccountsPage } from './pages/AccountsPage'
import { ApiReferencePage } from './pages/ApiReferencePage'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { ContactsPage } from './pages/ContactsPage'
import { GuidePage } from './pages/GuidePage'
import { TiersPage } from './pages/TiersPage'

function Root() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#/tiers') return <TiersPage />
  if (hash === '#/guide') return <GuidePage />
  if (hash === '#/architecture') return <ArchitecturePage />
  if (hash === '#/api') return <ApiReferencePage />
  if (hash === '#/accounts') return <AccountsPage />
  if (hash === '#/contacts') return <ContactsPage />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
