const NAV_ITEMS = [
  { label: 'Home',         href: '#/' },
  { label: 'Services',     href: '#/services' },
  { label: 'Case Studies', href: '#/case-studies' },
  { label: 'Pricing',      href: '#/pricing' },
  { label: 'Contact',      href: '#/contact' },
]

export function TopNav() {
  const hash = window.location.hash

  const isActive = (href: string) => {
    if (href === '#/') return hash === '' || hash === '#/' || hash === '#'
    return hash === href || hash.startsWith(href + '/')
  }

  return (
    <nav className="sticky top-2 z-40 rounded-2xl border border-zinc-500/30 bg-zinc-900/75 p-3 shadow-xl shadow-black/40 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 shrink-0 text-sm font-bold tracking-tight text-amber-300">RM Cloud</span>
        <div className="h-4 w-px shrink-0 bg-zinc-700" />
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isActive(item.href)
                ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-100'
                : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500/50 hover:bg-zinc-700/60 hover:text-zinc-100'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
      <div className="mt-2.5 h-0.5 overflow-hidden rounded-full bg-zinc-800/90">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400" />
      </div>
    </nav>
  )
}
