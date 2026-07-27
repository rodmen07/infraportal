// ---------------------------------------------------------------------------
// checkoutTier (2026-07-25): reads the purchased tier out of the URL that
// Stripe redirects a paying customer to, and renders it as a label.
//
// Extracted from CheckoutThankYouPage so the parsing has real unit coverage.
// That page shipped on 2026-06-26 (commit 512488f) with its tier parsing
// inline and untested, and it was born broken. See bug CHECKOUT-TIER-1.
//
// WHY BOTH SOURCES ARE READ
// -------------------------
// The site is a hash router, so a route's own query string belongs INSIDE the
// fragment (`#/checkout-thank-you?tier=retainer-weekly`), the convention
// `src/features/apiDocs/deepLink.ts` also follows. That is what the generator
// script now produces (`scripts/lib/checkoutRedirect.mjs`).
//
// But the three payment links that are LIVE on Stripe today were generated on
// 2026-06-26 by the old, broken code path, and their redirect URL is stored on
// Stripe's side, not in this repo. Those links send customers to
//
//     https://rodmen07.github.io/infraportal/?tier=retainer-weekly#/checkout-thank-you
//
// with the tier in the SEARCH component. Reading only the hash would leave
// every existing customer on the generic fallback until somebody re-ran the
// generator against the live Stripe account (a USER-ONLY paid-account action).
// So the reader accepts either position: the hash wins when both are present,
// and the search component is the compatibility path for links already in the
// wild. This is a tolerant READ, not a second convention for writing.
// ---------------------------------------------------------------------------

/** Query-parameter name carrying the purchased tier slug. */
export const TIER_PARAM = 'tier'

/** Shown when no tier can be recovered from the URL. */
export const FALLBACK_TIER_LABEL = 'your engagement'

function paramFromQuery(query: string, name: string): string | null {
  const value = new URLSearchParams(query).get(name)
  return value === null || value.trim() === '' ? null : value
}

/**
 * Extracts the tier slug from a hash-router location.
 *
 * @param hash `window.location.hash`, e.g. `#/checkout-thank-you?tier=project-deposit`
 * @param search `window.location.search`, the compatibility path for links
 *   generated before the CHECKOUT-TIER-1 fix
 * @returns the raw slug, or null when neither source carries one
 */
export function readCheckoutTier(hash: string, search = ''): string | null {
  const separator = hash.indexOf('?')
  const fromHash = separator === -1 ? null : paramFromQuery(hash.slice(separator + 1), TIER_PARAM)
  if (fromHash !== null) return fromHash

  const searchQuery = search.startsWith('?') ? search.slice(1) : search
  return paramFromQuery(searchQuery, TIER_PARAM)
}

/**
 * Renders a tier slug as prose ("retainer-weekly" -> "Retainer Weekly").
 * A null/blank slug yields the neutral fallback, so the page never renders an
 * empty phrase.
 */
export function formatTierLabel(tier: string | null): string {
  if (tier === null || tier.trim() === '') return FALLBACK_TIER_LABEL
  return tier.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

/** Convenience for the page: read then format, in one call. */
export function checkoutTierLabel(hash: string, search = ''): string {
  return formatTierLabel(readCheckoutTier(hash, search))
}

/** Emitted when no tier can be recovered, so the landing event still carries
 * an explicit, greppable value instead of an empty string. */
export const UNKNOWN_TIER_PARAM = '(none)'

/**
 * Analytics params for the checkout thank-you landing event (v1.22.1).
 *
 * Pure so the tier-carrying behavior has unit coverage independent of the
 * page: `tier` is the raw slug exactly as `readCheckoutTier` recovers it
 * (from either URL position, per the compatibility note above), and `label`
 * is the same prose the page renders, so a dashboard row and the customer's
 * screen can be matched one-to-one.
 */
export function checkoutLandingParams(hash: string, search = ''): { tier: string; label: string } {
  const tier = readCheckoutTier(hash, search)
  return { tier: tier ?? UNKNOWN_TIER_PARAM, label: formatTierLabel(tier) }
}
