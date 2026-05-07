import { useTheme } from './useTheme'
import { useAuth } from '../auth/useAuth'
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS, WORKSPACE_NAV_ITEMS, type NavItem } from './navItems'
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
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
          isActive(item)
            ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-100'
            : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
        }`}
      >
        {item.label}
      </a>
    ))
  )

  return (
    <nav className="sticky top-2 z-40 rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-3 shadow-xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold tracking-tight text-amber-300">RMCC</div>
          <p className="mt-1 text-[11px] text-zinc-400">Client portal, dashboards, and delivery status</p>
        </div>
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
            className="rounded-lg border border-zinc-600/40 bg-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100"
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

        {ADMIN_NAV_ITEMS.length > 0 && (
          <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <span>Admin</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>
            <div className="flex min-w-max items-center gap-2">
              {renderItems(ADMIN_NAV_ITEMS)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 h-0.5 overflow-hidden rounded-full bg-zinc-800/90">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400" />
      </div>
    </nav>
  )
}

export const TopNav = TopNavComponent
export default TopNavComponent
