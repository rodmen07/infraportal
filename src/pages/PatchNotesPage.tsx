import { PageLayout } from './PageLayout'

type Severity = 'high' | 'medium-high' | 'medium' | 'low-medium'

interface Finding {
  id: string
  title: string
  severity: Severity
  category: string
  resolution: string
}

interface Version {
  tag: string
  date: string
  label: string
  summary: string
  highlights: { heading: string; items: string[] }[]
  findings?: Finding[]
  positive?: string[]
}

const SEVERITY_STYLES: Record<Severity, string> = {
  'high':        'bg-red-500/15 text-red-300 border-red-500/30',
  'medium-high': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'medium':      'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  'low-medium':  'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
}

const VERSIONS: Version[] = [
  {
    tag: 'v0.2',
    date: '2026-03-15',
    label: 'Security Hardening',
    summary:
      'Addressed all nine findings from the 2026-03-15 security audit. No new features — this release is a hardening pass across both the Rust microservices platform and the DynamoDB prototype.',
    highlights: [
      {
        heading: 'Authentication',
        items: [
          'JWT secret fallback removed — all 8 services now panic at startup if AUTH_JWT_SECRET is unset rather than silently accepting tokens signed with a public default key.',
          'Dashboard dev-mode bypass removed — DASHBOARD_ADMIN_KEY is now required; the open-access fallback is gone.',
          'GitHub Actions AWS authentication migrated from long-lived access keys to OIDC role assumption (configure-aws-credentials@v4). Static key secrets deleted.',
        ],
      },
      {
        heading: 'Network & Ingress',
        items: [
          'CORS permissive fallback eliminated — Pattern A services (accounts, contacts) no longer emit allow_headers(Any) when ALLOWED_ORIGINS is unset. Pattern B services (remaining 6) no longer accept ALLOWED_ORIGINS=* without a hard failure.',
          'Cloud SQL authorized_networks 0.0.0.0/0 block removed; database is no longer publicly reachable from the internet.',
          'AI orchestrator and internal Cloud Run services switched to INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER with service-account-scoped IAM instead of allUsers.',
        ],
      },
      {
        heading: 'Container & Supply Chain',
        items: [
          'All 8 service Dockerfiles: builder stage pinned from rust:latest to rust:1.85-bookworm to prevent silent toolchain drift.',
          'All 8 runtime images: non-root appuser added and USER directive set — services no longer run as UID 0.',
          'terraform/.gitignore updated to block future commits of terraform.tfstate, terraform.tfstate.backup, terraform.tfvars, and tfplan.',
        ],
      },
      {
        heading: 'CI / Audit',
        items: [
          'rust.yml test steps now inject AUTH_JWT_SECRET so integration tests pass against the hardened expect() call without reverting the security fix.',
          'audit.toml suppressed advisory (RUSTSEC-2023-0071) annotated with rationale and a revisit note for when the rsa crate ships a fix.',
        ],
      },
    ],
    findings: [
      { id: 'F-01', title: 'Terraform state/tfvars with secrets committed', severity: 'high',        category: 'A02 / A07', resolution: '.gitignore updated; history remediation documented' },
      { id: 'F-02', title: 'Cloud SQL open to 0.0.0.0/0',                   severity: 'high',        category: 'A05',       resolution: 'authorized_networks block removed' },
      { id: 'F-03', title: 'All Cloud Run services fully public',            severity: 'high',        category: 'A01',       resolution: 'Internal services restricted to internal LB ingress + SA IAM' },
      { id: 'F-04', title: 'Hardcoded JWT secret fallback in all 8 services',severity: 'high',        category: 'A02 / A07', resolution: 'expect() replaces unwrap_or_else in all auth.rs files' },
      { id: 'F-05', title: 'Permissive CORS fallback across 8 router.rs',    severity: 'medium-high', category: 'A05',       resolution: 'Permissive paths removed; ALLOWED_ORIGINS required' },
      { id: 'F-06', title: 'Dashboard endpoints unauthenticated',             severity: 'medium-high', category: 'A01',       resolution: 'require_admin() added to all routes; dev bypass removed' },
      { id: 'F-07', title: 'Deploy workflow uses long-lived AWS keys',        severity: 'medium',      category: 'A07',       resolution: 'Migrated to OIDC; static secrets deleted' },
      { id: 'F-08', title: 'Containers run as root with unpinned base image', severity: 'medium',      category: 'A05',       resolution: 'appuser + USER directive added; rust:1.85-bookworm pinned' },
      { id: 'F-09', title: 'RUSTSEC-2023-0071 suppressed without rationale',  severity: 'low-medium',  category: 'A02',       resolution: 'Annotated with acceptance rationale and revisit trigger' },
    ],
  },
  {
    tag: 'v0.1',
    date: '2026-03-07',
    label: 'Platform Baseline',
    summary:
      'Initial production deployment of the full portfolio platform. Eight Rust/Axum microservices deployed to Google Cloud Run, a Python/FastAPI AI orchestrator, and a DynamoDB medallion pipeline prototype — all with CI/CD, JWT auth, and database persistence.',
    highlights: [
      {
        heading: 'Microservices platform (8 services)',
        items: [
          'accounts-service, contacts-service, activities-service, automation-service, integrations-service, opportunities-service, reporting-service, search-service — all deployed to GCP Cloud Run.',
          'Rust/Axum 0.8, SQLite via sqlx with compile-time query validation, JWT Bearer authentication on all protected endpoints.',
          'Shared auth module (HS256/RS256 configurable) identical across all services; structured ApiError envelope; per-service database with UUID primary keys.',
          'CORS configurable via ALLOWED_ORIGINS env var; TraceLayer for structured request logging.',
        ],
      },
      {
        heading: 'AI orchestrator',
        items: [
          'Python/FastAPI service calling Anthropic Claude API for task planning and natural language processing.',
          'Deployed to Cloud Run (ai-orchestrator-service-rodmen07); internal-only by design.',
        ],
      },
      {
        heading: 'DynamoDB prototype',
        items: [
          'Rust-based medallion pipeline: bronze → silver → gold ingestion layers backed by DynamoDB.',
          'Axum dashboard with spend tracking, build status, and infrastructure metrics endpoints.',
          'GitHub Actions deploy workflow with SAM/ECR; OIDC setup documented (migration pending at v0.1).',
        ],
      },
      {
        heading: 'Infrastructure',
        items: [
          'Terraform-managed GCP infrastructure: Cloud Run, Cloud SQL (Postgres), Artifact Registry, Secret Manager, VPC.',
          'GitHub Actions CI/CD: lint (clippy -D warnings), integration tests (SQLite in-memory + Postgres service), cargo audit, parallel Cloud Run deploys on main.',
          'Frontend deployed to GitHub Pages (React 19 + Vite + Tailwind v3).',
        ],
      },
    ],
    positive: [
      'All domain API endpoints required a valid Bearer JWT — consistent enforce across all 8 services.',
      'JWT validation enforced expiry, issuer, and scheme — no partial validation.',
      'SQL injection not possible — all queries use sqlx parameterized binds.',
      'Secrets injected via GCP Secret Manager references in Terraform.',
      'cargo audit ran on every push to main.',
      'HTTPS enforced on all endpoints (Cloud Run TLS + Fly.io force_https).',
      'One database user per service (least-privilege at DB layer).',
    ],
  },
]

