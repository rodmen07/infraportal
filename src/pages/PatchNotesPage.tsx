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
  'v1.15': { label: 'Deployment Safety, SLO Monitoring & Distributed State', status: 'Complete' },
  'v1.14': { label: 'Security Depth, Cost Efficiency & E2E Quality', status: 'Complete' },
  'v1.13': { label: 'Production Hardening, IaC Completeness & Observaboard Depth', status: 'Complete' },
  'v1.12': { label: 'IaC Root Module, JWT Auth & CI/CD',       status: 'Complete' },
  'v1.11': { label: 'Multi-Region HA & Event-Driven Batch',   status: 'Complete' },
  'v1.10': { label: 'Gateway Rate Limiting',                  status: 'Complete' },
  'v1.9': { label: 'Distributed Tracing & Observability', status: 'Complete' },
  'v1.8': { label: 'Real-Time Feedback Loop',           status: 'Complete' },
  'v1.7': { label: 'CRM Event Pipeline',               status: 'Complete' },
  'v1.6': { label: 'Observability & Compliance',       status: 'Complete' },
  'v1.5': { label: 'DB Migration & Live Events',      status: 'Complete' },
  'v1.4': { label: 'Cloud Consolidation',             status: 'Complete' },
  'v1.3': { label: 'Autonomous Operations',           status: 'Complete' },
  'v1.2': { label: 'Operational Maturity',            status: 'Complete' },
  'v1.1': { label: 'Developer Experience & AI Research', status: 'Complete' },
  'v1.0': { label: 'Client Portal',                  status: 'Complete' },
  'v0.5': { label: 'Platform Completeness',           status: 'Complete' },
  'v0.4': { label: 'Language Breadth & AI Depth',     status: 'Complete' },
}

