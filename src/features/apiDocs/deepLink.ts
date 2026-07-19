/**
 * Sharable deep links for the API docs page (v1.17.3).
 *
 * The site uses a hash router, so a deep link is a fragment of the form
 * `#/api-docs?service=accounts&op=listAccounts`. The query string lives
 * INSIDE the fragment (after the route path), which keeps GitHub Pages
 * serving the same index.html for every link. Parsing and serialization are
 * pure so they round-trip under test; the explorer (ApiSpecExplorer.tsx)
 * owns the DOM side (selection, expand, scroll).
 */

export const API_DOCS_HASH = '#/api-docs'

export interface ApiDocsTarget {
  /** Service id from the spec manifest (e.g. "accounts"). */
  service?: string
  /** operationId within that service's spec (e.g. "listAccounts"). */
  op?: string
}

/**
 * Parses a window.location.hash value. Returns null when the hash is not an
 * API docs route at all; returns a target (possibly empty) when it is.
 * Blank parameter values are treated as absent.
 */
export function parseApiDocsHash(hash: string): ApiDocsTarget | null {
  if (hash === API_DOCS_HASH) return {}
  if (!hash.startsWith(`${API_DOCS_HASH}?`)) return null
  const params = new URLSearchParams(hash.slice(API_DOCS_HASH.length + 1))
  const target: ApiDocsTarget = {}
  const service = params.get('service')
  if (service) target.service = service
  const op = params.get('op')
  if (op) target.op = op
  return target
}

/** Serializes a target back to a hash. Empty targets yield the bare route. */
export function buildApiDocsHash(target: ApiDocsTarget = {}): string {
  const params = new URLSearchParams()
  if (target.service) params.set('service', target.service)
  if (target.op) params.set('op', target.op)
  const query = params.toString()
  return query === '' ? API_DOCS_HASH : `${API_DOCS_HASH}?${query}`
}

/**
 * Builds an absolute (or base-relative) link by replacing any existing
 * fragment on `href` with the target's hash. Callers pass
 * window.location.href at click time; nothing here touches browser globals.
 */
export function buildApiDocsLink(target: ApiDocsTarget, href: string): string {
  return `${href.split('#')[0]}${buildApiDocsHash(target)}`
}
