// v1.26.2 (ROADMAP.md D-24): migrated off the third theming mechanism, the
// sibling half of the same change in PricingFaq.tsx - see that file's header
// for why a per-component `useTheme()` colour branch is neither of the app's
// other two mechanisms. `labelClass` here was a ternary whose two arms were
// byte-identical (`text-text-subtle` either way), a branch that had never done
// anything (THEME-JS-NOOP-TERNARY-1).
//
// DIVIDE-COLOR-INERT-1 (fixed): `divide-y` / `sm:divide-x` put their
// border-WIDTH on the CHILDREN, and border-color is not an inherited CSS
// property - so the border-colour utility this container used to carry never
// coloured a divider, and the children painted Tailwind's preflight default
// (gray-200) in BOTH themes: bright hairlines on a dark card. The colour now
// rides `divide-border-soft`, the spelling DataTable.tsx and ActivityFeed.tsx
// already use, so the dividers follow `--border-soft` per theme like every
// other hairline here. (v1.26.2 deliberately carried the inert form across
// unchanged because that migration's whole claim was that nothing renders
// differently; this fix is the separate increment it called for.)
//
// Guarded by pricingThemeParity.test.ts: a rendering assertion on this
// container plus a repo-wide sweep that fails any class-string literal
// setting a divide width without a divide colour.

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
      <div className="flex flex-wrap items-center justify-around gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border-soft">
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
