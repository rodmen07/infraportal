import { Component, StrictMode, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './features/layout/ThemeContext'
import { AuthProvider } from './features/auth/AuthContext'
import { NotificationProvider } from './features/notifications/NotificationContext'
import './styles/tokens.css'
import './index.css'
import 'highlight.js/styles/github-dark.css'
import App from './App'
import { ServicesPage } from './pages/ServicesPage'
import { PricingPage } from './pages/PricingPage'
import { RetainersPage } from './pages/RetainersPage'
import { LeadMagnetPage } from './pages/LeadMagnetPage'
import { ContactPage } from './pages/ContactPage'
import { AboutPage } from './pages/AboutPage'
import { PatchNotesPage } from './pages/PatchNotesPage'
import { CheckoutThankYouPage } from './pages/CheckoutThankYouPage'
import { RouteLoadingFallback } from './components/RouteLoadingFallback'

const WATCHDOG_DELAY_MS = 5000

// Lazy routes (v1.18.5, F12): everything below is admin, portal, case-study,
// or internal-operations surface that a first-time visitor hitting the
// marketing funnel (Home/About/Services/Pricing/Contact) never needs on
// first paint. Splitting these out of the initial chunk took it from
// ~800 KB to well under budget pre-gzip (see the v1.18.5 PR body for the
// exact before/after numbers, measured with a real `npm run build`, not
// estimated). Each lazy() call follows the same shape ApiDocsPage already
// established (kept below, now sharing the same Suspense fallback).
const CrmAdminPage = lazy(() => import('./pages/CrmAdminPage').then((m) => ({ default: m.CrmAdminPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage').then((m) => ({ default: m.UserDashboardPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const ObservaboardPage = lazy(() => import('./pages/ObservaboardPage').then((m) => ({ default: m.ObservaboardPage })))
const PortalPage = lazy(() => import('./pages/PortalPage').then((m) => ({ default: m.PortalPage })))
const PortalLoginPage = lazy(() => import('./pages/PortalLoginPage').then((m) => ({ default: m.PortalLoginPage })))
const PortalRegisterPage = lazy(() =>
  import('./pages/PortalRegisterPage').then((m) => ({ default: m.PortalRegisterPage })),
)
const PortalForgotPasswordPage = lazy(() =>
  import('./pages/PortalForgotPasswordPage').then((m) => ({ default: m.PortalForgotPasswordPage })),
)
const PortalResetPasswordPage = lazy(() =>
  import('./pages/PortalResetPasswordPage').then((m) => ({ default: m.PortalResetPasswordPage })),
)
const AuditPage = lazy(() => import('./pages/AuditPage').then((m) => ({ default: m.AuditPage })))
const ServiceHealthPage = lazy(() => import('./pages/ServiceHealthPage').then((m) => ({ default: m.ServiceHealthPage })))
const ConsultationsPage = lazy(() => import('./pages/ConsultationsPage').then((m) => ({ default: m.ConsultationsPage })))
const SupportQueuePage = lazy(() => import('./pages/SupportQueuePage').then((m) => ({ default: m.SupportQueuePage })))
const CaseStudiesPage = lazy(() => import('./pages/CaseStudiesPage').then((m) => ({ default: m.CaseStudiesPage })))
const MicroservicesCaseStudyPage = lazy(() =>
  import('./pages/MicroservicesCaseStudyPage').then((m) => ({ default: m.MicroservicesCaseStudyPage })),
)
const Soc2CaseStudyPage = lazy(() => import('./pages/Soc2CaseStudyPage').then((m) => ({ default: m.Soc2CaseStudyPage })))
const CicdCaseStudyPage = lazy(() => import('./pages/CicdCaseStudyPage').then((m) => ({ default: m.CicdCaseStudyPage })))
const CloudMigrationCaseStudyPage = lazy(() =>
  import('./pages/CloudMigrationCaseStudyPage').then((m) => ({ default: m.CloudMigrationCaseStudyPage })),
)
const DynamoDbCaseStudyPage = lazy(() =>
  import('./pages/DynamoDbCaseStudyPage').then((m) => ({ default: m.DynamoDbCaseStudyPage })),
)

// Lazy route: the API reference carries the 11 committed OpenAPI snapshots as
// their own chunks, so none of that weight lands in the initial bundle.
const ApiDocsPage = lazy(() =>
  import('./pages/ApiDocsPage').then((module) => ({ default: module.ApiDocsPage })),
)

// eslint-disable-next-line react-refresh/only-export-components
function FailureMessage({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-text-primary">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-red-500/40 bg-zinc-900/90 p-6 shadow-xl shadow-black/40">
        <h1 className="text-xl font-semibold text-red-300">Main page did not load</h1>
        <p className="mt-3 text-sm text-text-secondary">
          The UI failed to render correctly. You can refresh now, or return home and try again.
        </p>
        <p className="mt-2 text-xs text-text-subtle">Reason: {reason}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-zinc-700"
          >
            Reload page
          </button>
          <a
            href="#/"
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-zinc-700"
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

// eslint-disable-next-line react-refresh/only-export-components
function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
}

// eslint-disable-next-line react-refresh/only-export-components
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
  if (hash === '#/pricing') return <PricingPage />
  if (hash === '#/retainers') return <RetainersPage />
  if (hash === '#/lead-magnet' || hash === '#/infrastructure-audit-checklist') return <LeadMagnetPage />
  if (hash === '#/patch-notes') return <PatchNotesPage />
  if (hash === '#/case-studies/microservices-platform')
    return (
      <LazyRoute>
        <MicroservicesCaseStudyPage />
      </LazyRoute>
    )
  if (hash === '#/case-studies/soc2-terraform-module')
    return (
      <LazyRoute>
        <Soc2CaseStudyPage />
      </LazyRoute>
    )
  if (hash === '#/case-studies/cicd-pipeline-template')
    return (
      <LazyRoute>
        <CicdCaseStudyPage />
      </LazyRoute>
    )
  if (hash === '#/case-studies/fly-to-gcp-migration')
    return (
      <LazyRoute>
        <CloudMigrationCaseStudyPage />
      </LazyRoute>
    )
  if (hash === '#/case-studies/dynamodb-idempotency')
    return (
      <LazyRoute>
        <DynamoDbCaseStudyPage />
      </LazyRoute>
    )
  if (hash === '#/case-studies' || hash.startsWith('#/case-studies/'))
    return (
      <LazyRoute>
        <CaseStudiesPage />
      </LazyRoute>
    )
  if (hash === '#/crm/admin')
    return (
      <LazyRoute>
        <CrmAdminPage />
      </LazyRoute>
    )
  if (hash === '#/search')
    return (
      <LazyRoute>
        <SearchPage />
      </LazyRoute>
    )
  if (hash === '#/crm/dashboard')
    return (
      <LazyRoute>
        <UserDashboardPage />
      </LazyRoute>
    )
  if (hash === '#/crm/reports')
    return (
      <LazyRoute>
        <ReportsPage />
      </LazyRoute>
    )
  if (hash === '#/portal/login')
    return (
      <LazyRoute>
        <PortalLoginPage />
      </LazyRoute>
    )
  if (hash.startsWith('#/portal/register'))
    return (
      <LazyRoute>
        <PortalRegisterPage />
      </LazyRoute>
    )
  if (hash.startsWith('#/portal/forgot-password'))
    return (
      <LazyRoute>
        <PortalForgotPasswordPage />
      </LazyRoute>
    )
  if (hash.startsWith('#/portal/reset-password'))
    return (
      <LazyRoute>
        <PortalResetPasswordPage />
      </LazyRoute>
    )
  if (hash === '#/portal' || hash.startsWith('#/portal/'))
    return (
      <LazyRoute>
        <PortalPage />
      </LazyRoute>
    )
  if (hash === '#/observaboard')
    return (
      <LazyRoute>
        <ObservaboardPage />
      </LazyRoute>
    )
  if (hash === '#/admin/audit')
    return (
      <LazyRoute>
        <AuditPage />
      </LazyRoute>
    )
  if (hash === '#/admin/health')
    return (
      <LazyRoute>
        <ServiceHealthPage />
      </LazyRoute>
    )
  if (hash === '#/admin/consultations')
    return (
      <LazyRoute>
        <ConsultationsPage />
      </LazyRoute>
    )
  if (hash === '#/admin/support')
    return (
      <LazyRoute>
        <SupportQueuePage />
      </LazyRoute>
    )
  // Bare route or a v1.17.3 deep link (#/api-docs?service=...&op=...).
  if (hash === '#/api-docs' || hash.startsWith('#/api-docs?')) {
    return (
      <LazyRoute>
        <ApiDocsPage />
      </LazyRoute>
    )
  }
  if (hash.startsWith('#/checkout-thank-you')) return <CheckoutThankYouPage />
  if (hash.startsWith('#/thank-you')) return <CheckoutThankYouPage />
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
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <Root />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </RootBoundary>
  </StrictMode>,
)
