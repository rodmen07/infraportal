import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { CodeBlock } from '../features/consulting/CodeBlock'
import { BuildStatusSection } from '../features/site/BuildStatusSection'

const TECH_STACK = ['GitHub Actions', 'GCP Cloud Run', 'AWS ECS / Fargate', 'OIDC', 'Workload Identity Federation', 'Rust', 'Python', 'Docker', 'Bash']

const HIGHLIGHTS: { label: string; detail: string; file: string; code: string; language?: string }[] = [
  {
    label: 'Environment-scoped OIDC — isolated credentials per stage',
    detail: 'Each GitHub Environment (staging, production) stores its own OIDC secrets. GitHub injects the correct set automatically based on the environment: field. Compromising staging credentials cannot affect production.',
    file: '.github/workflows/deploy-pipeline.yml',
    code: `jobs:
  deploy-staging:
    environment: staging       # ← GitHub injects staging secrets
    permissions:
      id-token: write          # required for OIDC token exchange
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: \${{ secrets.GCP_WIF_PROVIDER }}
          service_account: \${{ secrets.GCP_SERVICE_ACCOUNT }}
          # secrets.GCP_WIF_PROVIDER is the STAGING value here

  deploy-prod:
    environment: production    # ← GitHub injects production secrets (different values)
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_ROLE_TO_ASSUME }}
          # secrets.AWS_ROLE_TO_ASSUME is the PRODUCTION role here`,
    language: 'yaml',
  },
  {
    label: 'Manual approval gate (production)',
    detail: 'The production environment requires reviewer approval in GitHub before the deploy-prod job can start. No code needed — configured entirely in GitHub repo settings under Environments. The staging job must succeed first.',
    file: '.github/workflows/deploy-pipeline.yml',
    code: `jobs:
  deploy-staging:
    environment: staging       # no protection rule — auto-deploys
    needs: test

  deploy-prod:
    environment: production    # protected — requires reviewer approval
    needs: deploy-staging      # staging must pass first

# Configure in: GitHub repo → Settings → Environments → production
# Add required reviewers to block until someone approves.
# The job stays pending until approved or the timeout expires.`,
    language: 'yaml',
  },
  {
    label: 'Automated health check (cloud-agnostic)',
    detail: 'After every deploy, health-check.sh polls SERVICE_URL/health every 10s for up to 90s (120s in prod). The script exits 0 on the first HTTP 200. If it times out, the workflow immediately triggers the rollback step.',
    file: 'docs/cicd-template/scripts/health-check.sh',
    code: `#!/usr/bin/env bash
# Cloud-agnostic: works with any service that exposes GET /health → 200
SERVICE_URL="\${SERVICE_URL:?SERVICE_URL must be set}"
MAX_WAIT="\${MAX_WAIT:-90}"
elapsed=0

while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "\${SERVICE_URL}/health")
  if [ "$STATUS" = "200" ]; then
    echo "Health check passed (\${elapsed}s)"
    exit 0
  fi
  echo "  HTTP $STATUS — retrying in 10s"
  sleep 10 && elapsed=$((elapsed + 10))
done

echo "Health check FAILED after \${MAX_WAIT}s" && exit 1`,
    language: 'bash',
  },
  {
    label: 'Automated rollback — GCP Cloud Run',
    detail: 'On health check failure, rollback-gcp.sh finds the previous revision and shifts 100% of traffic back to it. Cloud Run keeps all revisions available for instant traffic switching.',
    file: 'docs/cicd-template/scripts/rollback-gcp.sh',
    code: `#!/usr/bin/env bash
# Finds the revision before the current one and routes 100% traffic to it
PREVIOUS=$(gcloud run revisions list \\
  --service="$SERVICE" \\
  --region="$REGION" \\
  --format="value(metadata.name)" \\
  --sort-by="~metadata.creationTimestamp" \\
  --limit=2 | tail -1)

echo "Rolling back to revision: \${PREVIOUS}"

gcloud run services update-traffic "$SERVICE" \\
  --region="$REGION" \\
  --to-revisions="\${PREVIOUS}=100"

# Instantaneous — no new containers, just traffic routing`,
    language: 'bash',
  },
  {
    label: 'Automated rollback — AWS ECS',
    detail: 'On health check failure, rollback-aws.sh retrieves the task definition ARN of the last stable deployment and updates the ECS service to use it. ECS handles draining and replacement of running tasks.',
    file: 'docs/cicd-template/scripts/rollback-aws.sh',
    code: `#!/usr/bin/env bash
# Gets the previous task definition from the deployments list and restores it
PREVIOUS_TD=$(aws ecs describe-services \\
  --cluster "$CLUSTER" \\
  --services "$SERVICE" \\
  --region "$REGION" \\
  --query 'services[0].deployments | sort_by(@, &createdAt) | [-2].taskDefinition' \\
  --output text)

echo "Rolling back to: \${PREVIOUS_TD}"

aws ecs update-service \\
  --cluster "$CLUSTER" \\
  --service "$SERVICE" \\
  --task-definition "$PREVIOUS_TD" \\
  --region "$REGION"`,
    language: 'bash',
  },
  {
    label: 'Dockerfile non-root enforcement (CC6.8)',
    detail: 'The test job scans all Dockerfiles before any deployment. If a service is missing a USER directive, the build fails immediately — no image is pushed, no deployment occurs. This catches regressions at the earliest possible point.',
    file: '.github/workflows/deploy-pipeline.yml',
    code: `- name: Dockerfile lint (non-root enforcement)
  run: |
    for f in $(find . -name Dockerfile -not -path "*/target/*"); do
      if ! grep -q "^USER " "$f"; then
        echo "FAIL: $f is missing a USER directive (CC6.8 non-root requirement)"
        exit 1
      fi
      echo "OK: $f"
    done
# If this fails, the deploy-staging and deploy-prod jobs never run.
# Pairs with terraform-soc2-baseline which enforces user: "65534" at the ECS layer.`,
    language: 'yaml',
  },
]

