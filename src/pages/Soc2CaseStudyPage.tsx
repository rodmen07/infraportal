import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { CodeBlock } from '../features/consulting/CodeBlock'
import { MedallionDemo } from '../features/site/MedallionDemo'
import { Soc2ControlMatrix } from '../features/soc2/Soc2ControlMatrix'
import { CONTROL_COUNT } from '../features/soc2/soc2Controls'

const TECH_STACK = ['Terraform', 'GCP', 'AWS', 'Secret Manager', 'Secrets Manager', 'KMS', 'CloudTrail', 'Cloud Audit Logs', 'VPC', 'IAM', 'OIDC', 'Workload Identity Federation', 'ECS / Fargate']

const HIGHLIGHTS: { label: string; detail: string; file: string; code: string; language?: string }[] = [
  {
    label: 'IAM least-privilege — per-service identities (GCP + AWS)',
    detail: 'Each service gets a dedicated identity with only the roles it needs. No wildcard actions, no admin roles. GCP uses service accounts; AWS uses IAM roles with inline policies scoped to exact resource ARNs.',
    file: 'modules/gcp/iam.tf + modules/aws/iam.tf',
    code: `# GCP — per-service SA with only the roles it needs
resource "google_project_iam_member" "secret_accessor" {
  for_each = toset(var.services)
  project  = var.project_id
  role     = "roles/secretmanager.secretAccessor"  # read-only, no admin
  member   = "serviceAccount:\${google_service_account.service[each.key].email}"
}

# AWS — inline policy scoped to this service's secrets prefix only
resource "aws_iam_role_policy" "service_secrets" {
  for_each = toset(var.services)
  role     = aws_iam_role.service_task[each.key].id
  policy = jsonencode({
    Statement = [{
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = "arn:aws:secretsmanager:REGION:ACCOUNT:secret:prod/\${each.key}/*"
      # No wildcard resource — scoped to this service's prefix only
    }]
  })
}`,
    language: 'hcl',
  },
  {
    label: 'Secrets management with KMS encryption (GCP + AWS)',
    detail: 'Secrets are stored in managed secret stores, never in Terraform state. GCP uses Secret Manager with SA-bound IAM and prevent_destroy. AWS uses Secrets Manager with a customer-managed KMS key and 30-day recovery window.',
    file: 'modules/gcp/secrets.tf + modules/aws/secrets.tf',
    code: `# GCP — secret with prevent_destroy so Terraform can't delete live secrets
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "AUTH_JWT_SECRET"
  replication { auto {} }
  lifecycle { prevent_destroy = true }
}

# AWS — KMS CMK with automatic rotation for secret encryption
resource "aws_kms_key" "secrets" {
  description         = "CMK for Secrets Manager"
  enable_key_rotation = true           # CC6.7: rotated automatically
  deletion_window_in_days = 30
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "production/auth/jwt-secret"
  kms_key_id              = aws_kms_key.secrets.arn
  recovery_window_in_days = 30
}`,
    language: 'hcl',
  },
  {
    label: 'Audit logging with long-term retention (GCP + AWS)',
    detail: 'All data access to secrets, databases, and compute is logged and routed to immutable storage. GCP routes Cloud Audit Logs to a GCS bucket; AWS uses multi-region CloudTrail with S3 versioning and log file validation.',
    file: 'modules/gcp/audit.tf + modules/aws/audit.tf',
    code: `# GCP — log sink: all Cloud Audit Logs → GCS with 365-day retention
resource "google_logging_project_sink" "audit_sink" {
  destination            = "storage.googleapis.com/\${google_storage_bucket.audit_logs.name}"
  filter                 = "logName:(cloudaudit.googleapis.com)"
  unique_writer_identity = true
}

# Enable DATA_READ and DATA_WRITE for Secret Manager
resource "google_project_iam_audit_config" "secret_manager" {
  service = "secretmanager.googleapis.com"
  audit_log_config { log_type = "DATA_READ"  }
  audit_log_config { log_type = "DATA_WRITE" }
}

# AWS — multi-region CloudTrail with tamper-evident log file validation
resource "aws_cloudtrail" "main" {
  is_multi_region_trail      = true
  enable_log_file_validation = true  # detects log tampering
  kms_key_id                 = aws_kms_key.secrets.arn
}`,
    language: 'hcl',
  },
  {
    label: 'Non-root container enforcement (GCP + AWS)',
    detail: 'AWS ECS task definitions explicitly set user: "65534" (nobody) and drop all Linux capabilities. GCP enforces the USER directive via CI Dockerfile linting in the deploy pipeline. Neither platform allows privileged containers.',
    file: 'modules/aws/containers.tf + docs/cicd-template/scripts',
    code: `# AWS ECS task definition — CC6.8 non-root enforcement
container_definitions = jsonencode([{
  user                   = "65534"   # nobody — not root
  readonlyRootFilesystem = true
  privileged             = false
  linuxParameters = {
    capabilities = { drop = ["ALL"] }  # zero Linux capabilities
  }
}])

# GCP — CI pipeline lint step (deploy-pipeline.yml)
# Fails the build if any Dockerfile is missing a USER directive
for f in $(find . -name Dockerfile -not -path "*/target/*"); do
  if ! grep -q "^USER " "$f"; then
    echo "FAIL: $f missing USER directive (CC6.8 non-root requirement)"
    exit 1
  fi
done`,
    language: 'hcl',
  },
  {
    label: 'OIDC — no long-lived credentials in CI/CD (GCP + AWS)',
    detail: 'Both cloud providers authenticate via OIDC token exchange — GitHub Actions requests a short-lived token that is exchanged for cloud credentials at runtime. No static access keys or SA JSON key files are stored anywhere.',
    file: 'modules/gcp/iam.tf + modules/aws/iam.tf + .github/workflows/deploy-pipeline.yml',
    code: `# AWS — OIDC trust policy: only this repo's Actions tokens can assume this role
data "aws_iam_policy_document" "github_oidc_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:YOUR_ORG/YOUR_REPO:*"]
    }
  }
}

# GitHub Actions workflow — GCP WIF (no SA key file)
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: \${{ secrets.GCP_WIF_PROVIDER }}
    service_account: \${{ secrets.GCP_SERVICE_ACCOUNT }}`,
    language: 'hcl',
  },
]

