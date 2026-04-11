import { PageLayout } from './PageLayout'

type Severity = 'high' | 'medium-high' | 'medium' | 'low-medium'
type CompletionState = 'planned' | 'implemented' | 'published'

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
  status?: 'upcoming'
  completionState: CompletionState
  group?: string
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

const COMPLETION_STYLES: Record<CompletionState, { badge: string; label: string }> = {
  planned:     { badge: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',    label: 'Planned' },
  implemented: { badge: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',    label: 'Implemented' },
  published:   { badge: 'bg-green-500/15 text-green-300 ring-green-500/30', label: 'Published' },
}

// Groups for section headers
const GROUP_META: Record<string, { label: string; status: string }> = {
  'v1.1': { label: 'Developer Experience & AI Research', status: 'Complete' },
  'v1.0': { label: 'Client Portal',              status: 'Complete' },
  'v0.5': { label: 'Platform Completeness',       status: 'Complete' },
  'v0.4': { label: 'Language Breadth & AI Depth', status: 'Complete' },
}

const VERSIONS: Version[] = [
  {
    tag: 'v1.1',
    date: '2026-04-09',
    label: 'CI/CD Pipeline & DevEx',
    completionState: 'published',
    group: 'v1.1',
    summary:
      'Two-stage CI runner image pipeline shipped across the full workspace. A custom Docker runner image is built and pushed to Artifact Registry, then reused for all test/lint/audit jobs — eliminating per-job toolchain install time. Workspace test script hardened with submodule auto-init, cross-platform venv, and 100KB log cap. GCP provisioning script gains a NONINTERACTIVE=1 mode for headless CI use. Frontend receives motion override toggle, animation replay, dynamic hero tagline, gradient pulse badge, and slide-over panel.',
    highlights: [
      {
        heading: 'CI/CD pipeline',
        items: [
          'build-runner-image.yml: builds a project-specific Docker image with Rust, Go, Python, and all toolchain deps pre-installed; pushes to Artifact Registry via OIDC.',
          'run-tests-with-runner-image.yml: pulls the runner image and runs all workspace tests in a single container — cargo test, pytest, go test — with log artifacts collected per project.',
          'run_workspace_tests.sh: auto-inits submodules on first run, creates cross-platform Python venv, caps test log output at 100KB per project to prevent artifact bloat.',
          'gcp-setup.sh gains NONINTERACTIVE=1 mode for use in headless CI environments without TTY prompts.',
          'Docs added: docs/ci-test-summary.md (latest run summary + artifact pointers), docs/gcp-setup.md (Cloud Run + IAM + OIDC reference).',
        ],
      },
      {
        heading: 'Frontend UX',
        items: [
          'Motion override toggle: lets users pause all CSS animations site-wide; state persists across navigation.',
          'Animation replay: replay button re-triggers entrance animations on demand without a page reload.',
          'Dynamic hero tagline: cycles through tagline variants on a configurable interval.',
          'Gradient pulse badge + slide-over panel: new visual components added to the marketing home page.',
        ],
      },
    ],
  },
  {
    tag: 'v1.1.1',
    date: '2026-04-10',
    label: 'Gemini API Integration',
    completionState: 'published',
    group: 'v1.1',
    summary:
      'The AI orchestrator service now supports Google Gemini (gemini-2.0-flash) alongside Anthropic Claude. New /consult/gemini and /consult/gemini/stream endpoints mirror the existing Claude endpoints exactly. The portfolio site adds a Claude / Gemini model toggle — locked once a conversation starts — letting visitors compare responses from both providers.',
    highlights: [
      {
        heading: 'ai-orchestrator-service',
        items: [
          'app/gemini_client.py: async Gemini client wrapping google-generativeai; supports multi-turn chat history via start_chat(history=[...]). Same CONSULT_SYSTEM_PROMPT used for both providers.',
          'POST /consult/gemini: non-streaming Gemini consulting endpoint. Returns 503 if GOOGLE_API_KEY is absent.',
          'POST /consult/gemini/stream: streaming SSE endpoint — identical token/DONE/error envelope as the Claude stream, enabling drop-in frontend swap.',
          'requirements.txt: google-generativeai>=0.8.0 added.',
        ],
      },
      {
        heading: 'Frontend',
        items: [
          'Claude / Gemini pill toggle added to the Ask AI section — locked once a conversation starts to prevent mid-conversation provider switches.',
          'Stream endpoint selected based on active model; all existing SSE parsing logic reused unchanged.',
        ],
      },
    ],
  },
  {
    tag: 'v1.0',
    date: '2026-03-29',
    label: 'Client Portal',
    completionState: 'published',
    group: 'v1.0',
    summary:
      'Full client portal shipped: GitHub + Google OAuth flows issue client-role JWTs, a dedicated portal view shows projects with milestone timelines and per-milestone deliverables, and an admin provisioning UI lets admins create projects and assign them to specific users. All 11 backend services migrated from Fly.io to GCP Cloud Run with keyless CI/CD via GitHub Actions OIDC + Workload Identity Federation.',
    highlights: [
      {
        heading: 'Client portal & OAuth',
        items: [
          'GitHub and Google OAuth sign-in flows integrated via auth-service — successful login issues a client-role JWT.',
          'Client portal page: project overview, milestone timeline, and deliverable list per milestone scoped to the authenticated client.',
          'Admin provisioning UI: create projects with inline milestone and deliverable builders; assign each project to a specific client user (OAuth subject ID).',
          'Role-based JWT access — admin and client roles enforced across all portal endpoints.',
        ],
      },
      {
        heading: 'projects-service (Rust/Axum)',
        items: [
          '8 REST endpoints covering projects CRUD, milestone CRUD, and deliverable CRUD with client-scoped access.',
          'SQLite persistence on /tmp with ?mode=rwc — no persistent volume required.',
          'Deployed to GCP Cloud Run (us-central1) via GitHub Actions CI.',
        ],
      },
      {
        heading: 'GCP Cloud Run migration',
        items: [
          '11 services migrated from Fly.io to Cloud Run (scale-to-zero, us-central1): all 9 CRM microservices, auth-service, and go-gateway.',
          'GitHub Actions OIDC + Workload Identity Federation — zero long-lived credentials stored in GitHub secrets.',
          'Artifact Registry for Docker images; GCP Secret Manager for all sensitive env vars (JWT secret, OAuth client credentials).',
          'go-gateway dynamically resolves upstream Cloud Run service URLs at deploy time via gcloud run services describe.',
          'Fly.io fully decommissioned: 11 apps destroyed. Scale-to-zero brings portfolio hosting from ~$30/month to ~$2–5/month.',
        ],
      },
    ],
  },
  {
    tag: 'v0.5.2',
    date: '2026-03-19',
    label: 'search-service Production Upgrade',
    completionState: 'published',
    group: 'v0.5',
    summary:
      'Search-service production upgrade completed: cross-domain search across accounts, contacts, opportunities, and activities is now live. Search page now fully functional on the frontend.',
    highlights: [
      {
        heading: 'Planned scope',
        items: [
          'GET /api/v1/search?q= — fan out to accounts, contacts, opportunities, activities services in parallel, merge and rank results.',
          'Returns SearchResult[] with id, entity_type, entity_id, title, snippet.',
          'Deploy to Fly.io and set VITE_SEARCH_API_BASE_URL in GitHub Actions secrets.',
        ],
      },
    ],
  },
  {
    tag: 'v0.5.1',
    date: '2026-03-19',
    label: 'reporting-service Production Upgrade',
    completionState: 'published',
    group: 'v0.5',
    summary:
      'Reporting-service production upgrade completed: SQLite persistence, JWT auth, saved report CRUD, and healthy /dashboard summary endpoint. Reports page now fully operational on the frontend.',
    highlights: [
      {
        heading: 'Planned scope',
        items: [
          'Follow standard stub-upgrade checklist: SQLite migration, AppState, JWT auth, CRUD handlers for /api/v1/reports.',
          'Add GET /api/v1/reports/dashboard returning { active_reports, core_metrics }.',
          'Deploy to Fly.io and set VITE_REPORTING_API_BASE_URL in GitHub Actions secrets.',
        ],
      },
    ],
  },
  {
    tag: 'v0.4.4',
    date: '2026-03-19',
    label: 'Frontend UI Expansion',
    completionState: 'published',
    group: 'v0.4',
    summary:
      'Full CRM admin UI shipped: create/edit/delete modals for contacts, leads, accounts, opportunities, and activities; a live SSE feed tab; and three new admin pages — Search, Reports, and Observaboard. The frontend now surfaces the full breadth of the deployed backend platform.',
    highlights: [
      {
        heading: 'CRM admin CRUD',
        items: [
          'CrmAdminPage rebuilt with 6 scrollable tabs: Leads, Contacts, Accounts, Opportunities, Activities, and Live Feed.',
          'Full create / edit / delete modal flow for all five entity types — shared ModalMode<T> union type, api<T>() helper with Authorization header injection, and inline error display.',
          'ContactsTab reused for both Leads (lifecycle_stage=lead filter) and full Contacts view — no duplication.',
          'Activities tab includes completed checkbox on edit and status badge rendering.',
          'Accounts and Opportunities tabs with inline industry/stage badge coloring.',
        ],
      },
      {
        heading: 'Live Feed tab',
        items: [
          'EventSource SSE connection to event-stream-service with status indicator: no-url / connecting / connected / error.',
          'Ring buffer replay on connect — last 50 events shown immediately, then live updates stream in.',
          'Each event card shows source, type, timestamp, and a collapsible raw payload.',
          'ALLOWED_ORIGINS=https://rodmen07.github.io set on event-stream-service — cross-origin SSE works from GitHub Pages.',
        ],
      },
      {
        heading: 'New pages: Search, Reports, Observaboard',
        items: [
          'SearchPage (#/search): debounced cross-domain search with results grouped by entity type (account / contact / opportunity / activity) and color-coded badges.',
          'ReportsPage (#/crm/reports): saved report CRUD table, create/edit/delete modals, and a dashboard summary card showing active report count and core metrics.',
          'ObservaboardPage (#/observaboard): paginated Django REST API event log with source, category, severity, and full-text search filters; expandable raw payload rows; previous / next pagination.',
          'All three pages share the admin auth gate (VITE_ADMIN_KEY + sessionStorage) and show a clear "not configured" message when the backing service URL is absent.',
        ],
      },
      {
        heading: 'Infrastructure',
        items: [
          'Five new env vars: VITE_ACTIVITIES_API_BASE_URL, VITE_EVENT_STREAM_URL, VITE_SEARCH_API_BASE_URL, VITE_REPORTING_API_BASE_URL, VITE_OBSERVABOARD_URL — all documented in .env.example.',
          'TopNav and SideNav updated with Search, Reports, and Observaboard navigation links.',
          'Hash routes added to main.tsx: #/search, #/crm/reports, #/observaboard.',
        ],
      },
    ],
  },
  {
    tag: 'v0.4.3',
    date: '2026-03-17',
    label: 'Go Service',
    completionState: 'published',
    group: 'v0.4',
    summary:
      'event-stream-service: a standalone Go SSE hub that fans events out to connected clients in real time. The third backend language in the portfolio — alongside Rust and Python — demonstrating that architecture decisions are language-agnostic.',
    highlights: [
      {
        heading: 'event-stream-service (Go)',
        items: [
          'Server-Sent Events hub: clients subscribe via GET /events/stream and receive a replay of the last 50 events followed by a live feed — zero polling, zero WebSocket overhead.',
          'Goroutine-based fan-out: each publish acquires a write lock, appends to a fixed ring buffer, then releases the lock before non-blocking channel sends to all subscribers. Slow clients are dropped rather than blocked.',
          'JWT-authenticated publishing: POST /events/publish validates the same HS256 Bearer token used across all services — AUTH_JWT_SECRET is the single shared secret.',
          'Go stdlib net/http only — no router framework. Pattern-matched method+path routes (GET /health, POST /events/publish, GET /events/stream) using Go 1.22+ mux syntax.',
          'Two external dependencies: golang-jwt/jwt/v5 for token validation, google/uuid for event IDs. Everything else is standard library.',
          'Multi-stage Docker build: golang:1.24-alpine builder → alpine:3.21 runtime, CGO disabled, producing a ~10 MB image. Deployed to Fly.io.',
        ],
      },
      {
        heading: 'Endpoints',
        items: [
          'GET /health — returns { "status": "ok", "connected_clients": N }.',
          'POST /events/publish — JWT auth required. Body: { source, type, payload? }. Returns 202 with assigned event ID.',
          'GET /events/stream — SSE stream. Replays ring buffer on connect, then streams live events as id/event/data frames.',
        ],
      },
    ],
  },
  {
    tag: 'v0.4.2',
    date: '2026-03-17',
    label: 'Django REST API',
    completionState: 'published',
    group: 'v0.4',
    summary:
      'observaboard: a standalone Python/Django REST framework service for webhook event ingestion and classification, deployed to Fly.io. Demonstrates Django as a production-grade backend alongside Rust and FastAPI — the language most data and enterprise clients already run.',
    highlights: [
      {
        heading: 'Django REST API',
        items: [
          'Django 5 + Django REST Framework: Event model with UUID primary key, category/severity classification, and PostgreSQL full-text search via SearchVectorField + GIN index.',
          'Celery async worker classifies ingested events into deployment / security / alert / metric / info categories with low–critical severity — no external API calls.',
          'Dual auth: custom Api-Key header authentication for webhook ingest sources, JWT (SimpleJWT) for API consumers.',
          'Django Admin with severity-badge rendering and masked API key display for operational management.',
          'Zero-downtime deploys via Fly.io release_command — migrations run before traffic switches over.',
        ],
      },
      {
        heading: 'Endpoints',
        items: [
          'POST /api/ingest/ — accepts webhook payload, creates Event, enqueues classification task. Returns 202 Accepted.',
          'GET /api/events/ — paginated list with filters: source, category, severity, event_type, classified.',
          'GET /api/events/search/?q= — PostgreSQL full-text search ranked by relevance.',
          'GET/POST /api/keys/ · PATCH/DELETE /api/keys/{id}/ — API key lifecycle management (admin only).',
        ],
      },
    ],
  },
  {
    tag: 'v0.4.1',
    date: '2026-03-17',
    label: 'AI Consulting Feature',
    completionState: 'published',
    group: 'v0.4',
    summary:
      'Full AI consulting feature shipped: multi-turn conversation, streaming responses, starter prompts, markdown rendering, lead capture into contacts-service, and topic classification logged to DynamoDB.',
    highlights: [
      {
        heading: 'AI consulting',
        items: [
          'Multi-turn conversation — full message history sent on each follow-up; up to 4 exchanges per session.',
          'Streaming responses — tokens render as they arrive via SSE, eliminating the loading wait entirely.',
          'Starter prompts — four pre-built scenario chips guide visitors toward actual service offerings.',
          'Markdown rendering — inline bold, italic, code, and bullet lists with no external dependency.',
          'Lead capture — email form after conversation posts directly to contacts-service as a CRM lead.',
          'Topic classification — prompt categories logged to DynamoDB for analytics.',
        ],
      },
    ],
  },
  {
    tag: 'v0.3',
    date: '2026-03-16',
    label: 'Observability & Operations',
    completionState: 'published',
    summary:
      'Platform visibility, AI feature accountability, and structural correctness. The DynamoDB dashboard became a real operations tool. AI prompt/response logging closed the loop on the consulting feature. A silent startup crash in two services — caused by a Postgres pool connected to SQLite volumes — was diagnosed and fixed root-cause rather than patched.',
    highlights: [
      {
        heading: 'DynamoDB dashboard',
        items: [
          'AI Logs page (admin-only): every visitor prompt and AI response logged to DynamoDB via fire-and-forget from the orchestrator. Token counts, model, and duration tracked per interaction.',
          'Open PRs section in CI/CD status (admin-only): live open pull requests across all repos via GitHub API.',
          'AWS Spend caching: Cost Explorer results cached in DynamoDB with a 24-hour TTL, reducing API charges from per-page-load to once per day.',
          'go-pipeline-monitor removed from build status: repo does not exist as a standalone GitHub repo — was causing a permanent UNKNOWN badge.',
        ],
      },
      {
        heading: 'AI consulting feature',
        items: [
          'Prompt and response logging added to ai-orchestrator-service: fire-and-forget POST to /ingest after each consult, with model name, token counts, and duration.',
          'Improved loading indicator: spinning icon, bouncing dots, and an elapsed-seconds counter replace the previous subtle pulse.',
        ],
      },
      {
        heading: 'Infrastructure & CI fixes',
        items: [
          'accounts-service and contacts-service: converted from PostgreSQL (PgPool) to SQLite (SqlitePool + create_if_missing). All $N placeholders replaced with ?, ILIKE replaced with LIKE. Root cause: pool type mismatched the deployed volume configuration, causing PoolTimedOut panics on startup.',
          'Dockerfiles updated: libsqlite3-dev at build time, libsqlite3-0 at runtime; redundant touch removed from CMD.',
          'CI pipeline: accounts and contacts moved from Postgres-backed to SQLite-backed test/clippy steps; Postgres service no longer required for those two services.',
          'MedallionDemo added to CaseStudiesPage and Soc2CaseStudyPage; BuildStatusSection added to CicdCaseStudyPage and CaseStudiesPage.',
          'Codebase audit: 66 MB AWS CLI artifact removed, temp files cleaned, unused openrouter_retry.py deleted.',
        ],
      },
    ],
  },
  {
    tag: 'v0.2',
    date: '2026-03-15',
    label: 'Security Hardening',
    completionState: 'published',
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
    completionState: 'published',
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

function CompletionBadge({ state }: { state: CompletionState }) {
  const { badge, label } = COMPLETION_STYLES[state]
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badge}`}>
      {label}
    </span>
  )
}

function GroupHeader({ group }: { group: string }) {
  const meta = GROUP_META[group]
  if (!meta) return null
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="rounded-xl bg-amber-500/10 px-3 py-1 text-base font-bold text-amber-400 ring-1 ring-amber-500/20">
        {group}
      </span>
      <span className="text-sm font-semibold text-zinc-300">{meta.label}</span>
      <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-500/30">
        {meta.status}
      </span>
      <div className="flex-1 border-t border-zinc-700/40" />
    </div>
  )
}

function VersionCard({ version, isLatest }: { version: Version; isLatest: boolean }) {
  const isUpcoming = version.status === 'upcoming'

  return (
    <article className={`forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50 ${isUpcoming ? 'border border-dashed border-zinc-600/50' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-xl px-3 py-1 text-lg font-bold ring-1 ${isUpcoming ? 'bg-zinc-700/30 text-zinc-400 ring-zinc-600/40' : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'}`}>
              {version.tag}
            </span>
            {isUpcoming && (
              <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-500/30">
                Upcoming
              </span>
            )}
            {isLatest && (
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-300 ring-1 ring-green-500/30">
                Latest
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-200">{version.label}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-xs text-zinc-500">{version.date}</p>
            <CompletionBadge state={version.completionState} />
          </div>
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
  const latestCompletedIndex = VERSIONS.findIndex(v => v.status !== 'upcoming')
  const completedCount = VERSIONS.filter(v => v.completionState === 'published').length

  // Build render list: inject a group header before the first card of each group
  const renderItems: Array<
    { type: 'header'; group: string } | { type: 'card'; version: Version; index: number }
  > = []
  let lastGroup: string | undefined = undefined

  VERSIONS.forEach((v, i) => {
    if (v.group && v.group !== lastGroup) {
      renderItems.push({ type: 'header', group: v.group })
      lastGroup = v.group
    } else if (!v.group) {
      lastGroup = undefined
    }
    renderItems.push({ type: 'card', version: v, index: i })
  })

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white">Patch Notes</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Release history for the InfraPortal microservices platform and DynamoDB pipeline prototype.
              Each entry documents what changed, why, and — for security releases — every finding addressed.
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-3 gap-2 text-center sm:w-auto">
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">{completedCount}</div>
              <div className="text-[11px] text-zinc-400">Released</div>
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

      {/* Version cards — newest first, with group headers */}
      {renderItems.map((item, i) =>
        item.type === 'header' ? (
          <GroupHeader key={`group-${item.group}-${i}`} group={item.group} />
        ) : (
          <VersionCard
            key={item.version.tag}
            version={item.version}
            isLatest={item.index === latestCompletedIndex}
          />
        )
      )}
    </PageLayout>
  )
}
