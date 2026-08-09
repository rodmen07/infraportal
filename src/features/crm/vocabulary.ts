/**
 * The CRM's controlled vocabularies, in ONE place.
 *
 * Every tuple here is the single UI-side source for a value set the services
 * enforce (or deliberately leave free-form). The tabs render their `<select>`
 * options and badge maps from these tuples, and `crmVocabulary.test.ts` locks
 * each tuple to the committed OpenAPI snapshot in `src/api-specs/`, so an
 * upstream vocabulary change pulled in by `npm run sync-specs` breaks the
 * build here instead of shipping a UI that offers values a service rejects
 * (the admin-UI status-drift class: projects deliverable statuses shipped
 * exactly that way once, and `projectStatusVocabulary.test.ts` is the
 * sibling guard that came out of it).
 *
 * Hand-written literals (not derived from the spec at build time) are
 * deliberate: TypeScript gets literal unions, and the admin bundle does not
 * ship the spec snapshots. The test is what keeps them honest.
 */

/** accounts-service `status` (enum enforced server-side, VALID_STATUSES). */
export const ACCOUNT_STATUSES = ['active', 'inactive', 'churned'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

/**
 * contacts-service `lifecycle_stage` (enum enforced server-side,
 * VALID_LIFECYCLE_STAGES; an unknown value is a 400).
 */
export const CONTACT_LIFECYCLE_STAGES = [
  'lead',
  'prospect',
  'customer',
  'churned',
  'evangelist',
] as const
export type ContactLifecycleStage = (typeof CONTACT_LIFECYCLE_STAGES)[number]

/**
 * opportunities-service `stage` is FREE-FORM upstream (no spec enum, no
 * server validation); this ordering is a UI choice. The guard test carries a
 * sentinel asserting the spec still has no enum, so the day upstream locks
 * the vocabulary, the sentinel reddens and this tuple gets locked to it.
 */
export const OPPORTUNITY_STAGES = [
  'qualification',
  'proposal',
  'negotiation',
  'closed-won',
  'closed-lost',
] as const
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]

/**
 * activities-service `activity_type` is FREE-FORM upstream (no spec enum);
 * same sentinel arrangement as OPPORTUNITY_STAGES.
 */
export const ACTIVITY_TYPES = ['email', 'call', 'meeting', 'task'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

/** spend-service `platform` (enum enforced server-side, VALID_PLATFORMS). */
export const SPEND_PLATFORMS = [
  'gcp',
  'flyio',
  'anthropic',
  'github_copilot',
  'github',
  'aws',
] as const
export type SpendPlatform = (typeof SPEND_PLATFORMS)[number]

/** spend-service `granularity` (enum enforced server-side). */
export const SPEND_GRANULARITIES = ['daily', 'monthly'] as const
export type SpendGranularity = (typeof SPEND_GRANULARITIES)[number]

/** spend-service `source` (spec enum; read-only in the UI, badge map only). */
export const SPEND_SOURCES = [
  'manual',
  'bigquery',
  'flyio_graphql',
  'github_api',
  'aws_cost_explorer',
] as const
export type SpendSource = (typeof SPEND_SOURCES)[number]

/**
 * The platforms with a live sync endpoint (`POST /spend/sync/{platform}`),
 * i.e. the spec's `SyncResult.platform` enum. A strict subset of
 * SPEND_PLATFORMS: anthropic and github_copilot are manual-entry only.
 */
export const SYNC_PLATFORMS = ['gcp', 'flyio', 'github', 'aws'] as const
export type SyncPlatform = (typeof SYNC_PLATFORMS)[number]

/**
 * Display labels for every spend platform. The `satisfies` clause makes a
 * missing or extra label a COMPILE error when SPEND_PLATFORMS changes, while
 * the `Record<string, string>` annotation keeps runtime lookups by API
 * strings (`record.platform`) index-safe.
 */
export const PLATFORM_LABELS: Record<string, string> = {
  gcp: 'GCP',
  flyio: 'Fly.io',
  anthropic: 'Anthropic',
  github_copilot: 'GitHub Copilot',
  github: 'GitHub',
  aws: 'AWS',
} satisfies Record<SpendPlatform, string>

/** Badge colours per spend platform (same exhaustiveness guarantee). */
export const PLATFORM_COLOR: Record<string, string> = {
  gcp: 'bg-blue-500/15 text-info-text ring-blue-500/30',
  flyio: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  anthropic: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  github_copilot: 'bg-green-500/15 text-success-text ring-green-500/30',
  github: 'bg-green-500/15 text-success-text ring-green-500/30',
  aws: 'bg-orange-500/15 text-caution-text ring-orange-500/30',
} satisfies Record<SpendPlatform, string>

/** Badge colours per spend source (same exhaustiveness guarantee). */
export const SOURCE_COLOR: Record<string, string> = {
  manual: 'bg-zinc-500/15 text-text-muted ring-zinc-500/30',
  bigquery: 'bg-blue-500/15 text-info-text ring-blue-500/30',
  flyio_graphql: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  github_api: 'bg-green-500/15 text-success-text ring-green-500/30',
  aws_cost_explorer: 'bg-orange-500/15 text-caution-text ring-orange-500/30',
} satisfies Record<SpendSource, string>