const VERSIONS: Version[] = [
  {
    tag: 'v1.15.11',
    date: '2026-06-25',
    label: 'Funnel Build Integrity & Direct Checkout',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Restores the public funnel after a build regression that shipped runtime-fatal undefined references on the homepage, pricing, case studies, and CRM admin pages, adds a TypeScript typecheck gate to CI so the same class of bug cannot reach production again, and introduces an optional direct-checkout path on pricing tiers for paid engagements.',
    highlights: [
      {
        heading: 'Funnel restoration',
        items: [
          'Fixed missing SCHEDULING_URL imports that crashed the homepage, pricing, case studies, and services pages at runtime.',
          'Restored the missing React hooks import in the CRM admin page (lead triage) that broke the entire view.',
          'Fixed a search-page variable-ordering bug, a Skeleton radius type, and a malformed patch-notes entry.',
        ],
      },
      {
        heading: 'Regression guard',
        items: [
          'Added an npm "typecheck" script (tsc --noEmit) and a CI Type Check job, since vite/esbuild strips types without checking and let undefined imports ship to production.',
        ],
      },
      {
        heading: 'Direct checkout',
        items: [
          'Pricing tiers now accept an optional HTTPS checkoutUrl (e.g. a Stripe Payment Link); when set, the CTA opens secure checkout in a new tab and emits a pricing_checkout_click analytics event.',
          'Falls back to the existing lead form when unset, so it stays a graceful no-op until a payment link is configured.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.10',
    date: '2026-05-17',
    label: 'v1.15 Patch Notes, README & Final Commit',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Publishes v1.15 documentation across InfraPortal and Portfolio README, validates go-gateway and Terraform updates, and finalizes the rollout of deployment safety, SLO monitoring, and distributed state capabilities.',
    highlights: [
      {
        heading: 'Documentation and release wrap-up',
        items: [
          'PatchNotesPage updated with v1.15 group metadata and sub-version entries.',
          'Portfolio README updated with v1.15 section and status table.',
          'Go and Terraform validations re-run before finalizing release notes.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.9',
    date: '2026-05-17',
    label: 'Gateway Response Cache for Read Endpoints',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Adds short-TTL in-process LRU response caching for read-heavy gateway routes. Cache keys include path, query, and authenticated subject to keep per-user responses isolated. Cacheable responses emit X-Cache MISS/HIT for visibility.',
    highlights: [
      {
        heading: 'go-gateway middleware',
        items: [
          'New ResponseCache middleware with default TTL 5s and configurable max entries.',
          'Cache applies to GET requests on reporting, search, events, and projects read routes.',
          'Integration test verifies first request MISS, second request HIT, and single upstream call.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.8',
    date: '2026-05-17',
    label: 'Redis-backed Distributed Rate Limiting',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Introduces Redis-backed gateway rate limiting using INCR + EXPIRE fixed windows so limits are shared across all Cloud Run instances. Includes fail-open behavior when Redis is unreachable to avoid gateway-wide outages from transient dependency issues.',
    highlights: [
      {
        heading: 'go-gateway middleware and config',
        items: [
          'New RedisRateLimiter middleware keyed by client IP + route + second.',
          'New config support: REDIS_URL with redis:// parsing and host:port fallback.',
          'Main wiring switches to distributed limiter automatically when REDIS_URL is set.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.7',
    date: '2026-05-17',
    label: 'Memorystore Terraform Module',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Adds a dedicated terraform/memorystore module to provision Redis for gateway distributed state. Module outputs host, port, redis_url, and optionally writes REDIS_URL to Secret Manager for CI/CD consumption.',
    highlights: [
      {
        heading: 'terraform/memorystore',
        items: [
          'Provisioned google_redis_instance with configurable name, tier, memory, and region.',
          'Optional Secret Manager write path for GO_GATEWAY_REDIS_URL.',
          'Wired into terraform/envs/prod with enable_gateway_redis toggle and outputs.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.6',
    date: '2026-05-17',
    label: 'Uptime Checks Per Service',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Adds configurable per-service uptime checks with 60-second cadence and alert policies tied to the shared SLO notification channel. Uptime failures are detected as sustained check_passed drops over a 3-minute window.',
    highlights: [
      {
        heading: 'terraform/slos uptime resources',
        items: [
          'google_monitoring_uptime_check_config resources generated from uptime_checks map.',
          'Per-check alert policy creation when notification email is configured.',
          'Env/prod variables and tfvars examples added for multi-service checks.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.5',
    date: '2026-05-17',
    label: 'Error Budget Burn Rate Alerts',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Adds fast-burn and slow-burn SLO alert policies for go-gateway using monitoring query language based burn-rate selectors. Alerts route to a dedicated email channel when configured in environment variables.',
    highlights: [
      {
        heading: 'terraform/slos burn alerts',
        items: [
          'Fast burn alert policy for short-window error budget consumption.',
          'Slow burn alert policy for sustained degradation detection.',
          'Shared notification channel creation from slo_alert_email.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.4',
    date: '2026-05-17',
    label: 'SLO Terraform Module',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Adds terraform/slos module with custom monitoring service plus availability and latency SLO resources for go-gateway. Goals and latency thresholds are environment-configurable and exported as environment outputs.',
    highlights: [
      {
        heading: 'terraform/slos core resources',
        items: [
          'google_monitoring_custom_service for gateway SLO ownership.',
          'Availability SLO target default 99.9%.',
          'Latency SLO target with default threshold under 2 seconds.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.3',
    date: '2026-05-17',
    label: 'Automated Rollback Composite Action',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Adds reusable GitHub composite action for Cloud Run rollback on canary smoke-test failure. The action restores 100% traffic to the stable revision and writes a rollback summary into job output for operator visibility.',
    highlights: [
      {
        heading: '.github/actions/cloud-run-rollback/action.yml',
        items: [
          'Reusable rollback action parameterized by service, region, stable revision, and failed revision.',
          'Deploy workflow updated to call action instead of inline rollback shell script.',
          'Rollback summary rendered in GitHub job summary panel.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.2',
    date: '2026-05-17',
    label: 'Canary Smoke-test Script',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Adds scripts/smoke-test.sh as deployment gate for canary rollouts. Script validates /health payload and /health/upstreams reachability with retry support, strict failure exits, and deterministic pass/fail behavior for automation.',
    highlights: [
      {
        heading: 'scripts/smoke-test.sh',
        items: [
          'Retries configurable by SMOKE_RETRIES and SMOKE_INTERVAL.',
          'Validates status=ok contract for /health response body.',
          'Accepts /health/upstreams HTTP 200 or HTTP 502 degraded during rollout, rejects gateway-level failures.',
        ],
      },
    ],
  },
  {
    tag: 'v1.15.1',
    date: '2026-05-17',
    label: 'Cloud Run Canary Traffic Splitting',
    completionState: 'published',
    group: 'v1.15',
    summary:
      'Upgrades go-gateway deployment workflow to no-traffic revision deploy, smoke verification, 10/90 canary split, and full promotion to latest on success. On smoke failure, traffic is automatically restored to the prior stable revision.',
    highlights: [
      {
        heading: '.github/workflows/deploy-cloud-run.yml',
        items: [
          'Records stable revision before deployment and captures newly created revision after deploy.',
          'Deploys with --no-traffic, runs smoke checks, then shifts to 10% canary before 100% promotion.',
          'Uses rollback action on smoke failure and includes workflow trigger paths for smoke/action files.',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.12',
    date: '2026-05-16',
    label: 'v1.14 Patch Notes, README & Final Commit',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Documents all 11 preceding v1.14 sub-versions in InfraPortal PatchNotesPage.tsx, updates Portfolio README.md with a v1.14 section, and commits all changed repositories: go-gateway (security headers, scanner block, circuit breaker, retry, /health/upstreams, gen2+concurrency, integration tests), auth-service (refresh token rotation + integration test suite), terraform (Cloud Armor WAF, BigQuery scheduled query, Infracost CI), and infraportal (patch notes).',
    highlights: [
      {
        heading: 'Documentation',
        items: [
          'PatchNotesPage.tsx: GROUP_META entry for v1.14; 12 VERSIONS entries (v1.14.1 through v1.14.12).',
          'README.md: v1.14 section added above v1.13 with all 12 sub-versions marked Published.',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.11',
    date: '2026-05-16',
    label: 'go-gateway Integration Test Suite',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Adds cmd/gateway/gateway_test.go — a package-level integration test suite that builds the full gateway handler (SecurityHeaders, BlockScannerPaths, JWTAuth, circuit breaker, retry transport, CORS, Logger, Traceparent, RequestID) against in-process httptest stub upstreams. Tests cover: health 200, security header presence, scanner path 404, JWT missing-header 401, proxy forwarding, and circuit breaker opening after 3 consecutive 5xx responses. Tests run as part of the existing CI workflow (go test -race -count=1 ./...).',
    highlights: [
      {
        heading: 'cmd/gateway/gateway_test.go (new)',
        items: [
          'stubOK/stub5xx helpers start in-process httptest servers; all cleaned up via t.Cleanup.',
          'makeGateway helper mirrors main() construction: builds mux, wraps with full middleware chain.',
          'TestGateway_HealthEndpoint: GET /health returns 200 + {"status":"ok"}.',
          'TestGateway_SecurityHeadersPresent: X-Content-Type-Options, X-Frame-Options, Referrer-Policy.',
          'TestGateway_ScannerPathsBlocked: /.env, /wp-admin, /phpinfo.php, /.git/config all return 404.',
          'TestGateway_JWTRequired_MissingHeader: protected route returns 401 when Authorization header absent.',
          'TestGateway_ProxyForwardsToUpstream: request forwarded to stub, 200 returned.',
          'TestGateway_CircuitBreakerOpensAfterFailures: 3 × 502 → 4th request returns 503 + Retry-After.',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.10',
    date: '2026-05-16',
    label: 'auth-service Integration Test Suite',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Adds tests/test_integration_flow.py covering the complete authentication lifecycle end-to-end using FastAPI TestClient backed by an isolated per-test SQLite database. Test classes cover registration/login, refresh token rotation (replay detection), access token revocation, logout, and the JWKS endpoint. The isolated DB fixture ensures tests never share state.',
    highlights: [
      {
        heading: 'tests/test_integration_flow.py (new)',
        items: [
          'client fixture: monkeypatches DATABASE_URL, AUTH_JWT_SECRET, AUTH_JWT_ALGORITHM per test using tmp_path.',
          'TestRegisterLogin: 201 with access_token, 409 on duplicate, login returns cookie, wrong password 401, verify active.',
          'TestRefreshTokenRotation: new cookie issued, old token rejected after rotation (replay detection), new token works, missing cookie 401.',
          'TestTokenRevocation: revoke → verify returns active=False; invalid token returns 400.',
          'TestLogout: refresh rejected after logout.',
          'TestJWKSEndpoint: 200 with keys array; HS256 returns empty keys (does not expose HMAC secret).',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.9',
    date: '2026-05-16',
    label: 'Circuit Breaker + Retry Transport',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Adds per-route circuit breaker middleware and an idempotent retry transport to go-gateway. Each route gets its own CircuitBreaker (opens after 5 consecutive 5xx responses, half-open probe after 30 s). GET/HEAD requests are retried up to 2 times on transport errors with 50/100/200 ms exponential backoff. Non-idempotent methods are never retried. The circuit breaker returns 503 + Retry-After: 10 when open.',
    highlights: [
      {
        heading: 'internal/proxy additions',
        items: [
          'circuitbreaker.go: CircuitBreaker{maxFailures, openTimeout}; states CLOSED/OPEN/HALF_OPEN; Allow/RecordSuccess/RecordFailure; WithCircuitBreaker middleware factory.',
          'retry.go: RetryTransport implements http.RoundTripper; retries GET/HEAD on transport errors with exponential backoff (50 ms base); non-idempotent methods never retried.',
          'proxy.go: ReverseProxy now uses RetryTransport{MaxRetries: 2} as its Transport.',
          'main.go: per-route circuit breaker (5 failures, 30 s open timeout) injected into middleware chain innermost.',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.8',
    date: '2026-05-16',
    label: 'Cloud Run Concurrency & gen2 Execution Environment',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Adds --concurrency 80 and --execution-environment gen2 to the go-gateway Cloud Run deploy command. Concurrency 80 limits simultaneous requests per instance for predictable memory usage. gen2 uses the second-generation sandbox (gVisor-less, faster cold starts, full Linux syscall surface — better for Go workloads).',
    highlights: [
      {
        heading: '.github/workflows/deploy-cloud-run.yml',
        items: [
          '--concurrency 80 added: explicit cap on concurrent requests per instance.',
          '--execution-environment gen2 added: second-gen sandbox with faster cold starts and full syscall compatibility for Go.',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.7',
    date: '2026-05-16',
    label: '/health/upstreams Fan-Out Health Endpoint',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Adds GET /health/upstreams to go-gateway. The handler concurrently probes each upstream\'s /health endpoint with a 3-second timeout using goroutines + WaitGroup, sorts results deterministically, and returns an aggregated JSON response. Overall status is "ok" only when all upstreams report 2xx; any failure returns HTTP 502 with status "degraded". The endpoint is exempt from JWT auth (same skip-prefix as /health).',
    highlights: [
      {
        heading: 'internal/health/upstreams.go (new)',
        items: [
          'UpstreamsHandler(upstreams map[string]string): fan-out via goroutines, mutex-protected results slice, deterministic sort.',
          'probeUpstream: GET <baseURL>/health with 3 s context timeout; unreachable/degraded/ok classification.',
          'Returns {"status":"ok"|"degraded","upstreams":[{name,url,status,code}]}.',
          'HTTP 200 on ok, 502 on degraded.',
        ],
      },
      {
        heading: 'cmd/gateway/main.go',
        items: [
          'upstreamURLs map populated from all 12 cfg.*URL fields.',
          'mux.HandleFunc("/health/upstreams", health.UpstreamsHandler(upstreamURLs)).',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.6',
    date: '2026-05-16',
    label: 'BigQuery Daily CRM Aggregates Scheduled Query',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Extends the pubsub-ingest Terraform module with an optional BigQuery Data Transfer scheduled query that runs every 24 hours and produces a daily_crm_summary table. The query aggregates crm_mutations by day, resource_type, and HTTP method for the past 25 hours, writing results with WRITE_TRUNCATE. Controlled by new bq_enable_daily_aggregates variable (default false); also requires bigquery_dataset_id to be set.',
    highlights: [
      {
        heading: 'terraform/pubsub-ingest additions',
        items: [
          'New variable bq_enable_daily_aggregates (default false): enables scheduled query when set with bigquery_dataset_id.',
          'google_bigquery_data_transfer_config.daily_crm_agg: data_source_id = "scheduled_query", schedule = "every 24 hours".',
          'Aggregation query: SELECT day, resource_type, method, COUNT(*) AS event_count FROM crm_mutations WHERE publish_time >= NOW() - 25h GROUP BY 1, 2, 3.',
          'write_disposition = "WRITE_TRUNCATE", destination = daily_crm_summary table.',
          'depends_on google_bigquery_table.crm_mutations to ensure table exists before transfer config.',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.5',
    date: '2026-05-16',
    label: 'Infracost Cost Estimate on Terraform PRs',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Integrates Infracost into the terraform-apply workflow. On pull requests that modify Terraform files, three new steps run after the plan: infracost/actions/setup, infracost breakdown (JSON output), and infracost output (GitHub-comment format). The cost estimate is posted as a PR comment alongside the existing plan output. All three steps are guarded by secrets.INFRACOST_API_KEY != "" so the workflow degrades gracefully in forks or repos without the secret configured.',
    highlights: [
      {
        heading: '.github/workflows/terraform-apply.yml additions',
        items: [
          'Setup Infracost step: uses infracost/actions/setup@v3 with api-key.',
          'Generate Infracost cost estimate: infracost breakdown --path . --format json; infracost output --format github-comment.',
          'Post cost estimate to PR: actions/github-script posts infracost-comment.md as a PR comment.',
          'All three steps guarded: steps.config.outputs.enabled == "true" && github.event_name == "pull_request" && secrets.INFRACOST_API_KEY != "".',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.4',
    date: '2026-05-16',
    label: 'Cloud Armor WAF Security Policy',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Extends the go-gateway-ha Terraform module with an optional Cloud Armor WAF security policy. When enable_cloud_armor = true, a google_compute_security_policy is created with five Google-managed preconfigured rule sets (XSS, SQLi, LFI, RFI, RCE) at priorities 1000-1004, each in deny(403) mode. The default allow rule is at priority 2147483647. The policy is attached to the backend service via security_policy.',
    highlights: [
      {
        heading: 'terraform/go-gateway-ha additions',
        items: [
          'New variable enable_cloud_armor (default false): creates WAF policy when true.',
          'google_compute_security_policy.waf: 5 OWASP CRS deny rules + default allow.',
          'Rules: xss-v33-stable (1000), sqli-v33-stable (1001), lfi-v33-stable (1002), rfi-v33-stable (1003), rce-v33-stable (1004).',
          'google_compute_backend_service.gateway: security_policy = ... waf[0].id when enabled, null otherwise.',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.3',
    date: '2026-05-16',
    label: 'Scanner Path Blocking Middleware',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Adds BlockScannerPaths middleware to go-gateway that silently returns 404 for 20 well-known automated scanner and exploit probe paths (/.env, /.git, /wp-admin, /wp-login.php, /phpmyadmin, /actuator, /console, etc.). Match is case-insensitive prefix, computed at construction time. Wired as the second outermost middleware (immediately inside SecurityHeaders, outside JWTAuth) so scanner traffic is dropped before any authentication or rate-limiting logic runs.',
    highlights: [
      {
        heading: 'internal/middleware/scanner_block.go (new)',
        items: [
          '20 scanner path prefixes lowercased at construction time for zero-cost matching.',
          'Match: exact path equality OR HasPrefix(path, prefix + "/") OR HasPrefix(path, prefix + "?").',
          'Returns http.NotFound (404) immediately; no upstream calls, no JWT checks, no rate-limit tokens consumed.',
        ],
      },
      {
        heading: 'cmd/gateway/main.go',
        items: ['BlockScannerPaths wired between SecurityHeaders and JWTAuth in the outermost handler chain.'],
      },
    ],
  },
  {
    tag: 'v1.14.2',
    date: '2026-05-16',
    label: 'Refresh Token Rotation',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Implements single-use refresh token rotation in auth-service. The /auth/refresh endpoint now revokes the consumed token immediately after validating it, then issues a brand-new refresh token and sets it as an HttpOnly cookie. Any replay of the old token returns 401. Combined with the existing revoked_at column in the refresh_tokens table, this prevents session hijacking via stolen refresh tokens.',
    highlights: [
      {
        heading: 'app/main.py — /auth/refresh',
        items: [
          'After validate_and_get_refresh_token_user succeeds, immediately call revoke_refresh_token(old_token).',
          'Issue new raw refresh token via create_refresh_token(user.id).',
          'Attach new token as HttpOnly cookie via _set_refresh_cookie.',
          'Replayed tokens are rejected by validate_and_get (revoked_at IS NOT NULL).',
        ],
      },
    ],
  },
  {
    tag: 'v1.14.1',
    date: '2026-05-16',
    label: 'Security Response Headers Middleware',
    completionState: 'published',
    group: 'v1.14',
    summary:
      'Adds SecurityHeaders middleware to go-gateway that sets six security-hardening HTTP response headers on every reply: Strict-Transport-Security (2-year max-age, includeSubDomains), X-Content-Type-Options (nosniff), X-Frame-Options (DENY), Referrer-Policy (strict-origin-when-cross-origin), Content-Security-Policy (restrictive default-src), and Permissions-Policy (disables geolocation, microphone, camera, payment). Wired as the outermost middleware so all responses — including 4xx from scanner blocking and 401 from JWT auth — carry the headers.',
    highlights: [
      {
        heading: 'internal/middleware/security_headers.go (new)',
        items: [
          'Strict-Transport-Security: max-age=63072000; includeSubDomains (2-year HSTS preload candidate).',
          'X-Content-Type-Options: nosniff — prevents MIME-type sniffing attacks.',
          'X-Frame-Options: DENY — blocks clickjacking via iframe embedding.',
          'Referrer-Policy: strict-origin-when-cross-origin — limits Referer leakage on cross-origin navigation.',
          'Content-Security-Policy: default-src \'self\'; object-src \'none\'; base-uri \'none\'; frame-ancestors \'none\'.',
          'Permissions-Policy: disables geolocation, microphone, camera, payment browser APIs.',
        ],
      },
      {
        heading: 'cmd/gateway/main.go',
        items: ['SecurityHeaders is outermost handler: SecurityHeaders(BlockScannerPaths(JWTAuth(mux))).'],
      },
    ],
  },
  {
    tag: 'v1.13.9',
    date: '2026-05-18',
    label: 'Ingest Spike Cloud Monitoring Alert',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Adds an optional Cloud Monitoring alert policy to the pubsub-ingest Terraform module that fires when the ingest topic receives more than a configurable number of messages per minute. Controlled by new spike_alert_email and spike_threshold_per_min variables. Uses ALIGN_DELTA over a 60-second window to measure publish count per minute. Alert documentation includes guidance on identifying the spike source and applying rate limits or circuit breakers.',
    highlights: [
      {
        heading: 'terraform/pubsub-ingest additions',
        items: [
          'New variable spike_alert_email (default empty): set to enable spike alert creation.',
          'New variable spike_threshold_per_min (default 1000): alert threshold in messages per 60-second window.',
          'google_monitoring_notification_channel (email) and google_monitoring_alert_policy added; both count = spike_alert_email != "" ? 1 : 0.',
          'Metric: pubsub.googleapis.com/topic/send_message_operation_count with ALIGN_DELTA + REDUCE_SUM.',
          'Alert documentation references go-gateway rate limiting and bulk-import tuning steps.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.8',
    date: '2026-05-18',
    label: 'BigQuery Analytics Sink for Pub/Sub Ingest Topic',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Extends the pubsub-ingest Terraform module with an optional BigQuery subscription that streams all CRM mutation events to a BQ table for long-term analytics. Enabled when bigquery_dataset_id is set. Provisions a dataset, a table with a schema aligned to the Pub/Sub metadata envelope (subscription_name, message_id, publish_time, data, attributes), a BigQuery Data Editor IAM binding for the Pub/Sub service account, and a google_pubsub_subscription with bigquery_config.',
    highlights: [
      {
        heading: 'terraform/pubsub-ingest additions',
        items: [
          'New variable bigquery_dataset_id (default empty): set to enable the BQ sink.',
          'New variable bigquery_table_id (default "crm_mutations"): BQ table name.',
          'google_bigquery_dataset, google_bigquery_table (5-column schema), google_bigquery_dataset_iam_member (roles/bigquery.dataEditor), and google_pubsub_subscription.bigquery_sink all gated on bigquery_dataset_id != "".',
          'write_metadata = true on the bigquery_config block so message ID and publish time are stored alongside the payload.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.7',
    date: '2026-05-18',
    label: 'Dead-Letter Replay Script',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Adds go-gateway/scripts/replay-deadletter.sh: a bash script that pulls messages from the Pub/Sub dead-letter drain subscription and republishes them to the main ingest topic. Requires gcloud CLI and jq. Configurable via PUBSUB_PROJECT, DEAD_LETTER_SUB, INGEST_TOPIC, MAX_MESSAGES, and DRY_RUN environment variables. Runs in a loop until the drain subscription is empty, with per-message base64 decoding and re-publish via gcloud pubsub topics publish.',
    highlights: [
      {
        heading: 'go-gateway/scripts/replay-deadletter.sh',
        items: [
          'Required env: PUBSUB_PROJECT. Optional: DEAD_LETTER_SUB, INGEST_TOPIC, MAX_MESSAGES, DRY_RUN.',
          'Pulls up to MAX_MESSAGES (default 100) per batch with --auto-ack; loops until no messages remain.',
          'DRY_RUN=true acks messages without republishing — useful for discarding known-bad messages.',
          'Uses jq for JSON parsing and base64 --decode for payload decoding; validates both before publish.',
          'set -euo pipefail + dependency checks (gcloud, jq) guard against misconfigured environments.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.6',
    date: '2026-05-18',
    label: 'Deploy Workflow: AUTH_JWT_SECRET from Secret Manager',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Updates the go-gateway Cloud Run deploy workflow to inject AUTH_JWT_SECRET from GCP Secret Manager at deploy time via --set-secrets. Previously only OBSERVABOARD_API_KEY was sourced from Secret Manager; the JWT secret was left unset in production, effectively disabling token validation. With this change the Cloud Run revision mounts the secret as an environment variable, completing the production JWT auth story.',
    highlights: [
      {
        heading: 'go-gateway/.github/workflows/deploy-cloud-run.yml',
        items: [
          'Added AUTH_JWT_SECRET=AUTH_JWT_SECRET:latest to --set-secrets in the gcloud run deploy step.',
          'Secret must be created in GCP Secret Manager with name AUTH_JWT_SECRET before deployment.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.5',
    date: '2026-05-18',
    label: 'Terraform Drift Detection (Scheduled Plan)',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Adds a scheduled GitHub Actions workflow that runs terraform plan -detailed-exitcode against the envs/prod environment every weekday at 06:00 UTC. Exit code 2 indicates drift (live state differs from .tfstate); the workflow automatically opens a GitHub issue with the full plan output and a link to the apply workflow. Requires TF_STATE_BUCKET, GCP_PROJECT_ID, and GCP_WORKLOAD_IDENTITY_PROVIDER; gracefully skips when credentials are not configured.',
    highlights: [
      {
        heading: 'Portfolio/.github/workflows/terraform-drift.yml',
        items: [
          'Triggers on schedule (weekdays 06:00 UTC) and workflow_dispatch.',
          'terraform plan -detailed-exitcode: exit 0 = clean, exit 1 = error, exit 2 = drift.',
          'On drift: opens a GitHub issue with the plan output truncated to 60 kB, labelled "infrastructure" and "drift".',
          'Issue body includes a direct link to the terraform-apply workflow for one-click remediation.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.4',
    date: '2026-05-18',
    label: 'Terraform Apply Workflow for envs/prod',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Adds a GitHub Actions workflow for planning and applying the envs/prod Terraform root module. On pull requests touching terraform/ it runs terraform plan and posts the output as a PR comment. On workflow_dispatch with apply=true it runs terraform apply -auto-approve with GCP Workload Identity Federation authentication. The workflow requires TF_STATE_BUCKET, GCP_PROJECT_ID, and GCP_WORKLOAD_IDENTITY_PROVIDER; it skips gracefully when these are not configured.',
    highlights: [
      {
        heading: 'Portfolio/.github/workflows/terraform-apply.yml',
        items: [
          'Triggers on push/PR touching terraform/ and on workflow_dispatch (with apply input).',
          'Uses hashicorp/setup-terraform v3, GCP WIF auth via google-github-actions/auth@v2.',
          'terraform init with -backend-config=bucket and -backend-config=prefix from secrets/vars.',
          'PR trigger: posts plan output (truncated to 60 kB) as a comment on the PR.',
          'workflow_dispatch with apply=true: runs terraform apply -auto-approve.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.3',
    date: '2026-05-18',
    label: 'slog Structured Logging in go-gateway',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Replaces fmt.Printf and log.Printf/Fatalf in go-gateway with structured slog calls using a JSON handler. Cloud Logging can parse the emitted JSON key/value pairs as structured fields, enabling log-based metrics and alerting. Startup events, route registration, and per-request logs all emit structured JSON to stdout. The slog.NewJSONHandler is set as the default logger at startup so all packages that call the package-level slog functions benefit automatically.',
    highlights: [
      {
        heading: 'cmd/gateway/main.go',
        items: [
          'slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil))) configured at startup.',
          'Route registration: slog.Info("route registered", "prefix", ..., "upstream", ..., "observed", ...).',
          'Startup: slog.Info("go-gateway listening", "addr", ..., "auth_rps", ..., "write_rps", ..., "read_rps", ..., "default_rps", ...).',
          'Fatal error: slog.Error("server error", "error", err) + os.Exit(1) replaces log.Fatalf.',
        ],
      },
      {
        heading: 'internal/middleware/logger.go',
        items: [
          'Request log: slog.Info("request", "method", ..., "path", ..., "status", ..., "duration_ms", ..., "request_id", ...).',
          'Removed fmt import; imported log/slog.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.2',
    date: '2026-05-18',
    label: 'RS256 JWT Support in go-gateway + JWKS Endpoint in auth-service',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Extends the go-gateway JWT middleware to support RS256 (RSA-PKCS1v15-SHA256) in addition to HS256. The algorithm is detected from the JWT header and dispatched to the appropriate verifier. A new AUTH_JWT_PUBLIC_KEY environment variable accepts a PEM-encoded RSA public key; when set, RS256 tokens are verified without the private key. Complementary JWKS endpoint added to auth-service at /.well-known/jwks.json — returns the RSA public key in JWK format when RS256 is configured, empty key set otherwise.',
    highlights: [
      {
        heading: 'internal/middleware/auth.go',
        items: [
          'JWTAuth signature extended: JWTAuth(secret string, pubKey *rsa.PublicKey, issuer string, skipPrefixes []string).',
          'peekAlgorithm: decodes JWT header to read "alg" without verifying signature.',
          'verifyRS256: SHA-256 digest of header.payload, rsa.VerifyPKCS1v15 with crypto.SHA256.',
          'parseClaims: shared helper for exp/iss validation used by both HS256 and RS256 paths.',
          'No-op when both secret == "" and pubKey == nil.',
        ],
      },
      {
        heading: 'config.go + main.go',
        items: [
          'JWTPublicKey field added (AUTH_JWT_PUBLIC_KEY env var).',
          'main.go: parses PEM with encoding/pem + x509.ParsePKIXPublicKey at startup; calls os.Exit(1) on invalid key.',
        ],
      },
      {
        heading: 'auth-service: /.well-known/jwks.json',
        items: [
          'New GET endpoint returns RSA public key as JWK (kty, use, alg, kid, n, e fields) when AUTH_JWT_ALGORITHM is RS256/RS384/RS512 and AUTH_JWT_PUBLIC_KEY is set.',
          'Returns {"keys": []} for HS256 configs — no secret exposure.',
          'Uses cryptography.hazmat to load the PEM and extract RSA public numbers for base64url encoding.',
        ],
      },
    ],
  },
  {
    tag: 'v1.13.1',
    date: '2026-05-18',
    label: 'JWT Middleware Unit Tests',
    completionState: 'published',
    group: 'v1.13',
    summary:
      'Adds a comprehensive test suite for the go-gateway JWT auth middleware covering HS256 and RS256 token paths, expiry, wrong signature, wrong issuer, missing header, skip-prefix pass-through, and the empty-secret no-op mode. Tests run without external dependencies using only Go stdlib crypto primitives. The RS256 tests generate a real RSA-2048 key pair at test time for authentic cryptographic verification.',
    highlights: [
      {
        heading: 'internal/middleware/auth_test.go',
        items: [
          'makeHS256Token helper: crafts signed HS256 JWTs using crypto/hmac + crypto/sha256.',
          'makeRS256Token helper: crafts signed RS256 JWTs using rsa.SignPKCS1v15 with a generated test key.',
          'HS256 tests: valid token (checks X-Auth-Subject/X-Auth-Roles), expired, wrong signature, wrong issuer, missing header, malformed bearer.',
          'Skip-prefix tests: /health and /api/auth pass without a token; non-skipped path still requires token.',
          'No-op test: empty secret + nil pubKey passes all requests without validation.',
          'RS256 tests: valid token, wrong key (different RSA key pair), HS256 token rejected when only pubKey configured.',
        ],
      },
    ],
  },
  {
    tag: 'v1.12.4',
    date: '2026-05-16',
    label: 'Dead-Letter Cloud Monitoring Alert',
    completionState: 'published',
    group: 'v1.12',
    summary:
      'Adds a Cloud Monitoring alert policy to the pubsub-ingest Terraform module that fires when messages accumulate in the dead-letter drain subscription. When alert_email is set, the module provisions an email notification channel and an alert policy that triggers after messages remain undelivered for 5 minutes. The alert documentation includes a step-by-step remediation guide covering log inspection, message sampling with gcloud, and replay instructions.',
    highlights: [
      {
        heading: 'terraform/pubsub-ingest additions',
        items: [
          'New variable alert_email (default empty): set to enable alert creation.',
          'google_monitoring_notification_channel (email type) provisioned when alert_email is set.',
          'google_monitoring_alert_policy: monitors num_undelivered_messages on the dead-letter drain subscription, threshold = 0, duration = 300s, aligner = ALIGN_MAX.',
          'Alert documentation includes gcloud pubsub subscriptions pull command and replay guidance.',
        ],
      },
    ],
  },
  {
    tag: 'v1.12.3',
    date: '2026-05-16',
    label: 'CI/CD - GitHub Actions for go-gateway and Terraform Modules',
    completionState: 'published',
    group: 'v1.12',
    summary:
      'Adds two GitHub Actions workflows: a CI workflow for the go-gateway repo that runs go vet, go build, and go test -race on every push/PR to non-main branches; and a Terraform lint workflow in the Portfolio repo that runs terraform fmt -check and terraform validate for every reusable module and the envs/prod environment on every push/PR touching terraform/. Both workflows are path-filtered to avoid unnecessary runs.',
    highlights: [
      {
        heading: 'go-gateway/.github/workflows/ci.yml',
        items: [
          'Triggers on push to non-main branches and on PRs to main, path-filtered to cmd/, internal/, go.mod, go.sum.',
          'Steps: actions/setup-go with go-version-file (module cache enabled), go vet ./..., go build ./..., go test -race -count=1 ./...',
        ],
      },
      {
        heading: 'Portfolio/.github/workflows/terraform-lint.yml',
        items: [
          'Triggers on push to non-main branches and on PRs to main, path-filtered to terraform/.',
          'Steps: hashicorp/setup-terraform, terraform fmt -check -recursive terraform/, loop over terraform/*/ to init + validate each module, validate terraform/envs/prod.',
          'All init steps use -backend=false to avoid requiring backend credentials in CI.',
        ],
      },
    ],
  },
  {
    tag: 'v1.12.2',
    date: '2026-05-16',
    label: 'go-gateway JWT Auth Middleware',
    completionState: 'published',
    group: 'v1.12',
    summary:
      'Adds a JWT validation layer to go-gateway that validates Bearer tokens on every request except /health and /api/auth/*. Uses HS256 (HMAC-SHA256) with a shared AUTH_JWT_SECRET matching the auth-service. On success, injects X-Auth-Subject and X-Auth-Roles headers so upstream services receive verified identity without re-validating. When AUTH_JWT_SECRET is empty the middleware is a no-op, preserving zero-config local development. Checks: signature, expiry, and issuer (AUTH_ISSUER, default "auth-service").',
    highlights: [
      {
        heading: 'internal/middleware/auth.go (new)',
        items: [
          'JWTAuth(secret, issuer, skipPrefixes): returns a middleware that wraps the mux handler.',
          'verifyHS256: parses token, verifies HMAC-SHA256 signature with hmac.Equal (constant-time), checks exp and iss claims.',
          'Uses only Go stdlib (crypto/hmac, crypto/sha256, encoding/base64.RawURLEncoding, encoding/json).',
          'On invalid/missing token returns 401 JSON {error, reason}; on success forwards X-Auth-Subject and X-Auth-Roles.',
        ],
      },
      {
        heading: 'Config and main updates',
        items: [
          'config.go: JWTSecret (AUTH_JWT_SECRET) and JWTIssuer (AUTH_ISSUER, default "auth-service") added.',
          'cmd/gateway/main.go: mux wrapped with JWTAuth middleware; /health and /api/auth exempted.',
          '.env.example: AUTH_JWT_SECRET and AUTH_ISSUER vars documented.',
        ],
      },
    ],
  },
  {
    tag: 'v1.12.1',
    date: '2026-05-16',
    label: 'Terraform envs/prod Root Module',
    completionState: 'published',
    group: 'v1.12',
    summary:
      'Creates terraform/envs/prod/ - a deployable environment that wires all four Portfolio Terraform modules (go-gateway-ha, cloud-sql-read-replica, pubsub-ingest, soc2-cc9-vendor-risk) into a single plan. Uses a GCS backend (configured via -backend-config at init time). Surfaces aggregated outputs for the LB endpoint, replica connection name, database URL template, and Pub/Sub topic name. A terraform.tfvars.example documents every required and optional variable with safe defaults and comments.',
    highlights: [
      {
        heading: 'terraform/envs/prod/ (new)',
        items: [
          'versions.tf: TF >= 1.6, google >= 5.40, GCS backend stub (configured at init time via -backend-config).',
          'variables.tf: all required variables for all four modules, grouped by module with descriptions.',
          'main.tf: module blocks for go_gateway_ha, cloud_sql_replica, pubsub_ingest, soc2_cc9_vendor_risk; aggregated outputs.',
          'terraform.tfvars.example: commented example values for every variable; clearly marks required vs optional.',
        ],
      },
    ],
  },
  {
    tag: 'v1.11.3',
    date: '2026-05-16',
    label: 'Event-Driven Batch Path - Pub/Sub Async Ingest for CRM Mutations',
    completionState: 'published',
    group: 'v1.11',
    summary:
      'Replaces the go-gateway mutation observer\'s synchronous HTTP POST to observaboard with an async Pub/Sub publish path. When PUBSUB_PROJECT and PUBSUB_TOPIC are set, the observer publishes a base64-encoded JSON message to the crm-mutation-ingest topic via the Pub/Sub REST API, using a cached metadata-server OIDC token. A Terraform module provisions the topic, a push subscription (with OIDC delivery to observaboard /api/ingest/), a dead-letter topic, and an IAM publisher binding. The HTTP direct path remains as a fallback for local dev and non-Cloud Run environments.',
    highlights: [
      {
        heading: 'go-gateway: Pub/Sub observer path',
        items: [
          'internal/observer/observer.go: Observer gains pubsubProject, pubsubTopic, and a token cache (tokenMu, cachedToken, tokenExpiry).',
          'New() signature updated to accept pubsubProject and pubsubTopic; returns nil only when both HTTP and Pub/Sub configs are absent.',
          'Observe() dispatches publishToPubSub() goroutine when Pub/Sub is configured; falls back to postToObservaboard() otherwise.',
          'publishToPubSub(): fetches metadata-server access token, base64-encodes the event JSON, POSTs to Pub/Sub REST API.',
          'metadataToken(): caches the GCP access token with 5-minute early-expiry to prevent clock-skew races.',
          'Falls back to direct HTTP post when metadata server is unreachable (local dev / non-GCP).',
          'PUBSUB_PROJECT and PUBSUB_TOPIC env vars added to config.go and .env.example.',
        ],
      },
      {
        heading: 'terraform/pubsub-ingest module',
        items: [
          'google_pubsub_topic crm-mutation-ingest with configurable message retention (default 1 day).',
          'google_pubsub_subscription push to observaboard /api/ingest/ with OIDC token, exponential retry (10s-300s), and dead-letter policy.',
          'google_pubsub_topic + drain subscription for dead letters (7-day retention).',
          'IAM binding: Pub/Sub SA granted publisher on dead-letter topic; gateway SA granted publisher on ingest topic.',
        ],
      },
    ],
  },
  {
    tag: 'v1.11.2',
    date: '2026-05-16',
    label: 'Cloud SQL Read Replica - Cross-Region Read Pool for Reporting and Search',
    completionState: 'published',
    group: 'v1.11',
    summary:
      'Adds Cloud SQL cross-region read replica support to reporting-service and search-service. Both services now accept a DATABASE_REPLICA_URL env var. When set, migrations run against the primary (DATABASE_URL) and the serving pool is opened against the replica, spreading read load geographically. search-service gains a separate write pool (pool) and read pool (read_pool) so indexing writes stay on the primary while search queries and document reads hit the replica. A new Terraform module provisions the replica instance.',
    highlights: [
      {
        heading: 'reporting-service: replica-aware AppState',
        items: [
          'src/lib/app_state.rs: new with_read_replica(write_url, read_url) constructor. Runs migrations on write_url via a short-lived pool, then opens the serving pool against read_url (or write_url as fallback).',
          'src/main.rs: reads DATABASE_REPLICA_URL env var; calls with_read_replica() instead of from_database_url().',
        ],
      },
      {
        heading: 'search-service: split write/read pools',
        items: [
          'src/lib/app_state.rs: AppState gains read_pool: PgPool field (write pool = pool, read pool = read_pool). with_read_replica() opens both pools.',
          'src/lib/handlers/documents.rs: search_documents, list_documents, and get_document switched to &state.read_pool; index_document and delete/update mutations remain on &state.pool.',
          'src/main.rs: reads DATABASE_REPLICA_URL; calls with_read_replica().',
        ],
      },
      {
        heading: 'terraform/cloud-sql-read-replica module',
        items: [
          'google_sql_database_instance replica: inherits from primary via master_instance_name, ZONAL availability, configurable tier and region.',
          'Outputs: connection_name, public_ip, and a DATABASE_REPLICA_URL template string.',
          'deletion_protection variable (default false) for safe teardown in dev.',
        ],
      },
    ],
  },
  {
    tag: 'v1.11.1',
    date: '2026-05-16',
    label: 'Multi-Region go-gateway - Global HTTPS Load Balancer with Serverless NEGs',
    completionState: 'published',
    group: 'v1.11',
    summary:
      'Fixes and completes the terraform/go-gateway-ha module. Removes an invalid health check (not supported for serverless NEGs — Cloud Run manages its own health). Adds optional HTTPS support via a Google-managed SSL certificate, a HTTPS target proxy, and a port-443 forwarding rule. When var.domain is set, the HTTP URL map issues a 301 redirect to HTTPS; without a domain, HTTP routes directly to the backend. Both the primary (us-south1) and failover (us-west1) Cloud Run deployments are backed by serverless NEGs behind a single global anycast IP.',
    highlights: [
      {
        heading: 'terraform/go-gateway-ha fixes and additions',
        items: [
          'Removed google_compute_health_check and health_checks on the backend service — health checks are not applicable to serverless NEG backends.',
          'Added var.domain (default empty): when set, provisions google_compute_managed_ssl_certificate, HTTPS target proxy, and port-443 forwarding rule.',
          'HTTP URL map: redirects all traffic to HTTPS (301) when domain is set; routes to backend when no domain (dev/staging without a custom domain).',
          'HTTPS URL map routes to the same backend service as the HTTP path.',
          'outputs.tf: https_endpoint output added (null when no domain); http_endpoint description updated.',
          'local.has_domain drives all conditional resource creation via count.',
        ],
      },
    ],
  },
  {
    tag: 'v1.10.0',
    date: '2026-05-16',
    label: 'Gateway Rate Limiting - Per-Client IP Tiers with Standard Headers',
    completionState: 'published',
    group: 'v1.10',
    summary:
      'Upgrades go-gateway from a single shared per-route token bucket to per-client-IP rate limiting with route-tier overrides. Every response now carries X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers. Auth routes are capped at 5 rps to slow credential-stuffing; CRM write routes at 30 rps; read/reporting routes at 60 rps. A background goroutine evicts stale client entries on a 5-minute interval. Nine unit tests cover headers, 429 enforcement, client isolation, tier routing, and X-Forwarded-For handling.',
    highlights: [
      {
        heading: 'go-gateway: per-client rate limiting',
        items: [
          'internal/middleware/ratelimit.go rewritten: key changed from routeKey to clientIP|routeKey; burst = 2x configured RPS; idle entries evicted every 5 min.',
          'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers set on every proxied response.',
          'Retry-After header added on 429 responses; error body includes per-route limit and seconds to retry.',
          'extractIP(): prefers leftmost IP from X-Forwarded-For (Cloud Run load balancer) over TCP RemoteAddr.',
          'routeRPS(): looks up path prefix in routeLimits map before falling back to defaultRPS.',
          'RateLimiter() signature updated to accept routeLimits map[string]float64.',
        ],
      },
      {
        heading: 'go-gateway: tiered config and wiring',
        items: [
          'internal/config/config.go: added AuthRateLimitRPS (default 5), WriteRateLimitRPS (default 30), ReadRateLimitRPS (default 60); RateLimitRPS default raised from 10 to 15.',
          'RATE_LIMIT_AUTH_RPS, RATE_LIMIT_WRITE_RPS, RATE_LIMIT_READ_RPS env vars supported.',
          'cmd/gateway/main.go: routeLimits map wired — /api/auth=auth, CRM routes=write, /api/reporting+search+events=read.',
          'Startup log updated to print all four tier values.',
          '.env.example updated with all four rate limit vars and inline comments.',
        ],
      },
      {
        heading: 'Tests',
        items: [
          'internal/middleware/ratelimit_test.go: 9 tests added (first tests in repo).',
          'Covers: headers set on 200, Limit header matches config, 429 on burst exceeded, per-client isolation, route tiers applied, X-Forwarded-For as client key, extractIP XFF, extractIP RemoteAddr, routeKey segments.',
        ],
      },
    ],
  },
  {
    tag: 'v1.9.0',
    date: '2026-05-07',
    label: 'Distributed Tracing & Observability - End-to-End Request Traces',
    completionState: 'published',
    group: 'v1.9',
    summary:
      'Adds end-to-end distributed tracing across all services using OpenTelemetry and GCP Cloud Trace. Every request from go-gateway propagates a W3C traceparent header through all downstream services (Rust, Go, Python), creating a complete trace visible in Cloud Trace console. Security: rustls-webpki upgraded to 0.103.13 (RUSTSEC-2026-0104 fix).',
    highlights: [
      {
        heading: 'go-gateway: W3C traceparent middleware',
        items: [
          'New internal/middleware/traceparent.go: generates W3C-compliant traceparent headers (v00-<traceID>-<spanID>-01 format) for each incoming request.',
          'Middleware propagates header to all forwarded requests, enabling end-to-end trace correlation.',
        ],
      },
      {
        heading: 'All 11 Rust services: Cloud Trace exporter',
        items: [
          'All services updated: accounts, contacts, activities, automation, integrations, search, projects, opportunities, reporting, spend, audit.',
          'Cargo.toml: added opentelemetry (0.23), opentelemetry-gcp (0.23), tracing-opentelemetry (0.24).',
          'main.rs: Cloud Trace exporter initialization with graceful fallback to stdout if initialization fails.',
          'Spans automatically created for each request; traceparent header automatically extracted and propagated.',
        ],
      },
      {
        heading: 'event-stream-service (Go): traceparent extraction',
        items: [
          'Extract traceparent from incoming request headers; preserve in Event struct for propagation through event pipeline.',
          'Enable tracing of events through the streaming system.',
        ],
      },
      {
        heading: 'ai-orchestrator-service (Python): OpenTelemetry instrumentation',
        items: [
          'OpenTelemetry SDK with GCP Cloud Trace exporter.',
          'FastAPIInstrumentor: automatic tracing for all endpoints.',
          'HTTPXClientInstrumentor: automatic tracing for outgoing HTTP requests.',
          'Graceful fallback if Cloud Trace initialization fails.',
        ],
      },
      {
        heading: 'Security: rustls-webpki upgrade',
        items: [
          'Workspace.dependencies constraint: rustls-webpki >= 0.103.13 (fixes RUSTSEC-2026-0104 reachable panic).',
          'All services use workspace.dependencies.reqwest to enforce constraint.',
          'Unblocks CI cargo audit checks.',
        ],
      },
    ],
  },
  {
    tag: 'v1.8.0',
    date: '2026-05-07',
    label: 'Real-Time Feedback Loop - Observaboard to Event Stream',
    completionState: 'published',
    group: 'v1.8',
    summary:
      'Closes the end-to-end pipeline: after classifying a CRM ingest event, observaboard now publishes it to event-stream-service via a short-lived HS256 JWT. The notification bell finally rings from real CRM mutations. Fixes the create_gateway_api_key management command bug and the badge color source-derivation.',
    highlights: [
      {
        heading: 'observaboard: stream publisher',
        items: [
          'New events/stream_publisher.py: generates a 60-second HS256 JWT (stdlib only, no extra deps), POSTs classified event to event-stream-service /events/publish with a 2-second timeout. All exceptions are swallowed - publish failure never affects the ingest response.',
          'IngestView.post wired: after classify_event(), calls event.refresh_from_db() then publish_to_stream() when EVENT_STREAM_URL is set.',
          'settings.py: EVENT_STREAM_URL and EVENT_STREAM_JWT_SECRET added (decouple config, empty defaults).',
          'deploy-cloud-run.yml: Resolve event-stream-service URL step added; EVENT_STREAM_JWT_SECRET injected from Secret Manager; EVENT_STREAM_URL injected as env var.',
          'requirements.txt: PyJWT>=2.9 added (used only for type clarity; stdlib hmac handles JWT generation).',
        ],
      },
      {
        heading: 'observaboard: management command fix',
        items: [
          'create_gateway_api_key: replaced non-existent ApiKey.objects.create_key() with ApiKey.objects.create(); replaced existing.prefix (no such field) with existing.pk.',
        ],
      },
      {
        heading: 'infraportal: bell badge fix',
        items: [
          'SOURCE_COLORS lookup now uses n.type.split(".")[0] - so event type "accounts.created" correctly maps to the blue accounts badge instead of falling through to the zinc fallback.',
        ],
      },
    ],
  },
  {
    tag: 'v1.7.0',
    date: '2026-05-07',
    label: 'CRM Event Pipeline - Gateway Observer & Live Bell',
    completionState: 'published',
    group: 'v1.7',
    summary:
      'Wires the notification bell to real CRM data. The go-gateway now intercepts successful mutations (POST/PATCH/DELETE → 2xx) on CRM routes and fires a fire-and-forget event to observaboard. Adds a management command for idempotent API key provisioning. The notification bell badge is now source-colored.',
    highlights: [
      {
        heading: 'go-gateway: mutation observer',
        items: [
          'New internal/observer package: Observer struct with configurable HTTP client (5 s timeout), source-map derived from path prefix, and event_type built as source.action (e.g. accounts.created).',
          'proxy.New() extended with optional *observer.Observer param; ModifyResponse hook fires Observe() on 2xx mutation responses only. Non-CRM routes pass nil - zero overhead.',
          'Config gains ObservaboardURL and ObservaboardAPIKey (env: OBSERVABOARD_URL, OBSERVABOARD_API_KEY). Defaults to the Cloud Run URL already in use for the events proxy.',
          'deploy-cloud-run.yml: OBSERVABOARD_URL resolved via gcloud run services describe; OBSERVABOARD_API_KEY injected via --set-secrets from Secret Manager.',
        ],
      },
      {
        heading: 'observaboard: API key management',
        items: [
          'create_gateway_api_key management command: creates a named API key and prints the raw key once to stdout.',
          '--idempotent flag: if a key with the given name exists, prints its prefix and exits cleanly - safe for CI/CD re-runs.',
          'Includes a warning to store the key in Secret Manager immediately.',
        ],
      },
      {
        heading: 'infraportal: notification bell polish',
        items: [
          'SOURCE_COLORS map: each CRM source gets a distinct badge color (accounts=blue, contacts=green, opportunities=amber, activities=purple, automation=orange, integrations=cyan).',
          'Unknown sources fall back to neutral zinc badge, keeping the bell readable for any ingest source.',
        ],
      },
    ],
  },
  {
    tag: 'v1.6.0',
    date: '2026-05-16',
    label: 'observaboard Cloud Tasks + SOC 2 CC9.2 Vendor Risk',
    completionState: 'published',
    group: 'v1.6',
    summary:
      'Migrates observaboard event classification from synchronous in-request processing to GCP Cloud Tasks async dispatch. Removes the stale celery.py artifact; adds a POST /api/tasks/classify/ callback endpoint secured with OIDC token verification. Adds a self-contained terraform/soc2-cc9-vendor-risk module (GCS evidence bucket, BigQuery vendor registry, Pub/Sub, quarterly Cloud Scheduler reminder) that satisfies SOC 2 CC9.2.',
    highlights: [
      {
        heading: 'observaboard: Celery -> Cloud Tasks migration',
        items: [
          'celery.py deleted; google-cloud-tasks>=2.16 and google-auth>=2.28 added to requirements.txt.',
          'events/tasks.py: new enqueue_classify_task() dispatches an HTTP Cloud Tasks task to POST /api/tasks/classify/ with OIDC token. Falls back to inline classify_event() when CLOUD_TASKS_QUEUE is unset (local dev/CI).',
          'events/views.py: IngestView.post() now calls enqueue_classify_task() instead of classify_event(); returns 202 immediately. New ClassifyCallbackView authenticates OIDC token, classifies the event, then publishes to event-stream-service.',
          'events/urls.py: route api/tasks/classify/ added.',
          'settings.py: CLOUD_TASKS_QUEUE, CLOUD_TASKS_SA_EMAIL, CLOUD_RUN_SERVICE_URL, GCP_PROJECT_ID, GCP_REGION added via python-decouple.',
          'deploy-cloud-run.yml: "Resolve event stream URL" step expanded to also resolve Cloud Run service URL; --set-env-vars extended with CLOUD_TASKS_QUEUE, CLOUD_TASKS_SA_EMAIL, CLOUD_RUN_SERVICE_URL, GCP_PROJECT_ID, GCP_REGION.',
          '.env.example: REDIS_URL removed; Cloud Tasks vars documented with blank defaults.',
          'Four new tests in TestClassifyCallbackView covering success, missing event_id, nonexistent event tolerance, and OIDC rejection.',
        ],
      },
      {
        heading: 'SOC 2 CC9.2 - Vendor risk Terraform module',
        items: [
          'New terraform/soc2-cc9-vendor-risk/ module with variables.tf, main.tf, outputs.tf, README.md.',
          'GCS bucket with versioning, 2-year retention policy (63 072 000 s), and COLDLINE lifecycle transition - stores SOC 2 reports, DPAs, and signed agreements.',
          'BigQuery dataset + vendors table: vendor_id, risk_tier, data_classification, soc2_certified, soc2_report_gcs_path, agreement_gcs_path, last_review_date, next_review_date, offboarding_date.',
          'IAM: security_reviewer_emails granted storage.objectViewer + objectCreator on evidence bucket and READER on BigQuery dataset.',
          'Pub/Sub topic vendor-risk-alerts with 1-day message retention.',
          'Cloud Scheduler job fires quarterly (default 0 9 1 */3 * America/New_York) and publishes a JSON review reminder to the Pub/Sub topic.',
        ],
      },
    ],
  },
  {
    tag: 'v1.5.0',
    date: '2026-05-08',
    label: 'backend-service PostgreSQL Migration + CRM Notification Bell',
    completionState: 'published',
    group: 'v1.5',
    summary:
      'Migrates backend-service (Rust/Axum task API) from SQLite on Fly.io to PostgreSQL on GCP Cloud Run with Cloud SQL, completing the full cloud consolidation to a single provider. Adds a real-time CRM notification bell in the InfraPortal top nav that streams live events from the event-stream-service via SSE.',
    highlights: [
      {
        heading: 'backend-service: SQLite to PostgreSQL',
        items: [
          'sqlx feature flag changed from sqlite to postgres; PgPool replaces SqlitePool; max_connections raised to 10.',
          'All 10 migration files rewritten in PostgreSQL dialect: BIGSERIAL PKs, BOOLEAN columns, TIMESTAMPTZ timestamps, CONSTRAINT-based CHECK expansion replacing table rebuild.',
          'All SQL placeholders updated from ? to $N positional parameters throughout handlers, router, and admin.',
          'INSERT ... RETURNING used for create_task and create_comment, eliminating last_insert_rowid() calls.',
          'admin_backup stubbed with 501 response - Cloud SQL automated backups replace VACUUM INTO.',
          'Timestamp model fields changed from String to DateTime<Utc> for correct TIMESTAMPTZ decoding.',
        ],
      },
      {
        heading: 'backend-service: Cloud Run deployment',
        items: [
          'Dockerfile updated: sqlite3 removed from apt-get, CMD simplified to direct binary invocation.',
          'deploy-cloud-run.yml created: cargo test gate + OIDC WIF auth + Artifact Registry + Cloud SQL sidecar via --add-cloudsql-instances.',
          'DATABASE_URL and AUTH_JWT_SECRET injected at deploy time via Secret Manager --set-secrets.',
          'fly.toml annotated with migration comment; Fly deployment retired.',
          'go-gateway TasksURL default updated to Cloud Run URL.',
        ],
      },
      {
        heading: 'CRM notification bell',
        items: [
          'NotificationContext.tsx: EventSource connection to event-stream-service /events/stream with exponential-backoff auto-reconnect.',
          'NotificationBell.tsx: bell icon with unread badge, dropdown panel with event type tags, relative timestamps, per-item dismiss, and clear all.',
          'NotificationProvider wraps Root in main.tsx; bell inserted between theme toggle and sign-out in TopNav.',
          'Notifications capped at 50 items; unread count resets on panel open.',
        ],
      },
    ],
  },
  {
    tag: 'v1.4.0',
    date: '2026-05-07',
    label: 'Fly.io to GCP Cloud Run Migration',
    completionState: 'published',
    group: 'v1.4',
    summary:
      'Migrates two stateless services - the Python/FastAPI AI orchestrator and the Go SSE event hub - from Fly.io to GCP Cloud Run. Both services are consolidated onto a single cloud provider, static Fly API tokens are replaced with keyless OIDC via Workload Identity Federation, and all services are standardised on port 8080 with SHA-pinned image tags.',
    highlights: [
      {
        heading: 'ai-orchestrator-service migration',
        items: [
          'Dockerfile updated: ENV APP_PORT=8080 and EXPOSE 8080 (was 8081).',
          'deploy-cloud-run.yml created: pytest gate + OIDC auth + Artifact Registry build + Cloud Run deploy with 3-attempt retry loop.',
          'Secrets (ANTHROPIC_API_KEY, OPENROUTER_API_KEY) mounted via Secret Manager --set-secrets, not env files.',
          'fly.toml annotated with migration comment; Fly deployment retired.',
        ],
      },
      {
        heading: 'event-stream-service migration',
        items: [
          'Dockerfile updated: EXPOSE 8080 (was 8085); app already reads $PORT from env, no code change needed.',
          'deploy-cloud-run.yml created: go test gate + OIDC auth + Artifact Registry build + Cloud Run deploy.',
          'AUTH_JWT_SECRET mounted via Secret Manager.',
          'fly.toml annotated with migration comment; Fly deployment retired.',
        ],
      },
      {
        heading: 'Infrastructure improvements',
        items: [
          'EVENT_STREAM_URL constant added to infraportal config.ts for use by the upcoming notification bell (v1.5).',
          'All 12 platform services now run on GCP Cloud Run us-central1 — single cloud provider, unified observability.',
          'Cloud Migration case study published at #/case-studies/fly-to-gcp-migration.',
        ],
      },
    ],
  },
  {
    tag: 'v1.3.0',
    date: '2026-05-06',
    label: 'Client Portal Dashboard',
    completionState: 'published',
    group: 'v1.3',
    summary:
      'Enriches the client-facing project portal with three new capabilities: deliverable effort tracking with hours-based progress, admin-curated project links (Figma, GitHub, Notion, Loom, and custom), and a project update feed. A companion Gmail sync agent fetches Gmail threads tagged per project and upserts them into projects-service via a new sync endpoint.',
    highlights: [
      {
        heading: 'Effort tracking',
        items: [
          'estimated_hours field added to each deliverable in the portal UI.',
          'ProjectSummaryCard now shows total estimated hours alongside deliverable count, and displays hours-based completion alongside item-count progress.',
          'Hours roll up from completed deliverables to give clients a real burn-down view.',
        ],
      },
      {
        heading: 'Project links',
        items: [
          'ProjectLink interface: id, link_type, label, url, sort_order stored in projects-service.',
          'LinksSection component renders typed link chips with icons for Figma, GitHub, Notion, Loom, Google Doc, Jira, Slack, and generic external links.',
          'Links section is hidden when no links exist (admin-only create via API).',
        ],
      },
      {
        heading: 'Progress update feed',
        items: [
          'ProgressUpdate resource: project_id, content, created_at — posted by admin, visible to client.',
          'ProgressUpdatesSection renders a reverse-chronological timeline with relative timestamps.',
          'Updates pulled alongside project data on portal load — no separate client action required.',
        ],
      },
      {
        heading: 'Gmail sync agent',
        items: [
          'agents/gmail-sync/sync_project_emails.py — Python script using Gmail MCP tools (search_threads, get_thread).',
          'Searches Gmail for threads referencing each active project by name, fetches full thread content, and upserts to POST /api/v1/projects/{id}/emails/sync.',
          'Intended to run in a Claude Code session with Gmail MCP configured, or on a cron schedule.',
        ],
      },
    ],
  },
  {
    tag: 'v1.3.2',
    date: '2026-06-01',
    label: 'Client Portal Dashboard',
    completionState: 'published',
    group: 'v1.3',
    summary:
      'Full-featured client portal for project tracking, effort estimation, and real-time collaboration. Clients authenticate via GitHub/Google OAuth or email+password, view project milestones with deliverables and progress bars, browse project links and Gmail-synced email threads, track collaborators and progress updates, send direct messages to admin, and monitor GitHub build status. Built with React 19, TypeScript, and Tailwind; backed by projects-service.',
    highlights: [
      {
        heading: 'Client authentication & authorization',
        items: [
          'OAuth sign-in: GitHub and Google (auth-service integration via AuthGate)',
          'Email+password login with forgot-password and register flows',
          'JWT token refresh on 401 — seamless session continuation without page reload',
        ],
      },
      {
        heading: 'Project dashboard',
        items: [
          'Project summary card: name, description, status badge, progress bar (deliverables completed / total)',
          'Timeline: milestones with due dates, status, effort (hours), expandable deliverables with status and estimates',
          'Progress tracking: overall % completion, estimated vs. actual hours, days to deadline',
        ],
      },
      {
        heading: 'Collaboration & comms',
        items: [
          'Collaborators section: team members with avatars, names, and roles',
          'Progress updates: timestamped admin posts visible on the portal',
          'Message thread: real-time Q&A between client and admin with send/receive',
        ],
      },
      {
        heading: 'Project context & artifacts',
        items: [
          'Project links: Upwork, Google Drive, GitHub, Figma, custom URLs with emoji icons',
          'Email section: Gmail-synced email threads tied to the project with expandable bodies',
          'Build status badges: GitHub CI results per repo with pass/fail/running status and last run timestamp',
        ],
      },
      {
        heading: 'Empty states & error handling',
        items: [
          'Graceful handling when client has no assigned project (shows account ID for admin linking)',
          'Loading skeletons for async sections (cards, tables, metrics)',
          'Empty state illustrations + messages for no milestones, no emails, no collaborators',
          'Error panel with retry for failed fetches',
        ],
      },
    ],
  },
  {
    tag: 'v1.3.1',
    date: '2026-04-15',
    label: 'Productionizer Agent',
    completionState: 'published',
    group: 'v1.3',
    summary:
      'Autonomous Gemini 2.5 Flash agent runs on a daily GitHub Actions cron. Each run picks one microservice + one gap from a 55-task matrix (11 services × 5 gap types), generates the fix via tool calling (read_file / write_file / run_shell), verifies it with cargo clippy + cargo test, and opens a PR against the microservices repo. The agent self-reverts on any verification failure — no bad code ever reaches a branch.',
    highlights: [
      {
        heading: 'Agent architecture',
        items: [
          'agents/productionizer/ — Python module using google-genai SDK with gemini-2.5-flash.',
          '55-task matrix: 11 Rust/Axum services × 5 gap types iterated gap-first so all services receive the highest-priority improvement before any receive the second.',
          'Three tools exposed to Gemini: read_file (workspace inspection), write_file (guarded — blocks auth.rs, Cargo.toml, and cross-service writes), run_shell (read-only commands only).',
          'Verification pipeline: cargo clippy -D warnings → cargo test --test integration_test → commit → push → gh pr create. Any step failure triggers git checkout HEAD -- <service>/ revert.',
        ],
      },
      {
        heading: 'Gap types addressed',
        items: [
          'structured-logging: tracing::info! on mutations, tracing::debug! on reads, tracing::warn! on degraded paths.',
          'dynamic-health: /health and /ready perform a live sqlx DB ping; return HTTP 503 on failure instead of hardcoded "ok".',
          'error-details: ApiError.details populated with serde_json::json!() field/constraint context on all validation errors.',
          'audit-error-handling: silent let _ = emit_audit() replaced with match + tracing::warn! logging.',
          'error-path-tests: integration test coverage for missing 400/404 paths (reads existing tests first to avoid duplicates).',
        ],
      },
      {
        heading: 'GitHub Actions workflow',
        items: [
          'productionizer.yml: daily cron at 06:00 UTC + workflow_dispatch with force_service / force_gap overrides.',
          'State persisted in Actions cache (state.json) — skips already-completed tasks across runs.',
          'Postgres 16 service container spun up per run for integration test verification.',
        ],
      },
    ],
  },
  {
    tag: 'v1.2.4',
    date: '2026-04-11',
    label: 'Service Resilience & Testing',
    completionState: 'published',
    group: 'v1.2',
    summary:
      'Integration tests added for all 11 Rust/Axum services — every service now has full error-path coverage. A k6 load test suite covers smoke, load, and spike scenarios with a p95 < 2 s threshold. A chaos engineering runbook documents cold-start behavior, Cloud SQL connection exhaustion, fail-open degradation paths, and the crash-loop rollback SOP.',
    highlights: [
      {
        heading: 'Test coverage',
        items: [
          'audit-service, spend-service, and projects-service integration tests added — completing coverage across all 11 services.',
          'Error-path tests: 401 on missing/invalid JWT, 400 on validation failures, 404 on nonexistent resources.',
        ],
      },
      {
        heading: 'Load testing & chaos',
        items: [
          'scripts/load-test.js: k6 smoke (1 VU, 30s), load (50 VUs, 5 min), and spike (200 VUs, 30s) scenarios. p95 latency threshold: 2 s.',
          'docs/chaos-runbook.md: cold-start characterization, Cloud SQL max-connections exhaustion (PgPoolOptions max = 5), fail-open cross-service call behavior, and Cloud Run traffic-split rollback SOP.',
        ],
      },
    ],
  },
  {
    tag: 'v1.2.3',
    date: '2026-04-11',
    label: 'Portfolio Observability',
    completionState: 'published',
    group: 'v1.2',
    summary:
      'CRM services now emit structured events to Observaboard after every successful mutation. A new admin health dashboard polls all 11 service /health endpoints with 30-second auto-refresh, giving a live view of platform status.',
    highlights: [
      {
        heading: 'Event pipeline',
        items: [
          'audit-service fire-and-forgets CRM events to Observaboard POST /api/ingest/ after each successful DB insert.',
          'Payload: { source: "infraportal-crm", event_type: "<entity>.<action>", payload: { audit_event_id, ... } }.',
          'Auth: Authorization: Api-Key <key> — key stored in Cloud Run env via Terraform (terraform.tfvars → terraform apply).',
        ],
      },
      {
        heading: 'Admin health dashboard',
        items: [
          '#/admin/health page in infraportal: polls all 11 service /health endpoints in parallel.',
          '30-second auto-refresh; per-service status badges (green / degraded / unreachable).',
        ],
      },
    ],
  },
  {
    tag: 'v1.2.2',
    date: '2026-04-11',
    label: 'Audit Trail & Compliance',
    completionState: 'published',
    group: 'v1.2',
    summary:
      'New Rust/Axum audit-service stores an immutable CRM mutation log in PostgreSQL (Cloud SQL). All CRM services fire-and-forget audit events to it after each successful write. A new admin audit trail page lets admins review the full mutation history.',
    highlights: [
      {
        heading: 'audit-service',
        items: [
          'New Rust/Axum service deployed to GCP Cloud Run (us-central1) with PostgreSQL persistence.',
          'POST /api/v1/audit-events: receives entity_type, entity_id, action, actor, and payload; stores with immutable timestamp.',
          'GET /api/v1/audit-events: paginated list with entity_type / entity_id / actor filters; JWT-authenticated.',
        ],
      },
      {
        heading: 'CRM integration & frontend',
        items: [
          'All 9 CRM handlers call emit_audit() as a fire-and-forget tokio::spawn after each successful mutation.',
          'Admin audit trail page in infraportal: searchable table of audit events with entity type / actor filters.',
        ],
      },
    ],
  },
  {
    tag: 'v1.2.1',
    date: '2026-04-11',
    label: 'Data Export Pipeline',
    completionState: 'published',
    group: 'v1.2',
    summary:
      'Bulk CSV and JSON export from reporting-service — admins can export the full CRM dataset or a filtered slice. A new export modal in the admin reports page drives the download.',
    highlights: [
      {
        heading: 'reporting-service',
        items: [
          'GET /api/v1/reports/export?format=csv|json: streams the full aggregated report dataset as a file download.',
          'Supports the same status and date-range filters as the list endpoint.',
          'Content-Disposition header set for browser download; chunked transfer for large datasets.',
        ],
      },
      {
        heading: 'Frontend',
        items: [
          'Export button added to admin reports page; triggers a modal to select format (CSV / JSON) and optional filters.',
          'Download handled via a signed URL blob — no polling required.',
        ],
      },
    ],
  },
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
