const FACTS = [
  { label: 'Current role', value: 'Technical Architecture - Senior Analyst | DevSecOps - Cloud Engineer, Cloud Platform Team.' },
  { label: 'Primary focus', value: 'Production-ready infrastructure that scales up/down automatically. Auto-scaling, cost optimization, zero-downtime deploys, and audit-ready compliance.' },
  { label: 'Recent achievement', value: 'Shipped an Autonomous Document Processing platform leveraging GCP\'s AI services. Built end-to-end: platform architecture, DevOps workflows, and CI/CD pipelines.' },
  { label: 'Core expertise', value: 'Platform engineering, cloud infrastructure, DevSecOps. Terraform IaC, Kubernetes, GCP/AWS, CI/CD, secrets management, least-privilege IAM, structured logging.' },
  { label: 'Build profile', value: 'Full-stack delivery across backend, cloud infrastructure, and platform automation: TypeScript/Node.js, Rust, Python/Go. Hands-on from architecture to production.' },
  { label: 'Prior domain', value: '5+ years in regulated environments (Finance, FinTech, government programs). Security and audit-readiness baked into delivery.' },
  { label: 'Built in public', value: '9-service microservices platform, Rust/Bevy game, and production Terraform modules — all on GitHub.' },
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
