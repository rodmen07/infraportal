import { useState } from 'react'
import { PageLayout } from './PageLayout'

const TECH_STACK = ['Rust', 'Axum', 'Python', 'FastAPI', 'React 19', 'Vite', 'Tailwind', 'SQLite', 'Fly.io', 'GitHub Actions', 'Docker']

const HIGHLIGHTS: { label: string; detail: string; file: string; code: string }[] = [
  {
    label: 'Zero shared runtime state',
    detail: 'Each service has its own Axum Router, AppState, and SQLite connection pool. No shared memory, no shared database — services communicate only via HTTP with Bearer token forwarding.',
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
    label: 'GitHub Actions CI/CD',
    detail: 'All 8 services build, lint (clippy -D warnings), and test in CI, then deploy to Fly.io in parallel on every push to main. Services using sqlx compile-time macros get a temp SQLite DB seeded from migrations.',
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
          - { service: accounts-service,   fly_config: accounts-service/fly.toml }
          - { service: contacts-service,   fly_config: contacts-service/fly.toml }
          - { service: activities-service, fly_config: activities-service/fly.toml }
          # ... 5 more services in parallel
    steps:
      - name: Deploy
        run: flyctl deploy -c \${{ matrix.fly_config }} --remote-only
        env:
          FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}`,
  },
  {
    label: 'Fly.io persistent SQLite volumes',
    detail: 'Each service mounts a named Fly.io volume at /data and points SQLite there. sqlx::migrate! runs pending migrations automatically at startup — no manual schema setup after deploy.',
    file: 'accounts-service/fly.toml + src/lib/app_state.rs',
    code: `# fly.toml — named volume mounted into the container
[mounts]
  source      = "accounts_data"   # fly volume create accounts_data --region lhr
  destination = "/data"

[env]
  DATABASE_URL = "sqlite:///data/accounts.db"

# app_state.rs — pool init + auto-migration at startup
pub async fn from_database_url(database_url: &str) -> Result<Self, sqlx::Error> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;  // runs pending migrations

    Ok(Self { pool })
}`,
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
            <p className="mt-1 text-sm text-amber-300/80">Cloud architecture · Rust · Python · React · Fly.io · GitHub Actions</p>
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
          Python/FastAPI AI orchestrator, and a React 19 frontend — all independently deployed on
          Fly.io with persistent SQLite volumes, JWT auth across services, and a complete GitHub
          Actions CI/CD pipeline.
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

      {/* Expandable highlights */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Architecture highlights</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Click any item to see the implementation</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {HIGHLIGHTS.map(({ label, detail, file, code }, idx) => (
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
              {openIdx === idx && (
                <div className="space-y-3 px-5 pb-5 pt-1">
                  <p className="pl-4 text-sm leading-relaxed text-zinc-400">{detail}</p>
                  <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950">
                    <div className="border-b border-zinc-800/60 px-4 py-2">
                      <span className="text-[11px] text-zinc-500">{file}</span>
                    </div>
                    <pre className="overflow-x-auto p-4 text-[11.5px] leading-relaxed text-zinc-300">
                      <code>{code}</code>
                    </pre>
                  </div>
                </div>
              )}
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
