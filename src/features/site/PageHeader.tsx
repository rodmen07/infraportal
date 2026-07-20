// ---------------------------------------------------------------------------
// PageHeader (v1.18.2 PR2, D7): the one page-header pattern the funnel pages
// share, replacing the bespoke hero <section> each of them hand-rolled with a
// slightly different shape. Built on the v1.18.1 semantic tokens so it is
// first-class in both themes without leaning on the [data-theme="light"]
// override sheet.
//
// Structure only: every string a page passes in is its own existing copy
// (page copy is v1.18.3's scope, not this PR).
// ---------------------------------------------------------------------------
interface StatTile {
  value: string
  label: string
}

interface PageHeaderProps {
  kicker?: string
  title: string
  subtitle?: React.ReactNode
  stats?: StatTile[]
  actions?: React.ReactNode
  aside?: React.ReactNode
}

export function PageHeader({ kicker, title, subtitle, stats, actions, aside }: PageHeaderProps) {
  return (
    <header className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          {kicker && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">{kicker}</p>
          )}
          <h1 className={`text-2xl font-bold text-text-primary sm:text-3xl ${kicker ? 'mt-2' : ''}`}>{title}</h1>
          {subtitle && (
            <div className="mt-3 text-sm leading-relaxed text-text-secondary">{subtitle}</div>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center sm:w-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="surface-card rounded-xl px-3 py-2">
                <div className="text-base font-bold text-text-primary">{stat.value}</div>
                <div className="text-[11px] text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {aside}
      </div>

      {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
