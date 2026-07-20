// ---------------------------------------------------------------------------
// Styling note (v1.18.1 PR2): the page shell is expressed in semantic token
// utilities from src/styles/tokens.css. `forge-grid` now owns the page
// background (surface-0 plus the tokenized grid lines), which is why there is
// no bg-* utility on <main> and why the `[data-theme="light"] .forge-grid`
// override is deleted in the same PR.
//
// Not this PR: the `lg:pl-64` gutter reserved for the closed SideNav drawer
// and the split TopNav/SideNav model are finding F4, resolved by D3 in
// v1.18.2.
// ---------------------------------------------------------------------------
import { TopNav } from '../features/layout/TopNav'
import { SideNav } from '../features/layout/SideNav'

interface PageLayoutProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
}

export function PageLayout({ title, subtitle, children }: PageLayoutProps) {
  return (
    <main className="forge-grid relative min-h-screen px-2 py-6 text-text-primary sm:px-4 sm:py-8 lg:px-8 lg:pl-64 xl:px-10">
      <SideNav />

      <div className="pointer-events-none absolute inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="lg:hidden py-4">
          <TopNav />
        </div>

        {(title || subtitle) && (
          <header className="forge-panel surface-card-strong overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Operations workspace</p>
                {title && <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{title}</h1>}
                {subtitle && <p className="mt-2 max-w-3xl text-sm text-text-muted sm:text-base">{subtitle}</p>}
              </div>
              <div className="rounded-xl border border-border-soft bg-surface-control px-3 py-2 text-xs text-text-muted">
                Responsive, client-ready views across the portal
              </div>
            </div>
          </header>
        )}

        {children}
      </div>
    </main>
  )
}