export function CicdCaseStudyPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const toggle = (idx: number) => setOpenIdx(openIdx === idx ? null : idx)

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">CI/CD Pipeline Template</h1>
            <p className="mt-1 text-sm text-amber-300/80">Cloud-agnostic · GCP Cloud Run + AWS ECS · GitHub Actions · Automated Rollback</p>
          </div>
          <div className="flex gap-2">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              ← Case studies
            </a>
            <a
              href="https://github.com/rodmen07/microservices/tree/main/.github/workflows"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              GitHub →
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          A cloud-agnostic GitHub Actions reference architecture for multi-environment deployments.
          Extends the InfraPortal CI/CD with dev → staging → prod promotion gates, automated
          health-check rollback on both GCP Cloud Run and AWS ECS, and environment-scoped OIDC
          secret injection. Designed to be forked and adapted.
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

      {/* Pipeline flow diagram */}
      <section className="forge-panel rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 backdrop-blur-xl">
        <h2 className="mb-4 text-base font-semibold text-amber-200">Promotion flow</h2>
        <div className="flex flex-wrap items-start gap-2 text-xs">
          {/* test */}
          <div className="rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-center">
            <div className="font-semibold text-zinc-200">test</div>
            <div className="mt-1 text-zinc-500">clippy · tests</div>
            <div className="mt-0.5 text-zinc-500">audit · lint</div>
          </div>
          <div className="flex items-center text-zinc-600 pt-3">→</div>
          {/* staging */}
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/8 px-3 py-2 text-center">
            <div className="font-semibold text-blue-200">deploy-staging</div>
            <div className="mt-1 text-zinc-400">OIDC auth</div>
            <div className="mt-0.5 text-zinc-400">build + push</div>
            <div className="mt-0.5 text-zinc-400">deploy</div>
            <div className="mt-1 text-emerald-400 text-[10px]">✓ health check</div>
            <div className="text-red-400 text-[10px]">↩ rollback on fail</div>
          </div>
          <div className="flex items-center text-zinc-600 pt-3">→</div>
          {/* approval gate */}
          <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-center">
            <div className="font-semibold text-amber-200">⏸ approval</div>
            <div className="mt-1 text-zinc-400">required reviewers</div>
            <div className="mt-0.5 text-zinc-400">GitHub env gate</div>
          </div>
          <div className="flex items-center text-zinc-600 pt-3">→</div>
          {/* prod */}
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/8 px-3 py-2 text-center">
            <div className="font-semibold text-emerald-200">deploy-prod</div>
            <div className="mt-1 text-zinc-400">OIDC auth</div>
            <div className="mt-0.5 text-zinc-400">promote image</div>
            <div className="mt-0.5 text-zinc-400">deploy</div>
            <div className="mt-1 text-emerald-400 text-[10px]">✓ health check</div>
            <div className="text-red-400 text-[10px]">↩ rollback on fail</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded border border-zinc-700/40 bg-zinc-800/40 px-3 py-2">
            <span className="font-semibold text-zinc-300">GCP rollback</span>
            <span className="ml-2 text-zinc-500">gcloud run update-traffic → PREVIOUS=100</span>
          </div>
          <div className="rounded border border-zinc-700/40 bg-zinc-800/40 px-3 py-2">
            <span className="font-semibold text-zinc-300">AWS rollback</span>
            <span className="ml-2 text-zinc-500">ecs update-service → previous task definition</span>
          </div>
        </div>
      </section>

      {/* Expandable highlights */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Implementation highlights</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Click any item to see the workflow or script</p>
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
                    <CodeBlock code={code} language={language ?? 'yaml'} file={file} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <BuildStatusSection />

      {/* CTA */}
      <div className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
        <p className="text-sm text-zinc-400">Want this pipeline pattern for your team?</p>
        <a
          href="#/contact"
          className="mt-3 inline-block rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-400/60 hover:bg-amber-500/25"
        >
          Let's talk →
        </a>
      </div>
    </PageLayout>
  )
}
