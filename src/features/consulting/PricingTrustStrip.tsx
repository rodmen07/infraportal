import { useTheme } from '../layout/useTheme'

interface TrustStat {
  value: string
  label: string
}

const STATS: TrustStat[] = [
  { value: '16', label: 'services shipped' },
  { value: 'GCP + AWS', label: 'multi-cloud' },
  { value: 'SOC 2', label: 'compliance-ready' },
  { value: '< 1 day', label: 'response time' },
  { value: 'Free', label: 'discovery call' },
]

export function PricingTrustStrip() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const containerClass = isLight
    ? 'rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-4'
    : 'rounded-2xl border border-zinc-700/40 bg-zinc-800/30 px-6 py-4'

  const valueClass = isLight ? 'text-zinc-900 font-bold' : 'text-white font-bold'
  const labelClass = isLight ? 'text-zinc-500' : 'text-zinc-500'
  const dividerClass = isLight ? 'border-zinc-200' : 'border-zinc-700/50'

  return (
    <section className={containerClass}>
      <div className={`flex flex-wrap items-center justify-around gap-4 divide-y sm:divide-y-0 sm:divide-x ${dividerClass}`}>
        {STATS.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center px-4 text-center">
            <span className={`text-lg leading-tight ${valueClass}`}>{value}</span>
            <span className={`mt-0.5 text-xs uppercase tracking-wide ${labelClass}`}>{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
