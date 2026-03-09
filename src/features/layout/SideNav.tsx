const NAV_ITEMS = [
  { label: 'Home', href: '#/' },
  { label: 'Services', href: '#/services' },
  { label: 'Case Studies', href: '#/case-studies' },
  { label: 'Pricing', href: '#/pricing' },
  { label: 'Contact', href: '#/contact' },
]

function SideNavComponent() {
  const hash = window.location.hash

  const isActive = (href: string) => {
    if (href === '#/') return hash === '' || hash === '#/' || hash === '#'
    return hash === href || hash.startsWith(href + '/')
  }

  return (
    <aside className="fixed left-4 top-6 z-40 hidden w-52 rounded-2xl border border-zinc-500/30 bg-zinc-900/75 p-3 shadow-xl shadow-black/40 backdrop-blur-xl lg:block">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold tracking-tight text-amber-300">RMCC</span>
      </div>

      <nav className="space-y-1.5">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`block rounded-lg border px-3 py-2 text-xs font-medium transition ${
              isActive(item.href)
                ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-100'
                : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  )
}

export const SideNav = SideNavComponent
export default SideNavComponent
