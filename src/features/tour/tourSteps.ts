// The guided product tour, as data. A scripted path that walks a first-time
// visitor through the real product surfaces (all backed by the mocked demo
// store, so nothing depends on a live backend) with short narration, so a
// recruiter who will not click around still sees the product work.
//
// Kept as pure data + pure navigation (tourNav.ts) so the script is
// unit-testable; GuidedTour.tsx is the thin overlay that renders it and
// deep-links to each `href` as the visitor advances.

export interface TourStep {
  /** Stable unique id (React key, tests). */
  id: string
  /** Short heading for the step card. */
  title: string
  /** One or two sentences of narration. */
  body: string
  /** The route this step showcases; entering the step navigates here. Omit for
   *  an intro/outro step that does not move the visitor. */
  href?: string
}

export const TOUR: TourStep[] = [
  {
    id: 'intro',
    title: 'Take the 60-second tour',
    body: 'A quick guided walk through the InfraPortal platform: a real, self-built microservices system with a live status board, an API playground, an admin console, and a client portal. Use Next to move through it; Skip to leave any time.',
  },
  {
    id: 'status',
    title: 'Live platform status',
    body: 'Real-time health of the microservices platform, read straight from the API gateway: per-service status, HTTP codes, and latency, refreshing on its own.',
    href: '#/status',
  },
  {
    id: 'api',
    title: 'Interactive API playground',
    body: 'Every service ships an OpenAPI spec you can browse and try here: pick a service, expand an operation, and send a request against the mocked demo API.',
    href: '#/api-docs',
  },
  {
    id: 'crm',
    title: 'CRM admin console',
    body: 'The admin surface for the CRM services: accounts, contacts, activities, opportunities, plus bulk operations and deliverable templates, all wired to a shared in-browser demo store with an honest demo badge.',
    href: '#/crm/admin',
  },
  {
    id: 'finish',
    title: "That's the platform",
    body: 'Everything you just saw was designed, built, and deployed solo. If you are hiring or have a project in mind, a call is the fastest next step.',
    href: '#/contact',
  },
]
