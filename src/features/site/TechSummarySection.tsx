import { useState } from 'react'

const DOMAINS = [
  {
    title: 'Software Engineering',
    accent: 'border-blue-400/30 bg-blue-500/5',
    headingColor: 'text-blue-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    points: [
      'Polyglot microservice architecture — Rust/Axum (task API), Python/FastAPI (AI orchestrator), React 19/TypeScript (frontend) as three independently deployable units',
      'Type safety end-to-end: Rust ownership model prevents data races, Pydantic schemas validate orchestrator I/O, TypeScript strict mode across the entire frontend',
      'Async throughout — Tokio multi-thread runtime in Rust, FastAPI async handlers in Python, React concurrent features and derived useMemo state for zero-duplication UI',
      'RESTful API design with PATCH semantics for partial updates and resource-oriented endpoints; request/response contracts defined at service boundaries',
      'Input validated and sanitised at every boundary: length limits, trim/clamp, and type coercion applied server-side before data reaches persistence or LLM layers',
      'Cargo workspace at the microservices root for unified Rust builds, shared dependency resolution, and cross-crate test runs from a single command',
    ],
  },
  {
    title: 'Cloud & Infrastructure',
    accent: 'border-cyan-400/30 bg-cyan-500/5',
    headingColor: 'text-cyan-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </svg>
    ),
    points: [
      'Three independently deployed Fly.io applications, each with its own fly.toml specifying compute resources, health checks, and environment variables',
      'SQLite with a persistent Fly volume for the task API — zero-ops relational persistence without an external database service or connection pool',
      '/health and /ready probe endpoints allow Fly.io to perform rolling zero-downtime releases and restart unhealthy instances automatically',
      'All sensitive values (ANTHROPIC_API_KEY, JWT secrets) stored as Fly secrets — injected at runtime, never written to config files or source control',
      'Service-level network isolation: the AI orchestrator is only reachable from the task API, not exposed directly to the public internet',
    ],
  },
  {
    title: 'Security',
    accent: 'border-amber-400/30 bg-amber-500/5',
    headingColor: 'text-amber-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    points: [
      'Stateless JWT authentication with role claims — tokens verified on every request using jsonwebtoken (Rust); admin vs. user routes enforced via role guards in middleware',
      'Full request audit log records subject, method, path, status code, duration_ms, and user agent for every API call — enabling forensic review without external tooling',
      'CORS policy configured via tower-http on the Rust API; origin allowlist prevents arbitrary cross-site requests in production',
      'SQL injection prevented by sqlx parameterised queries throughout — no raw string interpolation of user data into SQL statements',
      'LLM prompt content sanitised server-side before forwarding: feedback strings trimmed and clamped to 500 characters, goal strings capped at 500 characters',
      'Anthropic API key never logged, never returned in API responses, and not present in any committed configuration file',
    ],
  },
  {
    title: 'DevOps',
    accent: 'border-emerald-400/30 bg-emerald-500/5',
    headingColor: 'text-emerald-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    points: [
      'Database schema managed by sqlx migrate — migrations run on startup, are idempotent, and tracked in a migrations table so they never apply twice',
      'Health (/health) and readiness (/ready) endpoints serve as platform liveness and readiness probes, decoupling deployment lifecycle from application boot time',
      'Structured request logging captures duration and status on every route, giving operational visibility without a dedicated APM agent',
      'Admin metrics endpoint exposes live task counts, unique active users, and total API request volume for lightweight operational monitoring',
      'Fly.io rolling deploy strategy prevents downtime during updates — new instances receive traffic only after passing readiness checks',
      'Three-repo Git structure keeps service histories independent; each service can be tagged, released, and rolled back without affecting the others',
    ],
  },
  {
    title: 'Frontend Engineering',
    accent: 'border-purple-400/30 bg-purple-500/5',
    headingColor: 'text-purple-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    points: [
      'React 19 with TypeScript strict mode and Vite — fast HMR in development, tree-shaken production bundles with no unused code',
      'Zero-dependency hash router implemented in ~15 lines: intercepts window.location.hash changes to render sub-pages without server configuration or react-router-dom',
      'CMS-driven content architecture — FAQ, Highlights, Changelog, and Roadmap are JSON files fetched at runtime, editable without a code deploy',
      'Derived state via useMemo rather than duplicated server state: story points, pending count, and goal progress computed from the single authoritative tasks array',
      'Tailwind CSS v3 utility-first styling with a consistent design token set (zinc/amber/emerald palette) applied across all components without a separate CSS file',
      'Scroll-spy sidebar navigation tracks the active section via IntersectionObserver, updating the nav indicator without layout thrash or scroll event polling',
    ],
  },
  {
    title: 'Backend Engineering',
    accent: 'border-orange-400/30 bg-orange-500/5',
    headingColor: 'text-orange-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
      </svg>
    ),
    points: [
      'Three production Rust/Axum services (task API, accounts, contacts) share a consistent module layout — app_state, auth, models, router, handlers — making each service independently navigable and deployable without shared framework magic',
      'sqlx with SQLite: compile-time query validation prevents malformed SQL at build time, FromRow derive gives zero-boilerplate result mapping, and sqlx::migrate! runs pending migrations automatically on startup',
      'UUID v4 string primary keys across all services — portable, opaque, and URL-safe without leaking row-order or internal counters to API consumers',
      'Tower middleware stack (CorsLayer, TraceLayer) composed at the router level; auth validation runs per-handler rather than as global middleware, giving precise per-endpoint control over required JWT claims',
      "Cross-service HTTP: contacts-service validates account_id existence by calling accounts-service with the caller's forwarded Bearer token — no duplicated auth logic; fails open when ACCOUNTS_SERVICE_URL is unset for local dev",
      'Structured { code, message, details } error envelope on every failure path — no raw status-only responses — so the frontend can surface specific error messages without guessing at HTTP status semantics',
      'Paginated list endpoints with optional server-side filters (status, lifecycle_stage, full-text name/email search) reduce over-fetching; PATCH semantics allow partial field updates without requiring a full resource replacement',
    ],
  },
]

