import { Component, StrictMode, useEffect, useState, type ReactNode } from 'react'
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
import { ConsultPage } from './pages/ConsultPage'
import { AboutPage } from './pages/AboutPage'

const WATCHDOG_DELAY_MS = 5000

function FailureMessage({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-red-500/40 bg-zinc-900/90 p-6 shadow-xl shadow-black/40">
        <h1 className="text-xl font-semibold text-red-300">Main page did not load</h1>
        <p className="mt-3 text-sm text-zinc-300">
          The UI failed to render correctly. You can refresh now, or return home and try again.
        </p>
        <p className="mt-2 text-xs text-zinc-500">Reason: {reason}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
          >
            Reload page
          </button>
          <a
            href="#/"
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  )
}

type RootBoundaryProps = {
  children: ReactNode
}

type RootBoundaryState = {
  hasError: boolean
}

class RootBoundary extends Component<RootBoundaryProps, RootBoundaryState> {
  state: RootBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RootBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Root render failure:', error)
  }

  render() {
    if (this.state.hasError) {
      return <FailureMessage reason="runtime exception" />
    }

    return this.props.children
  }
}

function installLoadWatchdog(rootElement: HTMLElement) {
  const timer = window.setTimeout(() => {
    const loaded = rootElement.querySelector('main, section, nav, [data-app-ready]')
    if (loaded) {
      return
    }

    const fallbackRoot = createRoot(rootElement)
    fallbackRoot.render(<FailureMessage reason="expected page elements missing after startup" />)
  }, WATCHDOG_DELAY_MS)

  const clear = () => window.clearTimeout(timer)
  window.addEventListener('load', clear, { once: true })
}

function Root() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const fallback = document.getElementById('boot-fallback')
    if (fallback) {
      fallback.style.display = 'none'
    }
  }, [])

  if (hash === '#/about') return <AboutPage />
  if (hash === '#/services') return <ServicesPage />
  if (hash === '#/case-studies') return <CaseStudiesPage />
  if (hash === '#/case-studies/dynamodb-idempotency') return <DynamoDbCaseStudyPage />
  if (hash === '#/case-studies/microservices-platform') return <MicroservicesCaseStudyPage />
  if (hash === '#/pricing') return <PricingPage />
  if (hash === '#/ask') return <ConsultPage />
  if (hash === '#/contact') return <ContactPage />
  return <App />
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing #root element')
}

installLoadWatchdog(rootElement)

createRoot(rootElement).render(
  <StrictMode>
    <RootBoundary>
      <Root />
    </RootBoundary>
  </StrictMode>,
)
