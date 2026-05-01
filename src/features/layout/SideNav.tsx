import { useState } from 'react'
import { useTheme } from './ThemeContext'
import { useAuth } from '../auth/AuthContext'
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS, WORKSPACE_NAV_ITEMS } from './navItems'

function SideNavComponent() {
  const [isOpen, setIsOpen] = useState(false)
  const hash = window.location.hash
  const { theme, toggle } = useTheme()
  const { claims, logout, isClient } = useAuth()

  const isActive = (href: string) => {
    if (href === '#/') return hash === '' || hash === '#/' || hash === '#'
    return hash === href || hash.startsWith(href + '/')
  }

  const handleNavClick = () => {
    setIsOpen(false)
  }

  const renderSection = (label: string, items: Array<{ label: string; href: string; scrollTo?: string }>) => (
    <div className="space-y-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      {items.map((item) => (
        <a
          key={item.href + item.label}
          href={item.href}
          onClick={(e) => {
            if (!item.scrollTo) return
            e.preventDefault()
            window.location.hash = item.href
            setTimeout(() => {
              document.getElementById(item.scrollTo!)?.scrollIntoView({ behavior: 'smooth' })
            }, 50)
            handleNavClick()
          }}
          className={`block rounded-lg border px-3 py-2 text-xs font-medium leading-5 transition ${
            isActive(item.href)
              ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-100'
              : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
          }`}
        >
          {item.label}
        </a>
      ))}
    </div>
  )

  const navContent = (
    <>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold tracking-tight text-amber-300">RMCC</div>
          <p className="mt-1 text-[11px] text-zinc-400">Client portal and operations view</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-md border border-zinc-600/40 bg-zinc-800/60 px-1.5 py-0.5 text-xs text-zinc-300 transition hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <nav className="space-y-4">
        {renderSection('Explore', PRIMARY_NAV_ITEMS)}
        {renderSection('Workspace', WORKSPACE_NAV_ITEMS)}
        {renderSection('Admin', ADMIN_NAV_ITEMS)}
      </nav>

      {isClient && (
        <div className="mt-5 rounded-xl border border-emerald-600/30 bg-emerald-900/15 p-3 text-xs text-emerald-300">
          <p className="font-semibold text-emerald-200">Signed in</p>
          <p className="mt-1 break-all text-emerald-300/90">{claims?.username ?? claims?.email ?? claims?.sub?.slice(0, 8) ?? 'Client'}</p>
          <button
            type="button"
            onClick={() => { logout(); window.location.hash = '#/portal/login'; handleNavClick() }}
            className="mt-3 rounded-lg border border-emerald-500/30 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
          >
            Sign out
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Hamburger button - all screen sizes */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation"
        className="fixed left-4 top-4 z-50 rounded-lg border border-zinc-600/40 bg-zinc-800/60 p-2 text-zinc-300 transition hover:border-zinc-500/50 hover:bg-zinc-700/60"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg>
      </button>

      {/* Drawer overlay - all screen sizes */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer popout - all screen sizes */}
      <aside className={`fixed left-0 top-0 z-40 h-screen w-64 transform rounded-r-2xl border border-r border-zinc-500/30 bg-zinc-900/95 p-4 shadow-xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="mb-4 pt-12">
          {navContent}
        </div>
      </aside>
    </>
  )
}

export const SideNav = SideNavComponent
