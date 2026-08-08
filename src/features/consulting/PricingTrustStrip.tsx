// v1.26.2 (ROADMAP.md D-24): migrated off the third theming mechanism, the
// sibling half of the same change in PricingFaq.tsx - see that file's header
// for why a per-component `useTheme()` colour branch is neither of the app's
// other two mechanisms. `labelClass` here was a ternary whose two arms were
// byte-identical (`text-text-subtle` either way), a branch that had never done
// anything (THEME-JS-NOOP-TERNARY-1).
//
// One deliberate NON-change, so the migration stays behaviour-preserving: the
// divider colour utility below sits on the flex CONTAINER while `divide-y` /
// `sm:divide-x` put their border-width on the CHILDREN, and border-color is not
// an inherited CSS property - so that class has never coloured a divider in
// either theme (DIVIDE-COLOR-INERT-1, filed rather than fixed, with the
// characterisation test in pricingThemeParity.test.ts pinning the current
// behaviour). It is carried across as `border-border-soft` so it stays exactly
// as inert as it was, instead of being silently turned into a visual change by
// a migration whose whole claim is that nothing renders differently.
//
// Guarded by pricingThemeParity.test.ts.

interface TrustStat {
  value: string
  label: string
}

const STATS: TrustStat[] = [
  { value: '16', label: 'services shipped' },
  { value: 'GCP + AWS', label: 'multi-cloud' },
  { value: 'SOC 2', label: 'compliance-ready' },
  { value: '< 1 day', label: 'response time' },
  { value: '1k+', label: 'crate downloads' },
  { value: '3+ years', label: 'DevOps expertise' },
  { value: 'Free', label: 'discovery call' },
]

export function PricingTrustStrip() {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface-1 px-6 py-4">
      <div className="flex flex-wrap items-center justify-around gap-4 divide-y sm:divide-y-0 sm:divide-x border-border-soft">
        {STATS.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center px-4 text-center">
            <span className="text-lg leading-tight text-text-primary font-bold">{value}</span>
            <span className="mt-0.5 text-xs uppercase tracking-wide text-text-subtle">{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
