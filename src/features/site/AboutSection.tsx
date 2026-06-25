const FACTS = [
  { label: 'Current role', value: 'Software Engineer at Smoothstack, focused on cloud and platform engineering in production environments.' },
  { label: 'Consulting scope', value: 'Cloud/Security consulting exposure supporting government-focused programs for AFS/IRS.' },
  { label: 'Build profile', value: 'Hands-on delivery across frontend, backend, and cloud infrastructure: React/TypeScript, Node.js/Express, Ruby/Rails, and IaC workflows.' },
  { label: 'Prior domain', value: '5 years in Finance/FinTech operations, bringing regulated-environment rigor to startup delivery.' },
  { label: 'Education', value: 'BA in Economics and Mathematics.' },
  { label: 'Solo operator', value: 'No subcontractors, no account managers. You work directly with the engineer doing the work.' },
  { label: 'Built in public', value: '9-service microservices platform and a DynamoDB idempotency prototype — both on GitHub.' },
  { label: 'Location', value: 'San Antonio, TX — available remote worldwide, overlap with US and EU business hours.' },
]

export function AboutSection() {
  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-4 text-base font-semibold text-white">Background & credentials</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {FACTS.map(({ label, value }) => (
          <div key={label} className="about-fact-card rounded-xl border border-zinc-800/60 bg-zinc-800/40 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/70">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
