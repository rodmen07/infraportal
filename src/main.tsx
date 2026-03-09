import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'highlight.js/styles/github-dark.css'
import App from './App'
import { ServicesPage } from './pages/ServicesPage'
import { CaseStudiesPage } from './pages/CaseStudiesPage'
import { PricingPage } from './pages/PricingPage'
import { ContactPage } from './pages/ContactPage'
import { DynamoDbCaseStudyPage } from './pages/DynamoDbCaseStudyPage'
import { MicroservicesCaseStudyPage } from './pages/MicroservicesCaseStudyPage'

function Root() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#/services') return <ServicesPage />
  if (hash === '#/case-studies') return <CaseStudiesPage />
  if (hash === '#/case-studies/dynamodb-idempotency') return <DynamoDbCaseStudyPage />
  if (hash === '#/case-studies/microservices-platform') return <MicroservicesCaseStudyPage />
  if (hash === '#/pricing') return <PricingPage />
  if (hash === '#/contact') return <ContactPage />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
