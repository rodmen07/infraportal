import { useState } from 'react'

type IntegrationStatus = 'live' | 'in-development' | 'coming-soon'

interface Integration {
  name: string
  slug: string
  description: string
  status: IntegrationStatus
  category: string
}

interface TechBadge {
  name: string
  category: string
}

const INTEGRATIONS: Integration[] = [
  {
    name: 'Task API',
    slug: 'task-api-service',
    description: 'Core task persistence, JWT auth, AI orchestration proxy, and admin metrics.',
    status: 'live',
    category: 'Core',
  },
  {
    name: 'AI Orchestrator',
    slug: 'ai-orchestrator-service',
    description: 'Claude-powered goal planning with iterative refinement and feedback loops.',
    status: 'live',
    category: 'AI',
  },
  {
    name: 'Accounts',
    slug: 'accounts-service',
    description: 'User profiles, preferences, and cross-service identity management.',
    status: 'in-development',
    category: 'Identity',
  },
  {
    name: 'Contacts',
    slug: 'contacts-service',
    description: 'CRM contact records linked directly to tasks and goals.',
    status: 'in-development',
    category: 'CRM',
  },
  {
    name: 'Opportunities',
    slug: 'opportunities-service',
    description: 'Sales pipeline stages with task-level execution tracking.',
    status: 'coming-soon',
    category: 'CRM',
  },
  {
    name: 'Activities',
    slug: 'activities-service',
    description: 'Real-time activity timeline across all connected services.',
    status: 'coming-soon',
    category: 'Core',
  },
  {
    name: 'Automation',
    slug: 'automation-service',
    description: 'Event-driven rules to create or update tasks from external triggers.',
    status: 'coming-soon',
    category: 'Automation',
  },
  {
    name: 'Reporting',
    slug: 'reporting-service',
    description: 'SQLite-backed Rust/Axum service with saved reports and a dashboard summary endpoint aggregating active report counts and distinct metrics.',
    status: 'in-development',
    category: 'Analytics',
  },
  {
    name: 'Search',
    slug: 'search-service',
    description: 'Full-text search across tasks, goals, contacts, and opportunities.',
    status: 'coming-soon',
    category: 'Core',
  },
  {
    name: 'Integrations',
    slug: 'integrations-service',
    description: 'Third-party connectors for GitHub, Slack, Jira, and more.',
    status: 'coming-soon',
    category: 'Connectors',
  },
]

const TECH_STACK: TechBadge[] = [
  { name: 'AWS', category: 'Cloud' },
  { name: 'GCP', category: 'Cloud' },
  { name: 'Cloud Run', category: 'Cloud' },
  { name: 'Terraform', category: 'IaC' },
  { name: 'Pulumi', category: 'IaC' },
  { name: 'Docker', category: 'Containers' },
  { name: 'Kubernetes', category: 'Containers' },
  { name: 'GitHub Actions', category: 'CI/CD' },
  { name: 'Rust', category: 'Languages' },
  { name: 'Python', category: 'Languages' },
  { name: 'React', category: 'Languages' },
  { name: 'PostgreSQL', category: 'Data' },
  { name: 'SQLite', category: 'Data' },
  { name: 'Prometheus', category: 'Observability' },
  { name: 'Grafana', category: 'Observability' },
]

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  live: 'Live',
  'in-development': 'In Development',
  'coming-soon': 'Coming Soon',
}

const STATUS_CLASS: Record<IntegrationStatus, string> = {
  live: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  'in-development': 'border-amber-400/40 bg-amber-500/10 text-amber-300',
  'coming-soon': 'border-zinc-600/40 bg-zinc-700/30 text-zinc-500',
}

const CATEGORY_CLASS: Record<string, string> = {
  Core: 'text-blue-400/70',
  AI: 'text-purple-400/70',
  Identity: 'text-teal-400/70',
  CRM: 'text-orange-400/70',
  Automation: 'text-rose-400/70',
  Analytics: 'text-amber-400/70',
  Connectors: 'text-zinc-400/70',
  Cloud: 'text-blue-400/70',
  IaC: 'text-purple-400/70',
  Containers: 'text-teal-400/70',
  'CI/CD': 'text-orange-400/70',
  Languages: 'text-amber-400/70',
  Data: 'text-emerald-400/70',
  Observability: 'text-rose-400/70',
}

type FilterStatus = IntegrationStatus | 'all'

export function IntegrationsSection() {
  const [activeStatus, setActiveStatus] = useState<FilterStatus>('all')

  const statusFilters: FilterStatus[] = ['all', 'live', 'in-development', 'coming-soon']
  const filtered = activeStatus === 'all' ? INTEGRATIONS : INTEGRATIONS.filter((i) => i.status === activeStatus)
  const categories = [...new Set(TECH_STACK.map((t) => t.category))]

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Integrations status board</h2>
            <p className="mt-1 text-sm text-zinc-400">
              TaskForge is built on a microservice architecture. Each service extends the platform.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              In Development
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              Coming Soon
            </span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {statusFilters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveStatus(s)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                activeStatus === s
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                  : 'border-zinc-700/40 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600/50 hover:text-zinc-300'
              }`}
            >
              {s === 'all' ? `All (${INTEGRATIONS.length})` : STATUS_LABEL[s as IntegrationStatus]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((integration) => (
            <div
              key={integration.slug}
              className={`rounded-xl border border-zinc-700/40 bg-zinc-800/50 p-4 transition hover:border-zinc-600/50 ${
                integration.status === 'coming-soon' ? 'opacity-60' : ''
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug text-white">{integration.name}</span>
                  <span className={`text-[11px] font-medium ${CATEGORY_CLASS[integration.category] ?? 'text-zinc-500'}`}>
                    {integration.category}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASS[integration.status]}`}
                >
                  {STATUS_LABEL[integration.status]}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">{integration.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-700/40 pt-6">
        <h3 className="mb-1 text-lg font-semibold text-white">Tech stack</h3>
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
      </div>
    </section>
  )
}
