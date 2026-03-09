interface TechBadge {
  name: string
  category: string
}

const TECH_STACK: TechBadge[] = [
  { name: 'AWS',            category: 'Cloud' },
  { name: 'GCP',            category: 'Cloud' },
  { name: 'Cloud Run',      category: 'Cloud' },
  { name: 'Terraform',      category: 'IaC' },
  { name: 'Pulumi',         category: 'IaC' },
  { name: 'Docker',         category: 'Containers' },
  { name: 'Kubernetes',     category: 'Containers' },
  { name: 'GitHub Actions', category: 'CI/CD' },
  { name: 'Rust',           category: 'Languages' },
  { name: 'Python',         category: 'Languages' },
  { name: 'React',          category: 'Languages' },
  { name: 'PostgreSQL',     category: 'Data' },
  { name: 'SQLite',         category: 'Data' },
  { name: 'Prometheus',     category: 'Observability' },
  { name: 'Grafana',        category: 'Observability' },
]

const CATEGORY_CLASS: Record<string, string> = {
  Cloud:         'text-blue-400/70',
  IaC:           'text-purple-400/70',
  Containers:    'text-teal-400/70',
  'CI/CD':       'text-orange-400/70',
  Languages:     'text-amber-400/70',
  Data:          'text-emerald-400/70',
  Observability: 'text-rose-400/70',
}

const categories = [...new Set(TECH_STACK.map((t) => t.category))]

export function IntegrationsSection() {
  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-1 text-xl font-semibold text-white">Tech stack</h2>
      <p className="mb-5 text-sm text-zinc-400">Open-source first. Vendor-agnostic where it counts.</p>

      <div className="flex flex-col gap-4">
        {categories.map((cat) => (
          <div key={cat} className="flex flex-wrap items-center gap-2">
            <span className={`w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide ${CATEGORY_CLASS[cat] ?? 'text-zinc-500'}`}>
              {cat}
            </span>
            {TECH_STACK.filter((t) => t.category === cat).map((tech) => (
              <span
                key={tech.name}
                className="rounded-md border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-200"
              >
                {tech.name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
