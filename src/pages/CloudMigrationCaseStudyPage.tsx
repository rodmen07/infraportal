import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { CodeBlock } from '../features/consulting/CodeBlock'

const TECH_STACK = [
  'GCP Cloud Run',
  'GitHub Actions',
  'OIDC',
  'Workload Identity Federation',
  'Artifact Registry',
  'Docker',
  'Fly.io',
  'Python',
  'FastAPI',
  'Go',
  'Rust',
  'Secret Manager',
]

const HIGHLIGHTS: {
  label: string
  detail: string
  file: string
  code: string
  language?: string
}[] = [
  {
    label: 'Port normalization — Fly.io 808x to Cloud Run 8080',
    detail:
      'Fly.io allows arbitrary internal ports. Cloud Run requires every container to bind on $PORT (always 8080). Both services needed Dockerfile updates and, for ai-orchestrator-service, an APP_PORT env var shim so the FastAPI app reads the right value at startup.',
    file: 'ai-orchestrator-service/Dockerfile',
    code: `# Before (Fly.io)
EXPOSE 8081
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]

# After (Cloud Run)
ENV APP_PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $APP_PORT"]`,
    language: 'dockerfile',
  },
  {
    label: 'OIDC keyless auth — no static credentials',
    detail:
      'Each service repo is granted a Workload Identity Federation (WIF) binding on the GCP service account. GitHub Actions exchanges its OIDC token for a short-lived GCP credential — no JSON key is stored anywhere.',
    file: '.github/workflows/deploy-cloud-run.yml',
    code: `jobs:
  deploy:
    permissions:
      contents: read
      id-token: write        # required to mint the OIDC token

    steps:
      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: \${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: \${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker us-central1-docker.pkg.dev --quiet`,
    language: 'yaml',
  },
  {
    label: 'SHA-pinned image tags — no mutable :latest',
    detail:
      'Every image is tagged with the Git commit SHA before push. Cloud Run receives that exact digest, making every deploy fully reproducible and every rollback a one-liner.',
    file: '.github/workflows/deploy-cloud-run.yml',
    code: `- name: Build and push image
  run: |
    IMAGE="us-central1-docker.pkg.dev/\${{ vars.GCP_PROJECT_ID }}/microservices/ai-orchestrator-service:\${{ github.sha }}"
    docker build -t "$IMAGE" .
    docker push "$IMAGE"

- name: Deploy to Cloud Run
  run: |
    IMAGE="us-central1-docker.pkg.dev/\${{ vars.GCP_PROJECT_ID }}/microservices/ai-orchestrator-service:\${{ github.sha }}"
    gcloud run deploy ai-orchestrator-service \\
      --image "$IMAGE" \\
      --region us-central1 \\
      --port 8080`,
    language: 'yaml',
  },
  {
    label: 'Retry loop — resilient to transient deploy failures',
    detail:
      'Cloud Run deploys occasionally time out on cold starts. A three-attempt retry loop with exponential back-off (10s, 20s) keeps the workflow green without manual re-runs.',
    file: '.github/workflows/deploy-cloud-run.yml',
    code: `- name: Deploy to Cloud Run (with retry)
  run: |
    IMAGE="us-central1-docker.pkg.dev/\${{ vars.GCP_PROJECT_ID }}/microservices/ai-orchestrator-service:\${{ github.sha }}"
    for attempt in 1 2 3; do
      echo "Deploy attempt $attempt..."
      if gcloud run deploy ai-orchestrator-service \\
           --image "$IMAGE" \\
           --region us-central1 \\
           --port 8080 \\
           --memory 512Mi \\
           --set-secrets "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest" \\
           --set-env-vars "ALLOWED_ORIGINS=\${{ vars.ALLOWED_ORIGINS }},ANTHROPIC_MODEL=claude-sonnet-4-6,REQUEST_TIMEOUT_SECONDS=30"; then
        echo "Deploy succeeded on attempt $attempt"
        break
      fi
      [ $attempt -lt 3 ] && sleep $((attempt * 10))
    done`,
    language: 'yaml',
  },
  {
    label: 'Secret Manager injection — secrets never in env files',
    detail:
      'API keys are stored in GCP Secret Manager. The --set-secrets flag mounts them as env vars at container startup. The service account only needs secretmanager.versions.access on each named secret.',
    file: '.github/workflows/deploy-cloud-run.yml',
    code: `gcloud run deploy ai-orchestrator-service \\
  --set-secrets "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest"

# event-stream-service
gcloud run deploy event-stream-service \\
  --set-secrets "AUTH_JWT_SECRET=AUTH_JWT_SECRET:latest"

# Secrets are mounted as env vars inside the container.
# They never appear in workflow logs, image layers, or repo history.`,
    language: 'bash',
  },
  {
    label: 'Go runtime port binding — reads $PORT from env',
    detail:
      'Cloud Run injects PORT=8080 at runtime. The event-stream-service Go binary already read os.Getenv("PORT") for Fly.io, so no application code changed — only the Dockerfile EXPOSE directive needed updating.',
    file: 'event-stream-service/Dockerfile',
    code: `# Before (Fly.io)
EXPOSE 8085

# After (Cloud Run) — only one line changed
EXPOSE 8080

# Application code unchanged — already reads $PORT:
# addr := ":" + getenv("PORT", "8085")
# http.ListenAndServe(addr, mux)`,
    language: 'dockerfile',
  },
]

export function CloudMigrationCaseStudyPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const toggle = (idx: number) => setOpenIdx(openIdx === idx ? null : idx)

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Fly.io to GCP Cloud Run Migration</h1>
            <p className="mt-1 text-sm text-amber-300/80">
              Python · Go · Cloud Run · OIDC · Workload Identity · Secret Manager · GitHub Actions
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              &larr; Case studies
            </a>
            <a
              href="https://github.com/rodmen07/microservices"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              GitHub &rarr;
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          Two stateless services - the Python/FastAPI AI orchestrator and the Go SSE event hub -
          were migrated from Fly.io to GCP Cloud Run as part of InfraPortal v1.4. The migration
          consolidates the platform onto a single cloud provider, replaces static Fly API tokens
          with keyless OIDC authentication, and standardises every service on port 8080 with
          SHA-pinned image tags.
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

      {/* Architecture before/after */}
      <section className="forge-panel rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 backdrop-blur-xl">
        <h2 className="mb-4 text-base font-semibold text-amber-200">Architecture before and after</h2>
        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          {/* Before */}
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-200">Before (Fly.io)</div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  ai-orchestrator-service on Fly.io — port 8081 — static Fly API token secret
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  event-stream-service on Fly.io — port 8085 — separate Fly region config
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  Two separate CI/CD systems: Fly deploy tokens + GCP OIDC for other services
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  No automated test step before deploy for either service
                </span>
              </div>
            </div>
          </div>

          {/* After */}
          <div className="rounded-xl border border-green-700/40 bg-green-950/20 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-200">After (GCP Cloud Run)</div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  Both services on Cloud Run us-central1 — port 8080 — co-located with other 10 services
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  Keyless OIDC via Workload Identity Federation — zero static credentials
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  SHA-pinned image tags in Artifact Registry — every deploy reproducible
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#x25CF;</span>
                <span className="text-zinc-400">
                  pytest + go test steps run before every deploy — regressions blocked at CI
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: '2', label: 'Services migrated' },
          { value: '0', label: 'Static secrets remaining' },
          { value: '3x', label: 'Deploy retry resilience' },
          { value: '1', label: 'Cloud provider (GCP)' },
        ].map(({ value, label }) => (
          <div key={label} className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4 text-center">
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="mt-0.5 text-xs text-zinc-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Implementation highlights */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-white">Implementation highlights</h2>
        <div className="space-y-2">
          {HIGHLIGHTS.map((h, idx) => (
            <div
              key={h.label}
              className="overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/70"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-200 transition hover:text-white"
                onClick={() => toggle(idx)}
                aria-expanded={openIdx === idx}
              >
                <span>{h.label}</span>
                <span className="shrink-0 text-zinc-500">{openIdx === idx ? '▲' : '▼'}</span>
              </button>

              {openIdx === idx && (
                <div className="border-t border-zinc-700/50 px-4 pb-4 pt-3">
                  <p className="mb-3 text-sm text-zinc-400">{h.detail}</p>
                  <div className="text-xs text-zinc-500 mb-1 font-mono">{h.file}</div>
                  <CodeBlock code={h.code} language={h.language ?? 'bash'} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Migration checklist */}
      <section className="forge-panel rounded-2xl border border-zinc-700/40 bg-zinc-900/60 p-5">
        <h2 className="mb-4 text-base font-semibold text-white">Migration checklist (reusable pattern)</h2>
        <div className="space-y-2 text-sm text-zinc-400">
          {[
            'Normalise container port to 8080 (Cloud Run reads $PORT env var)',
            'Add OIDC permissions block (id-token: write) to workflow job',
            'Create WIF binding for the service repo in GCP IAM',
            'Replace Fly deploy action with gcloud run deploy + SHA tag',
            'Mount secrets via --set-secrets from Secret Manager (no env files)',
            'Wrap gcloud run deploy in retry loop (3 attempts, exponential back-off)',
            'Annotate fly.toml with migration comment (keep for reference)',
            'Update frontend VITE_ env vars in repo settings with new Cloud Run URL',
          ].map((item, i) => (
            <div key={item} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="forge-panel rounded-2xl border border-zinc-700/40 bg-zinc-900/60 p-5">
        <h2 className="text-base font-semibold text-white">Plan a similar migration</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Whether you are consolidating clouds, retiring static deploy credentials, or standardising
          CI/CD across a multi-service platform, this pattern scales to any number of services.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#/contact" className="btn-accent px-5 py-2 text-sm">
            Start a conversation
          </a>
          <a href="#/case-studies/cicd-pipeline-template" className="btn-neutral px-5 py-2 text-sm">
            CI/CD pipeline template
          </a>
        </div>
      </section>
    </PageLayout>
  )
}
