// The SOC 2 baseline's control × cloud coverage, as data (SOC2-MATRIX-1).
//
// Source of truth: microservices/terraform-soc2-baseline (README control
// table + the module files each cell cites). That repo is not present in this
// site's CI checkout, so the cells are committed here with their evidence
// paths — same trade the topology model makes, and the same honesty rule:
// coverage that does not exist is recorded as an explicit gap, never implied
// by symmetry. CC9.2 is the live example: the control exists only as
// modules/gcp/cc9_2_vendor_risk.tf, with no AWS twin, and this matrix says
// so instead of leaving the row out.

export type CloudCell =
  | { readonly covered: true; readonly impl: string; readonly evidence: string }
  | { readonly covered: false; readonly note: string }

export interface Soc2Control {
  readonly id: string
  readonly name: string
  readonly gcp: CloudCell
  readonly aws: CloudCell
}

const cell = (impl: string, evidence: string): CloudCell => ({ covered: true, impl, evidence })

export const SOC2_CONTROLS: readonly Soc2Control[] = [
  {
    id: 'CC6.1',
    name: 'Logical access',
    gcp: cell('Per-service SA; no roles/owner or roles/editor', 'modules/gcp/iam.tf'),
    aws: cell('Per-service IAM role; resource-scoped ARNs; no wildcard actions', 'modules/aws/iam.tf'),
  },
  {
    id: 'CC6.2',
    name: 'Authentication',
    gcp: cell('Workload Identity Federation — no SA key files issued', 'modules/gcp/iam.tf'),
    aws: cell('OIDC role assumption — no long-lived access keys', 'modules/aws/iam.tf'),
  },
  {
    id: 'CC6.3',
    name: 'Privileged access',
    gcp: cell('roles/cloudsql.client + secretmanager.secretAccessor + run.invoker only', 'modules/gcp/iam.tf'),
    aws: cell('Inline policies scoped to exact resource ARNs', 'modules/aws/iam.tf'),
  },
  {
    id: 'CC6.7',
    name: 'Secrets management',
    gcp: cell('Secret Manager auto-replication; SA-bound IAM; prevent_destroy', 'modules/gcp/secrets.tf'),
    aws: cell('Secrets Manager + KMS CMK with key rotation; prefix-scoped task-role IAM', 'modules/aws/secrets.tf'),
  },
  {
    id: 'CC6.8',
    name: 'Non-root containers',
    gcp: cell('Artifact Registry; Dockerfile USER requirement + CI lint check', 'modules/gcp/containers.tf'),
    aws: cell('ECR immutable tags; ECS task user "65534"; capabilities dropped', 'modules/aws/containers.tf'),
  },
  {
    id: 'CC7.2',
    name: 'System monitoring',
    gcp: cell('Cloud Audit Logs DATA_READ/WRITE for SM, SQL, Run + GCS sink', 'modules/gcp/audit.tf'),
    aws: cell('CloudTrail multi-region, log file validation, S3 versioning', 'modules/aws/audit.tf'),
  },
  {
    id: 'CC7.3',
    name: 'Incident detection',
    gcp: cell('Cloud Monitoring alert on Secret Manager access spike', 'modules/gcp/audit.tf'),
    aws: cell('CloudWatch alarm on root account usage', 'modules/aws/audit.tf'),
  },
  {
    id: 'CC8.1',
    name: 'Change management',
    gcp: cell('prevent_destroy on secrets (state-backend guidance lives in the README)', 'modules/gcp/secrets.tf'),
    aws: cell('S3 versioning on trail bucket (state-lock pattern lives in the README)', 'modules/aws/audit.tf'),
  },
  {
    id: 'CC9.2',
    name: 'Vendor risk',
    gcp: cell('Vendor-labeled secrets, service review attestation labels, 5xx error-rate alert on Cloud Run services', 'modules/gcp/cc9_2_vendor_risk.tf'),
    aws: { covered: false, note: 'Not yet implemented — this control currently ships GCP-only' },
  },
  {
    id: 'A1.2',
    name: 'Availability',
    // The README's control table claims "Cloud SQL backups enabled" for this
    // cell, but no Cloud SQL resource or backup config exists anywhere in the
    // module, and min_instances appears only as a CI/CD-owned reference
    // comment — so this is a gap, not a covered cell (SOC2-MATRIX-1 review).
    gcp: {
      covered: false,
      note: 'min_instances is a CI/CD-owned reference comment only; no Cloud SQL or backup resource exists in the module',
    },
    aws: cell('Multi-AZ subnets; ECS desired_count 2; min_healthy 100%', 'modules/aws/containers.tf'),
  },
]

export const CONTROL_COUNT = SOC2_CONTROLS.length

const allCells = SOC2_CONTROLS.flatMap((c) => [c.gcp, c.aws])

export const TOTAL_CELLS = allCells.length

export const COVERED_CELLS = allCells.filter((c) => c.covered).length
