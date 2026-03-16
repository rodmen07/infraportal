import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { CodeBlock } from '../features/consulting/CodeBlock'
import { MedallionDemo } from '../features/site/MedallionDemo'

const TECH_STACK = ['Terraform', 'GCP', 'AWS', 'Secret Manager', 'Secrets Manager', 'KMS', 'CloudTrail', 'Cloud Audit Logs', 'VPC', 'IAM', 'OIDC', 'Workload Identity Federation', 'ECS / Fargate']

const CONTROLS: [string, string, string, string, string][] = [
  ['CC6.1', 'Logical access',         'GCP', 'Per-service SA; no roles/owner or roles/editor',              'modules/gcp/iam.tf'],
  ['CC6.1', 'Logical access',         'AWS', 'Per-service IAM role; resource-scoped ARNs; no wildcard actions','modules/aws/iam.tf'],
  ['CC6.2', 'Authentication',          'GCP', 'Workload Identity Federation — no SA key files issued',        'modules/gcp/iam.tf'],
  ['CC6.2', 'Authentication',          'AWS', 'OIDC role assumption — no long-lived access keys',            'modules/aws/iam.tf'],
  ['CC6.3', 'Privileged access',       'GCP', 'roles/cloudsql.client + roles/secretmanager.secretAccessor only', 'modules/gcp/iam.tf'],
  ['CC6.3', 'Privileged access',       'AWS', 'Inline policies scoped to exact resource ARNs',               'modules/aws/iam.tf'],
  ['CC6.7', 'Secrets management',      'GCP', 'Secret Manager auto-replication; SA-bound IAM; prevent_destroy','modules/gcp/secrets.tf'],
  ['CC6.7', 'Secrets management',      'AWS', 'Secrets Manager + KMS CMK with key rotation; resource policy', 'modules/aws/secrets.tf'],
  ['CC6.8', 'Non-root containers',     'GCP', 'Artifact Registry; Dockerfile USER requirement + CI lint check','modules/gcp/containers.tf'],
  ['CC6.8', 'Non-root containers',     'AWS', 'ECR immutable tags; ECS task user: "65534"; drop: ["ALL"]',   'modules/aws/containers.tf'],
  ['CC7.2', 'System monitoring',       'GCP', 'Cloud Audit Logs DATA_READ/WRITE for SM, SQL, Run + GCS sink', 'modules/gcp/audit.tf'],
  ['CC7.2', 'System monitoring',       'AWS', 'CloudTrail multi-region, log file validation, S3 versioning',  'modules/aws/audit.tf'],
  ['CC7.3', 'Incident detection',      'GCP', 'Cloud Monitoring alert on Secret Manager access spike',       'modules/gcp/audit.tf'],
  ['CC7.3', 'Incident detection',      'AWS', 'CloudWatch alarm on root account usage',                      'modules/aws/audit.tf'],
  ['CC8.1', 'Change management',       'GCP', 'prevent_destroy on secrets; state backend documented',        'modules/gcp/secrets.tf'],
  ['CC8.1', 'Change management',       'AWS', 'S3 versioning on trail bucket; DynamoDB state lock example',  'modules/aws/audit.tf'],
  ['A1.2',  'Availability',            'GCP', 'Cloud Run min_instances; Cloud SQL backups enabled',          'modules/gcp/containers.tf'],
  ['A1.2',  'Availability',            'AWS', 'Multi-AZ subnets; ECS desired_count = 2; min_healthy = 100%', 'modules/aws/containers.tf'],
]

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
      ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
      : 'border-orange-500/40 bg-orange-500/10 text-orange-300'

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">SOC 2 Baseline — Terraform Module</h1>
            <p className="mt-1 text-sm text-amber-300/80">Cloud-agnostic · GCP + AWS · IaC · 9 SOC 2 Type II Controls</p>
          </div>
          <div className="flex gap-2">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              ← Case studies
            </a>
            <a
              href="https://github.com/rodmen07/microservices/tree/main/terraform-soc2-baseline"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              GitHub →
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          A standalone, reusable Terraform module extracted from the InfraPortal v0.2 security hardening
          release. Cloud-agnostic by design: parallel GCP and AWS sub-modules implement the same 9 SOC 2
          Type II controls with an identical variable interface. Each control maps directly to the
          Terraform resource that implements it.
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

      {/* Cloud-agnostic callout */}
      <section className="forge-panel rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 backdrop-blur-xl">
        <h2 className="text-base font-semibold text-amber-200">Cloud-agnostic design</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          The module exposes two sub-modules — <code className="rounded bg-zinc-800 px-1 text-amber-300">modules/gcp/</code> and <code className="rounded bg-zinc-800 px-1 text-amber-300">modules/aws/</code> — with identical variable names and output shapes. Switching clouds means changing the module source path, not rewriting your infrastructure configuration.
        </p>
        <div className="mt-3 flex gap-2">
          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${cloudColor('GCP')}`}>GCP</span>
          <span className="text-xs text-zinc-500">Secret Manager · Cloud Audit Logs · Workload Identity · Artifact Registry · VPC</span>
        </div>
        <div className="mt-1.5 flex gap-2">
          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${cloudColor('AWS')}`}>AWS</span>
          <span className="text-xs text-zinc-500">Secrets Manager · CloudTrail · OIDC · ECR · VPC + NAT</span>
        </div>
      </section>

      {/* SOC 2 compliance mapping table */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">SOC 2 Type II — Control Mapping</h2>
          <p className="mt-0.5 text-xs text-zinc-500">9 controls · each maps to the Terraform file that implements it</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700/40 text-left">
                <th className="px-4 py-2.5 font-semibold text-zinc-400">Control</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-400">Cloud</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-400">Implementation</th>
                <th className="px-4 py-2.5 font-semibold text-zinc-400 hidden sm:table-cell">Evidence File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {CONTROLS.map(([control, desc, cloud, impl, file]) => (
                <tr key={`${control}-${cloud}`} className="transition hover:bg-zinc-800/20">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="font-mono font-semibold text-amber-300">{control}</span>
                    <span className="ml-2 text-zinc-500">{desc}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cloudColor(cloud)}`}>{cloud}</span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-300">{impl}</td>
                  <td className="px-4 py-2.5 font-mono text-zinc-500 hidden sm:table-cell">{file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live pipeline — CloudTrail feeds directly into this */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Audit logs in the medallion pipeline</h2>
          <p className="mt-1 text-sm text-zinc-400">
            CloudTrail events (CC7.2) land directly in Bronze as raw payloads, get normalised into Silver, and roll up into Gold metrics — the same idempotency guarantees from the DynamoDB prototype applied to compliance data.
          </p>
        </div>
        <MedallionDemo defaultLayer="bronze" />
      </section>

      {/* Expandable implementation highlights */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Implementation highlights</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Click any item to see the Terraform</p>
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
        <p className="text-sm text-zinc-400">Need a SOC 2 baseline for your infrastructure?</p>
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
