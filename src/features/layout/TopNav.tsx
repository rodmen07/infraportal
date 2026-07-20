// ---------------------------------------------------------------------------
// Styling note (v1.18.1 PR2): this component's chrome is expressed in the
// semantic token utilities generated from src/styles/tokens.css
// (bg-surface-*, border-border-*, text-text-*, the accent-* set) instead of
// dark-authored zinc/amber utilities. It therefore no longer depends on the
// `[data-theme="light"] nav, aside` !important override that used to repaint
// it in light mode; that rule is deleted in the same PR. Emerald here is a
// status colour (signed-in state) per D4, not chrome.
// ---------------------------------------------------------------------------
import { useTheme } from './useTheme'
import { useAuth } from '../auth/useAuth'
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS, type NavItem } from './navItems'
import { NotificationBell } from '../notifications/NotificationBell'

function TopNavComponent() {
  const hash = window.location.hash
  const { theme, toggle } = useTheme()
  const { claims, logout, isClient } = useAuth()

  const isActive = (item: NavItem) => {
    if (item.scrollTo) return false
    if (item.href === '#/') return hash === '' || hash === '#/' || hash === '#'
    return hash === item.href || hash.startsWith(item.href + '/')
  }

  const handleClick = (item: NavItem) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!item.scrollTo) return
    e.preventDefault()
    window.location.hash = item.href
    setTimeout(() => {
      document.getElementById(item.scrollTo!)?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const renderItems = (items: NavItem[]) => (
    items.map((item) => (
      <a
        key={item.label}
        href={item.href}
        onClick={handleClick(item)}
        aria-current={isActive(item) ? 'page' : undefined}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
          isActive(item)
            ? 'border-accent-line bg-accent-soft text-accent-text'
            : 'border-border-soft bg-surface-control text-text-secondary hover:border-border-strong hover:bg-surface-hover hover:text-text-primary'
        }`}
      >
        {item.label}
      </a>
    ))
  )

  return (
    <nav className="sticky top-2 z-40 rounded-2xl border border-border-soft bg-surface-2 p-3 shadow-xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <a href="#/" className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
          <div className="text-sm font-bold tracking-tight text-accent">RM Cloud Consulting</div>
          <p className="mt-1 text-scale-xs text-text-muted">Managed hosting, deployment support, and ongoing maintenance</p>
        </a>
        <div className="flex items-center gap-2">
          {isClient && (
            <span className="hidden items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-2.5 py-1.5 text-xs text-emerald-300 sm:flex">
              {claims?.username ?? claims?.email ?? claims?.sub?.slice(0, 8) ?? 'Client'}
              <button
                type="button"
                onClick={() => { logout(); window.location.hash = '#/portal/login' }}
                className="text-emerald-500 hover:text-emerald-300"
              >
                Sign out
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg border border-border-soft bg-surface-control px-2.5 py-1.5 text-xs text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text-primary"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
          <div className="flex min-w-max items-center gap-2">
            {renderItems(PRIMARY_NAV_ITEMS)}
          </div>
        </div>

        {isClient && ADMIN_NAV_ITEMS.length > 0 && (
          <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
            <div className="mb-1 flex items-center gap-2 text-scale-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              <span>Admin</span>
              <div className="h-px flex-1 bg-border-soft" />
            </div>
            <div className="flex min-w-max items-center gap-2">
              {renderItems(ADMIN_NAV_ITEMS)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 h-0.5 overflow-hidden rounded-full bg-border-soft">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400" />
      </div>
    </nav>
  )
}

export const TopNav = TopNavComponent
export default TopNavComponent