function SeverityBadge({ severity }: { severity: Severity }) {
  const label: Record<Severity, string> = {
    'high':        'HIGH',
    'medium-high': 'MED-HIGH',
    'medium':      'MED',
    'low-medium':  'LOW-MED',
  }
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${SEVERITY_STYLES[severity]}`}>
      {label[severity]}
    </span>
  )
}

function VersionCard({ version, index }: { version: Version; index: number }) {
  const isLatest = index === 0

  return (
    <article className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-amber-500/15 px-3 py-1 text-lg font-bold text-amber-300 ring-1 ring-amber-500/30">
              {version.tag}
            </span>
            {isLatest && (
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-300 ring-1 ring-green-500/30">
                Latest
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-200">{version.label}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{version.date}</p>
        </div>
        <a
          href={`https://github.com/rodmen07/portfolio/releases/tag/${version.tag}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-neutral px-3 py-1.5 text-xs"
        >
          GitHub release ↗
        </a>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-zinc-300">{version.summary}</p>

      {/* Change highlights */}
      <div className="mt-6 space-y-5">
        {version.highlights.map((group) => (
          <div key={group.heading}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              {group.heading}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Findings table (v0.2 only) */}
      {version.findings && (
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400/70">
            Findings Addressed
          </h3>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Finding</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">OWASP</th>
                  <th className="px-3 py-2 font-medium">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {version.findings.map((f, i) => (
                  <tr
                    key={f.id}
                    className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-zinc-400">{f.id}</td>
                    <td className="px-3 py-2 text-zinc-200">{f.title}</td>
                    <td className="px-3 py-2"><SeverityBadge severity={f.severity} /></td>
                    <td className="px-3 py-2 text-zinc-400">{f.category}</td>
                    <td className="px-3 py-2 text-zinc-300">{f.resolution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Positive controls (v0.1 only) */}
      {version.positive && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-green-400/70">
            Security Controls Already in Place
          </h3>
          <ul className="space-y-1.5">
            {version.positive.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-300">
                <span className="mt-1 text-green-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

export function PatchNotesPage() {
  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white">Patch Notes</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Release history for the TaskForge microservices platform and DynamoDB pipeline prototype.
              Each entry documents what changed, why, and — for security releases — every finding addressed.
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-3 gap-2 text-center sm:w-auto">
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">2</div>
              <div className="text-[11px] text-zinc-400">Releases</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">9</div>
              <div className="text-[11px] text-zinc-400">Findings</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">0</div>
              <div className="text-[11px] text-zinc-400">Open</div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="https://github.com/rodmen07/portfolio/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent px-4 py-2 text-sm"
          >
            View on GitHub
          </a>
          <a href="#/case-studies" className="btn-neutral px-4 py-2 text-sm">
            Case studies
          </a>
        </div>
      </section>

      {/* Version cards — newest first */}
      {VERSIONS.map((v, i) => (
        <VersionCard key={v.tag} version={v} index={i} />
      ))}
    </PageLayout>
  )
}
