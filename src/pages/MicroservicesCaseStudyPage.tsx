import { useState } from 'react'
import { CodeBlock } from '../features/consulting/CodeBlock'
import { PageLayout } from '../features/layout/PageLayout'

type Proof = {
  label: string
  detail: string
  file: string
  code: string
  language?: string
}

const PROOF: Proof[] = [
  {
    label: '9 independent service domains in one Rust workspace',
    detail: 'Each domain has its own Cargo package, handlers, migrations, tests, and Dockerfile. The repo intentionally keeps boundaries explicit to make later extraction straightforward.',
    file: 'Cargo.toml / */Cargo.toml',
    code: `[workspace]
members = [
  "accounts-service",
  "contacts-service",
  "activities-service",
  "automation-service",
  "integrations-service",
  "opportunities-service",
  "reporting-service",
  "search-service",
]

# per service
# accounts-service/Cargo.toml
# contacts-service/Cargo.toml
# ...`,
    language: 'toml',
  },
  {
    label: 'Service-level ownership and boundaries',
    detail: 'Each service exposes only its own API surface with local state, routes, and handlers. Example below from contacts-service.',
    file: 'contacts-service/src/lib/router.rs',
    code: `pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/ready", get(health))
        .route("/api/v1/contacts", get(list_contacts).post(create_contact))
        .route(
            "/api/v1/contacts/{id}",
            get(get_contact).patch(update_contact).delete(delete_contact),
        )
        .with_state(state)
}`,
    language: 'rust',
  },
  {
    label: 'Dual data strategy (PostgreSQL + SQLite)',
    detail: 'Production-style domains use PostgreSQL, while selected services use SQLite where it is sufficient. CI tests both patterns with service-specific DB setup.',
    file: '.github/workflows/rust.yml + migrations/*',
    code: `services:
  postgres:
    image: postgres:16

# Postgres-backed test DBs
psql -c "CREATE DATABASE accounts_test;"
psql -c "CREATE DATABASE contacts_test;"
psql -c "CREATE DATABASE activities_test;"

# SQLite-backed compile-time DBs for sqlx macro checks
sqlite3 /tmp/workflows.db   < automation-service/migrations/0001_create_workflows.sql
sqlite3 /tmp/reports.db     < reporting-service/migrations/0001_create_reports.sql
sqlite3 /tmp/documents.db   < search-service/migrations/0001_create_search_documents.sql`,
    language: 'yaml',
  },
  {
    label: 'Automated migration compatibility fix (Postgres vs SQLite)',
    detail: 'One debugging cycle required replacing SQLite-specific strftime defaults for Postgres-backed services and making migration casts idempotent.',
    file: 'activities-service/migrations/0001_create_activities.sql',
    code: `-- before (SQLite-specific)
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))

-- after (Postgres-compatible UTC text)
created_at TEXT NOT NULL DEFAULT (
  to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
)

-- boolean column normalized for cross-env behavior
completed BOOLEAN NOT NULL DEFAULT false`,
    language: 'sql',
  },
  {
    label: 'CI/CD matrix deploy for all services',
    detail: 'All services build, lint, and test in CI, then build/push container images and deploy to Cloud Run in parallel on every push to main.',
    file: '.github/workflows/rust.yml',
    code: `jobs:
  test:
    steps:
      # sqlx compile-time macros need a live schema at build time
      - name: Create test databases
        run: |
          sqlite3 /tmp/activities.db    < activities-service/migrations/0001_create_activities.sql
          sqlite3 /tmp/opportunities.db < opportunities-service/migrations/0001_create_opportunities.sql
          # ... one per sqlx-macro service

      - name: Clippy — sqlx-macro services
        run: |
          DATABASE_URL=sqlite:////tmp/activities.db cargo clippy -p activities-service -- -D warnings
          DATABASE_URL=sqlite:////tmp/opportunities.db cargo clippy -p opportunities-service -- -D warnings

      - name: Clippy — runtime-query services
        run: cargo clippy -p accounts-service -p contacts-service -- -D warnings

  deploy:
    needs: [test]
    if: github.ref == 'refs/heads/main'
    strategy:
      fail-fast: false        # one service failing does not cancel the others
      matrix:
        include:
          - { service: accounts-service,   dockerfile: accounts-service/Dockerfile }
          - { service: contacts-service,   dockerfile: contacts-service/Dockerfile }
          - { service: activities-service, dockerfile: activities-service/Dockerfile }
          # ... 5 more services in parallel
    steps:
      - name: Build + deploy
        run: |
          docker build -f \${{ matrix.dockerfile }} -t "$IMAGE" .
          docker push "$IMAGE"
          gcloud run deploy \${{ matrix.service }} --image "$IMAGE" --region us-south1 --platform managed --quiet`,
    language: 'yaml',
  },
  {
    label: 'Cloud Run + Secret Manager runtime config',
    detail: 'Services are deployed to Cloud Run and receive runtime env/secrets (DATABASE_URL, AUTH_JWT_SECRET, ALLOWED_ORIGINS) from managed infrastructure.',
    file: 'terraform/cloud_run.tf',
    code: `containers {
  image = "\${local.registry_base}/\${each.key}:latest"

  env {
    name = "DATABASE_URL"
    value_source {
      secret_key_ref {
        secret  = google_secret_manager_secret.database_urls[each.value.db_key].secret_id
        version = "latest"
      }
    }
  }

  env {
    name = "AUTH_JWT_SECRET"
    value_source {
      secret_key_ref {
        secret  = google_secret_manager_secret.jwt_secret.secret_id
        version = "latest"
      }
    }
  }
}`,
    language: 'hcl',
  },
  {
    label: 'Cross-service token validation',
    detail: "contacts-service validates that account_id exists in accounts-service before creating a contact, forwarding the caller's Bearer token. Fails open when ACCOUNTS_SERVICE_URL is unset so local dev works without all services running.",
    file: 'contacts-service/src/lib/handlers/contacts.rs',
    code: `async fn account_exists(
    client: &reqwest::Client,
    account_id: &str,
    auth_header: &str,
) -> bool {
    let base_url = match env::var("ACCOUNTS_SERVICE_URL") {
        Ok(url) => url,
        Err(_)  => return true,   // fail-open: no upstream configured in local dev
    };

    let url = format!(
        "{}/api/v1/accounts/{}",
        base_url.trim_end_matches('/'),
        account_id,
    );

    match client
        .get(&url)
        .header("Authorization", auth_header)   // forward the caller's token
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success(),
        Err(_)   => false,
    }
}`,
  },
]

export function MicroservicesCaseStudyPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const toggle = (idx: number) => setOpenIdx(openIdx === idx ? null : idx)

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Microservices Platform — 9 Services, Solo-Built</h1>
            <p className="mt-1 text-sm text-amber-300/80">Cloud architecture · Rust · Python · React · Google Cloud Run · GitHub Actions</p>
          </div>
          <div className="flex gap-2">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              ← Case studies
            </a>
            <a
              href="#/contact"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
            >
              Contact
            </a>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Scale</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">9 services</p>
          </div>
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Stack</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">Rust + Python + React</p>
          </div>
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Deploy</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">Cloud Run + Terraform</p>
          </div>
        </div>
      </section>

      {/* Narrative */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">The challenge</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          Build and operate a production-grade multi-service platform as a solo engineer while maintaining rapid iteration velocity.
          The system needed clear domain boundaries, reliable CI, secure secrets handling, and repeatable cloud deployment.
        </p>

        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-zinc-400">Key goals</h3>
        <ul className="mt-2 space-y-2 text-sm text-zinc-300">
          <li>• Isolate business capabilities into independently testable services.</li>
          <li>• Keep local dev friction low without compromising production safety.</li>
          <li>• Standardize build, lint, test, and deploy across all services.</li>
          <li>• Make infra declarative and auditable through Terraform + Secret Manager.</li>
        </ul>
      </section>

      {/* Proof accordion */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">Evidence (Real Code, Not Slides)</h2>
        <p className="mt-1 text-xs text-zinc-400">Click each item to expand the implementation proof.</p>

        <div className="mt-4 space-y-3">
          {PROOF.map((item, idx) => {
            const open = openIdx === idx
            return (
              <div key={item.label} className="rounded-xl border border-zinc-700/50 bg-zinc-800/45">
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{item.label}</p>
                    <p className="mt-1 text-xs text-zinc-400">{item.file}</p>
                  </div>
                  <span className="text-zinc-500">{open ? '−' : '+'}</span>
                </button>

                {open && (
                  <div className="border-t border-zinc-700/40 p-4">
                    <p className="mb-3 text-sm leading-relaxed text-zinc-300">{item.detail}</p>
                    <CodeBlock code={item.code} language={item.language} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Reflection */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">What this demonstrates</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Systems Thinking</h3>
            <p className="mt-1 text-sm text-zinc-300">
              Architectural decisions connect code, CI, infrastructure, and runtime operations into one coherent platform.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Execution Under Constraints</h3>
            <p className="mt-1 text-sm text-zinc-300">
              Solo implementation required pragmatic defaults, fast incident response, and tight feedback loops across services.
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
