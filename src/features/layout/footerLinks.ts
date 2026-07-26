// ---------------------------------------------------------------------------
// Site-footer destinations (v1.20.3, ROADMAP decision D-3).
//
// Kept in its own module (not inside SiteFooter.tsx) for the same two reasons
// notFoundLinks.ts is: a test can import the list without tripping the repo's
// react-refresh/only-export-components rule, and the destinations become data
// a drift guard can resolve against the router vocabulary parsed out of
// src/main.tsx.
//
// WHY A FOOTER AND NOT A NAV ITEM. The status board (NF-1 PR2) shipped with no
// discoverable entry point: src/features/layout/navItems.test.ts records a
// deliberate decision keeping workspace and app items out of the marketing
// nav ("should NOT include Status item"), and until this milestone the site
// had no footer at all. D-3 resolves that by adding the footer rather than
// reopening the nav decision, so both guards can hold at once - and
// siteFooter.test.ts asserts exactly that pairing by reading BOTH lists.
//
// Every external URL here was resolved live before it shipped (2026-07-25):
// https://github.com/rodmen07 -> HTTP 200, and https://crates.io/users/rodmen07
// -> HTTP 200 with an `Accept: text/html` header (crates.io answers 404 to a
// bare curl on its HTML routes, which is why the naive probe lies), confirmed
// against the crates.io API, whose owner record for `svccat` is login
// `rodmen07`.
// ---------------------------------------------------------------------------

export interface FooterLink {
  /** Visible link text. Also the analytics label. */
  label: string
  /** A `#/...` hash route handled by src/main.tsx, or an absolute URL. */
  href: string
}

export const FOOTER_LINKS: readonly FooterLink[] = [
  { label: 'Platform status', href: '#/status' },
  { label: 'Contact', href: '#/contact' },
  { label: 'GitHub', href: 'https://github.com/rodmen07' },
  { label: 'crates.io', href: 'https://crates.io/users/rodmen07' },
]

/**
 * True for a destination that leaves this app. Derived from the href rather
 * than stored as a flag, so an entry cannot claim to be internal while
 * pointing at another origin (or the reverse) - there is only one source of
 * truth for the distinction, and the component and the tests both read it.
 */
export function isExternalFooterHref(href: string): boolean {
  return !href.startsWith('#')
}
