import { useTheme } from './ThemeContext'

const NAV_ITEMS = [
  { label: 'Home', href: '#/' },
  { label: 'About', href: '#/about' },
  { label: 'Services', href: '#/services' },
  { label: 'Case Studies', href: '#/case-studies' },
  { label: 'Pricing', href: '#/pricing' },
  { label: 'Patch Notes', href: '#/patch-notes' },
  { label: 'Contact', href: '#/contact' },
]

function SideNavComponent() {
  const hash = window.location.hash
  const { theme, toggle } = useTheme()

  const isActive = (href: string) => {
    if (href === '#/') return hash === '' || hash === '#/' || hash === '#'
    return hash === href || hash.startsWith(href + '/')
  }

  return (
    <aside className="fixed left-5 top-6 z-40 hidden w-56 rounded-2xl border border-zinc-500/30 bg-zinc-900/75 p-4 shadow-xl shadow-black/40 backdrop-blur-xl lg:block">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-bold tracking-tight text-amber-300">RMCC</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-md border border-zinc-600/40 bg-zinc-800/60 px-1.5 py-0.5 text-xs text-zinc-300 transition hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`block rounded-lg border px-3 py-2 text-xs font-medium leading-5 transition ${
              isActive(item.href)
                ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-100'
                : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="mt-4 border-t border-zinc-700/40 pt-4">
        <a
          href="#/crm/admin"
          className={`block rounded-lg border px-3 py-2 text-xs font-medium leading-5 transition ${
            isActive('#/crm/admin')
              ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-100'
              : 'border-zinc-700/30 bg-zinc-800/30 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:border-zinc-600/50 hover:text-zinc-400'
          }`}
        >
          Admin →
        </a>
      </div>
    </aside>
  )
}

export const SideNav = SideNavComponent
