import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { CodeBlock } from '../features/consulting/CodeBlock'
import { BuildStatusBadges } from '../features/site/BuildStatusBadges'


const TECH_STACK = ['Rust', 'Axum', 'Python', 'FastAPI', 'React 19', 'Vite', 'Tailwind', 'PostgreSQL', 'Terraform', 'Google Cloud Run', 'Cloud SQL', 'Secret Manager', 'Artifact Registry', 'GitHub Actions', 'Docker']

const HIGHLIGHTS: { label: string; detail: string; file: string; code: string; language?: string }[] = [
  {
    label: 'Zero shared runtime state',
    detail: 'Each service has its own Axum Router and AppState with isolated runtime boundaries. No shared memory, and cross-service communication stays HTTP-first with Bearer token forwarding.',
    file: 'accounts-service/src/lib/router.rs',
    code: `// Each service assembles its own Router from its own AppState.
// No shared singletons, no global state.
pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .route("/ready", get(health::health))
        .route(
            "/api/v1/accounts",
            get(accounts::list_accounts).post(accounts::create_account),
        )
        .route(
            "/api/v1/accounts/{id}",
            get(accounts::get_account)
                .patch(accounts::update_account)
                .delete(accounts::delete_account),
        )
        .with_state(state)              // ← each service's own AppState
        .layer(build_cors_layer())
        .layer(TraceLayer::new_for_http())
}`,
  },
  {
    label: 'JWT authentication',
    detail: 'All protected endpoints validate Bearer tokens inline — no auth middleware. The auth module is identical across all services, reading algorithm and secret from env vars. Supports HS256, HS384, HS512, RS256, RS384, RS512.',
    file: 'accounts-service/src/lib/auth.rs + handlers/accounts.rs',
    code: `// auth.rs — validates the Authorization header and returns decoded claims
pub fn validate_authorization_header(header_value: Option<&str>) -> Result<AuthClaims, AuthError> {
    let raw_header = header_value.ok_or(AuthError::MissingHeader)?;
    let token = extract_bearer_token(raw_header)?;

    let algorithm = auth_algorithm();   // reads AUTH_JWT_ALGORITHM env var
    let mut validation = Validation::new(algorithm);
    validation.validate_exp = true;
    validation.set_issuer(&[auth_issuer()]);

    let key = decoding_key(algorithm)?; // HS* → secret, RS* → PEM public key
    decode::<AuthClaims>(token, &key, &validation)
        .map(|data| data.claims)
        .map_err(|_| AuthError::InvalidToken)
}

// handlers/accounts.rs — called at the top of every protected handler
fn require_auth(headers: &HeaderMap) -> Result<(), Response> {
    let header_value = headers.get("Authorization").and_then(|v| v.to_str().ok());
    validate_authorization_header(header_value)
        .map(|_| ())
        .map_err(|err| error_response(StatusCode::UNAUTHORIZED, err.code(), err.message()))
}`,
  },
  {
    label: 'Full CRUD REST APIs',
    detail: 'Every service exposes Create / Read / Update / Delete over HTTP. Handlers validate input, run parameterised SQL with sqlx, and return typed JSON responses with a consistent error envelope.',
    file: 'accounts-service/src/lib/handlers/accounts.rs',
    code: `// POST /api/v1/accounts
pub async fn create_account(
    headers: HeaderMap,
    State(state): State<AppState>,
    Json(body): Json<CreateAccountRequest>,
) -> Response {
    if let Err(resp) = require_auth(&headers) { return resp; }

    let id  = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    match sqlx::query(
        "INSERT INTO accounts (id, name, domain, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(&id).bind(&name).bind(&domain).bind(&status).bind(&now).bind(&now)
    .execute(&state.pool).await
    {
        Ok(_) => (StatusCode::CREATED, Json(Account { id, name, domain, status,
            created_at: now.clone(), updated_at: now })).into_response(),
        Err(e) => { tracing::error!("{e}");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "database error") }
    }
}

// DELETE /api/v1/accounts/{id}
pub async fn delete_account(
    headers: HeaderMap,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Response {
    if let Err(resp) = require_auth(&headers) { return resp; }
    match sqlx::query("DELETE FROM accounts WHERE id = $1")
        .bind(&id).execute(&state.pool).await
    {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_)  => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "account not found"),
        Err(e) => { tracing::error!("{e}");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "database error") }
    }
}`,
  },
  {
    label: 'Fly.io to Google Cloud migration',
    detail: 'Deployment was migrated to a Terraform-managed GCP baseline with Cloud Run services, Cloud SQL Postgres, Artifact Registry images, and Secret Manager runtime config.',
    file: 'terraform/cloud_run.tf + terraform/cloud_sql.tf + terraform/secrets.tf',
    code: `resource "google_cloud_run_v2_service" "rust_services" {
  for_each = local.rust_services

  name     = each.key
  location = var.region

  template {
    service_account = google_service_account.cloud_run.email

    containers {
      # Bootstrap image for first infra rollout; CI later deploys service images.
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest"

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_urls[each.value.db_key].secret_id
            version = "latest"
          }
        }
      }
    }
  }
}`,
    language: 'hcl',
  },
  {
    label: 'GitHub Actions CI/CD',
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
    label: 'Security hardening (post-audit)',
    detail: 'A 9-finding security audit was conducted across the full platform. All HIGH severity findings are fully remediated: JWT fail-fast, CORS enforcement, non-root Docker users, OIDC CI, and Terraform secrets purged from history.',
    file: 'auth.rs + router.rs + Dockerfiles + terraform/',
    code: `// FINDING-04: JWT secret fail-fast — no insecure fallback
let secret = env::var("AUTH_JWT_SECRET")
    .expect("AUTH_JWT_SECRET must be set");

// FINDING-05: CORS — refuse to start without explicit origin list
if origins.is_empty() {
    panic!("ALLOWED_ORIGINS must be set — refusing to start with permissive CORS");
}

// FINDING-08: Non-root Docker user (all 8 service Dockerfiles)
RUN useradd --no-create-home --shell /bin/false appuser
USER appuser

// FINDING-02/03: Terraform — Cloud SQL public IP removed, Cloud Run IAM restricted
// FINDING-01: Terraform provider binaries purged from git history via git filter-repo`,
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
              href="https://github.com/rodmen07"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              GitHub →
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          Designed and built a full microservices platform from scratch: 7 Rust/Axum services, 1
          Python/FastAPI AI orchestrator, and a React 19 frontend — independently deployable with
          JWT auth across services and a complete GitHub Actions CI/CD pipeline targeting Google
          Cloud Run.
        </p>
      </section>

      {/* Tech stack */}
      <div className="flex flex-wrap gap-2">
        {TECH_STACK.map((tech) => (
          <span
            key={tech}
            className="rounded border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-300"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Baseline note */}
      <section className="forge-panel rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 backdrop-blur-xl">
        <h2 className="text-base font-semibold text-emerald-200">Current baseline</h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-100/85">
          Infrastructure migration and deployment are now stable enough to serve as the foundation
          for future product development. Next work can prioritize UX depth and feature quality on
          top of this Cloud Run + Terraform base, instead of reworking platform fundamentals.
        </p>
      </section>

      <BuildStatusBadges repos={['microservices', 'backend-service', 'frontend-service', 'auth-service', 'ai-orchestrator-service', 'dynamodb_prototype']} />

      {/* Expandable highlights */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Architecture highlights</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Click any item to see the implementation</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {HIGHLIGHTS.map(({ label, detail, file, code, language }, idx) => (
            <div key={label}>
              <button
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-zinc-800/30"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 text-amber-400">›</span>
                  <span className="font-medium text-zinc-200">{label}</span>
                </span>
                <span className="shrink-0 text-[10px] text-zinc-500">
                  {openIdx === idx ? '▲' : '▼'}
                </span>
              </button>
              <div className={`grid transition-all duration-200 ease-out ${openIdx === idx ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-3 px-5 pb-5 pt-1">
                    <p className="pl-4 text-sm leading-relaxed text-zinc-400">{detail}</p>
                    <CodeBlock code={code} language={language ?? 'rust'} file={file} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security audit summary */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Security audit — 9 findings</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Conducted 2026-03-15 · All HIGH findings fully remediated</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {([
            ['FINDING-01', 'HIGH',    '✅', 'Terraform secrets / provider binaries purged from git history'],
            ['FINDING-02', 'HIGH',    '✅', 'Cloud SQL public IP (0.0.0.0/0) removed; private network configured'],
            ['FINDING-03', 'HIGH',    '✅', 'Cloud Run ingress restricted; ai-orchestrator no longer public'],
            ['FINDING-04', 'HIGH',    '✅', 'JWT secret hardcoded fallback replaced with expect() across all 8 services'],
            ['FINDING-05', 'MED-HIGH','✅', 'CORS permissive fallback replaced with panic! in all 8 services'],
            ['FINDING-06', 'MED-HIGH','✅', 'Dashboard auth bypass removed; all 8 endpoints gated behind require_admin'],
            ['FINDING-07', 'MED',     '✅', 'GitHub Actions migrated from static AWS keys to OIDC role assumption'],
            ['FINDING-08', 'MED',     '✅', 'All 8 Dockerfiles pinned to rust:1.85-bookworm with non-root appuser'],
            ['FINDING-09', 'LOW-MED', '✅', 'RSA timing advisory documented with rationale and revisit trigger'],
          ] as [string, string, string, string][]).map(([id, severity, status, desc]) => (
            <div key={id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <span className="w-24 shrink-0 font-mono text-xs text-zinc-500">{id}</span>
              <span className={`w-20 shrink-0 text-xs font-medium ${severity === 'HIGH' ? 'text-red-400' : severity === 'MED-HIGH' ? 'text-orange-400' : 'text-yellow-400'}`}>{severity}</span>
              <span className="shrink-0 text-base">{status}</span>
              <span className="text-zinc-300">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="text-center">
        <a
          href="#/contact"
          className="inline-block rounded-xl border border-amber-400/40 bg-amber-500/15 px-6 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
        >
          Start your own project →
        </a>
      </div>
    </PageLayout>
  )
}