const STACK: { label: string; color: string }[] = [
  { label: 'Rust',        color: 'border-orange-400/40 text-orange-300 bg-orange-500/10' },
  { label: 'Axum',        color: 'border-orange-400/30 text-orange-200 bg-orange-500/5' },
  { label: 'SQLite',      color: 'border-blue-400/40 text-blue-300 bg-blue-500/10' },
  { label: 'sqlx',        color: 'border-blue-400/30 text-blue-200 bg-blue-500/5' },
  { label: 'Python',      color: 'border-yellow-400/40 text-yellow-300 bg-yellow-500/10' },
  { label: 'FastAPI',     color: 'border-teal-400/40 text-teal-300 bg-teal-500/10' },
  { label: 'Anthropic',   color: 'border-purple-400/40 text-purple-300 bg-purple-500/10' },
  { label: 'React 19',    color: 'border-cyan-400/40 text-cyan-300 bg-cyan-500/10' },
  { label: 'TypeScript',  color: 'border-blue-400/40 text-blue-200 bg-blue-500/10' },
  { label: 'Tailwind v3', color: 'border-sky-400/40 text-sky-300 bg-sky-500/10' },
  { label: 'Vite',        color: 'border-violet-400/40 text-violet-300 bg-violet-500/10' },
  { label: 'Fly.io',      color: 'border-indigo-400/40 text-indigo-300 bg-indigo-500/10' },
  { label: 'JWT',         color: 'border-amber-400/40 text-amber-300 bg-amber-500/10' },
  { label: 'Tokio',       color: 'border-rose-400/40 text-rose-300 bg-rose-500/10' },
]

export function TechSummarySection() {
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set())

  function toggleDomain(title: string) {
    setOpenDomains((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-white">Technical summary</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
          TaskForge is a full-stack, cloud-native portfolio project spanning three production microservices.
          It demonstrates applied software engineering across backend systems, security, AI integration, DevOps practices, and frontend architecture.
        </p>
      </div>

      {/* Stack chips */}
      <div className="mb-6 mt-4 flex flex-wrap gap-1.5">
        {STACK.map((chip) => (
          <span
            key={chip.label}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium ${chip.color}`}
          >
            {chip.label}
          </span>
        ))}
      </div>

      {/* Domain cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {DOMAINS.map((domain) => {
          const isOpen = openDomains.has(domain.title)
          return (
            <div
              key={domain.title}
              className={`rounded-2xl border ${domain.accent}`}
            >
              <button
                type="button"
                onClick={() => toggleDomain(domain.title)}
                className={`flex w-full items-center justify-between gap-2 p-5 ${domain.headingColor}`}
              >
                <span className="flex items-center gap-2">
                  {domain.icon}
                  <span className="text-sm font-bold">{domain.title}</span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 shrink-0 opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isOpen && (
                <ul className="space-y-2 px-5 pb-5">
                  {domain.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-300">
                      <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${domain.headingColor.replace('text-', 'bg-')}`} />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
