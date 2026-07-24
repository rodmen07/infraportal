// The command index for the Cmd/Ctrl-K command palette.
//
// Pages come from PRIMARY_NAV_ITEMS so the palette and the nav cannot drift.
// Everything reachable but NOT in the marketing nav (the public status board,
// the case studies, the client portal, and a couple of high-intent actions) is
// added explicitly here, which is exactly what a command palette is for: fast
// keyboard access to destinations the nav does not surface.
//
// This module is pure and data-only so the whole index is unit-testable in the
// repo's node test environment; the palette component is a thin shell over it.

import { PRIMARY_NAV_ITEMS } from '../layout/navItems'

export type CommandGroup = 'Pages' | 'Case studies' | 'Platform' | 'Actions'

export interface Command {
  /** Stable unique id (used as a React key and in tests). */
  id: string
  /** The label shown in the palette. */
  label: string
  /** Hash route or full URL to navigate to on select. */
  href: string
  /** Grouping header in the palette. */
  group: CommandGroup
  /** Extra search terms that should match this command but are not in the label. */
  keywords?: string[]
  /** When true, open in a new tab (external links). */
  external?: boolean
}

// Pages, derived from the marketing nav so they stay in sync.
const PAGE_COMMANDS: Command[] = PRIMARY_NAV_ITEMS.map((item) => ({
  id: `page:${item.href}`,
  label: item.label,
  href: item.href,
  group: 'Pages',
}))

// Destinations and actions the nav intentionally does not list.
const EXTRA_COMMANDS: Command[] = [
  {
    id: 'platform:status',
    label: 'Platform status',
    href: '#/status',
    group: 'Platform',
    keywords: ['health', 'uptime', 'incidents', 'services', 'live'],
  },
  {
    id: 'platform:api-docs',
    label: 'API playground',
    href: '#/api-docs',
    group: 'Platform',
    keywords: ['openapi', 'swagger', 'endpoints', 'try it', 'reference'],
  },
  {
    id: 'platform:portal',
    label: 'Client portal',
    href: '#/portal',
    group: 'Platform',
    keywords: ['login', 'sign in', 'projects', 'account'],
  },
  {
    id: 'case:microservices',
    label: 'Case study: Microservices platform',
    href: '#/case-studies/microservices-platform',
    group: 'Case studies',
    keywords: ['rust', 'axum', 'cloud run', 'gcp', 'solo'],
  },
  {
    id: 'case:soc2',
    label: 'Case study: SOC 2 Terraform module',
    href: '#/case-studies/soc2-terraform-module',
    group: 'Case studies',
    keywords: ['compliance', 'terraform', 'security', 'iac'],
  },
  {
    id: 'case:cicd',
    label: 'Case study: CI/CD pipeline template',
    href: '#/case-studies/cicd-pipeline-template',
    group: 'Case studies',
    keywords: ['github actions', 'pipeline', 'deploy', 'automation'],
  },
  {
    id: 'case:migration',
    label: 'Case study: Fly.io to Google Cloud migration',
    href: '#/case-studies/fly-to-gcp-migration',
    group: 'Case studies',
    keywords: ['fly', 'gcp', 'migration', 'cloud run'],
  },
  {
    id: 'case:dynamodb',
    label: 'Case study: DynamoDB idempotency',
    href: '#/case-studies/dynamodb-idempotency',
    group: 'Case studies',
    keywords: ['aws', 'dynamodb', 'idempotency', 'exactly once'],
  },
  {
    id: 'action:book-call',
    label: 'Book a call',
    href: '#/contact',
    group: 'Actions',
    keywords: ['contact', 'hire', 'consult', 'discovery', 'get in touch'],
  },
  {
    id: 'action:pricing',
    label: 'See pricing and retainers',
    href: '#/pricing',
    group: 'Actions',
    keywords: ['cost', 'rates', 'retainer', 'quote'],
  },
]

/** The full command index, pages first. */
export const COMMANDS: Command[] = [...PAGE_COMMANDS, ...EXTRA_COMMANDS]

/** Display order for group headers in the palette. */
export const GROUP_ORDER: CommandGroup[] = ['Pages', 'Platform', 'Case studies', 'Actions']