export function Soc2CaseStudyPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const toggle = (idx: number) => setOpenIdx(openIdx === idx ? null : idx)

  const cloudColor = (cloud: string) =>
    cloud === 'GCP'
      ? 'border-blue-500/40 bg-blue-500/10 text-info-text'
      : 'border-orange-500/40 bg-orange-500/10 text-caution-text'

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">SOC 2 Baseline — Terraform Module</h1>
            <p className="mt-1 text-sm text-amber-300/80">Cloud-agnostic · GCP + AWS · IaC · {CONTROL_COUNT} SOC 2 Type II Controls</p>
          </div>
          <div className="flex gap-2">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-zinc-500/60 hover:text-text-primary"
            >
              ← Case studies
            </a>
            <a
              href="https://github.com/rodmen07/microservices/tree/main/terraform-soc2-baseline"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-zinc-500/60 hover:text-text-primary"
            >
              GitHub →
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          A standalone, reusable Terraform module extracted from the InfraPortal v0.2 security hardening
          release. Cloud-agnostic by design: parallel GCP and AWS sub-modules cover {CONTROL_COUNT} SOC 2
          Type II controls with an identical variable interface. The matrix below maps every
          control-cloud cell to its evidence — and records the cells that are not covered yet, because a
          compliance table that cannot say "gap" cannot be trusted to say "covered".
        </p>
      </section>

      {/* Tech stack */}
      <div className="flex flex-wrap gap-2">
        {TECH_STACK.map((tech) => (
          <span
            key={tech}
            className="rounded border border-zinc-700/50 bg-surface-control px-2.5 py-1 text-xs font-medium text-text-secondary"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Cloud-agnostic callout */}
      <section className="forge-panel rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 backdrop-blur-xl">
        <h2 className="text-base font-semibold text-amber-200">Cloud-agnostic design</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The module exposes two sub-modules — <code className="rounded bg-zinc-800 px-1 text-amber-300">modules/gcp/</code> and <code className="rounded bg-zinc-800 px-1 text-amber-300">modules/aws/</code> — with identical variable names and output shapes. Switching clouds means changing the module source path, not rewriting your infrastructure configuration.
        </p>
        <div className="mt-3 flex gap-2">
          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${cloudColor('GCP')}`}>GCP</span>
          <span className="text-xs text-text-subtle">Secret Manager · Cloud Audit Logs · Workload Identity · Artifact Registry · VPC</span>
        </div>
        <div className="mt-1.5 flex gap-2">
          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${cloudColor('AWS')}`}>AWS</span>
          <span className="text-xs text-text-subtle">Secrets Manager · CloudTrail · OIDC · ECR · VPC + NAT</span>
        </div>
      </section>

      {/* SOC 2 control x cloud coverage matrix (SOC2-MATRIX-1) */}
      <Soc2ControlMatrix />

      {/* Live pipeline — CloudTrail feeds directly into this */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Audit logs in the medallion pipeline</h2>
          <p className="mt-1 text-sm text-text-muted">
            CloudTrail events (CC7.2) land directly in Bronze as raw payloads, get normalised into Silver, and roll up into Gold metrics — the same idempotency guarantees from the DynamoDB prototype applied to compliance data.
          </p>
        </div>
        <MedallionDemo defaultLayer="bronze" />
      </section>

      {/* Expandable implementation highlights */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Implementation highlights</h2>
          <p className="mt-0.5 text-xs text-text-subtle">Click any item to see the Terraform</p>
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
                <span className="shrink-0 text-scale-xs text-text-subtle">
                  {openIdx === idx ? '▲' : '▼'}
                </span>
              </button>
              <div className={`grid transition-all duration-200 ease-out ${openIdx === idx ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-3 px-5 pb-5 pt-1">
                    <p className="pl-4 text-sm leading-relaxed text-text-muted">{detail}</p>
                    <CodeBlock code={code} language={language ?? 'hcl'} file={file} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
        <p className="text-sm text-text-muted">Need a SOC 2 baseline for your infrastructure?</p>
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
