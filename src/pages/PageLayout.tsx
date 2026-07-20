// ---------------------------------------------------------------------------
// Styling note (v1.18.1 PR2): the page shell is expressed in semantic token
// utilities from src/styles/tokens.css. `forge-grid` now owns the page
// background (surface-0 plus the tokenized grid lines), which is why there is
// no bg-* utility on the shell and why the `[data-theme="light"] .forge-grid`
// override is deleted.
//
// v1.18.2 PR1 (D3, finding F4): the split TopNav/SideNav model is retired.
// SideNav (a desktop drawer that was closed by default while `lg:pl-64`
// permanently reserved a 256px gutter for it) is gone; TopNav is now the one
// navigation system on every route and at every width, matching the home
// page. A skip-to-content link and a labelled <main id="main-content">
// landmark are added for keyboard users (finding F11).
// ---------------------------------------------------------------------------
import { TopNav } from '../features/layout/TopNav'
import { SkipLink } from '../features/layout/SkipLink'

interface PageLayoutProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
}

export function PageLayout({ title, subtitle, children }: PageLayoutProps) {
  return (
    <>
      <SkipLink />
      <div className="forge-grid relative min-h-screen px-2 py-6 text-text-primary sm:px-4 sm:py-8 lg:px-8 xl:px-10">
        <div className="pointer-events-none absolute inset-0 overflow-clip">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        </div>

        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
          <TopNav />

          <main id="main-content" tabIndex={-1} className="flex flex-col gap-6 focus:outline-none">
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
          </main>
        </div>
      </div>
    </>
  )
}
