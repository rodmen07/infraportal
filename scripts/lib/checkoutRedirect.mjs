// ---------------------------------------------------------------------------
// checkoutRedirect (2026-07-25): builds the post-checkout redirect URL that
// Stripe sends a paying customer to.
//
// Why this module exists (bug CHECKOUT-TIER-1):
// `setup-stripe-payment-links.mjs` used to build that URL with
//
//     const url = new URL(THANK_YOU_URL)      // .../infraportal/#/checkout-thank-you
//     url.searchParams.set('tier', slug)
//
// `URL.searchParams` writes the SEARCH component, which sits BEFORE the
// fragment, so the result was
//
//     https://rodmen07.github.io/infraportal/?tier=retainer-weekly#/checkout-thank-you
//
// while `CheckoutThankYouPage` reads the tier out of `window.location.hash`.
// The tier therefore never arrived and every paying customer saw the generic
// "your engagement" fallback instead of the tier they had just bought.
//
// This site is a HASH router: a route's own query string lives INSIDE the
// fragment, after the route path (`#/route?key=value`), the same convention
// `src/features/apiDocs/deepLink.ts` documents and implements for API-docs
// deep links. This module is the single source of truth for that shape, and
// is imported by both the generator script and its test so the two cannot
// drift.
// ---------------------------------------------------------------------------

/**
 * Adds query parameters to a URL, honouring the hash-router convention.
 *
 * When `baseUrl` carries a fragment (`#/checkout-thank-you`), the parameters
 * are appended INSIDE that fragment. When it carries none, they go in the
 * ordinary search component. Existing parameters on either side are preserved;
 * a repeated key is overwritten.
 *
 * @param {string} baseUrl absolute URL, optionally with a hash route
 * @param {Record<string, string>} params parameters to add
 * @returns {string} the resulting absolute URL
 */
export function buildCheckoutRedirectUrl(baseUrl, params) {
  const url = new URL(baseUrl)
  const entries = Object.entries(params)

  if (url.hash === '' || url.hash === '#') {
    // No hash route: the ordinary search component is the right place.
    for (const [key, value] of entries) url.searchParams.set(key, value)
    return url.toString()
  }

  const fragment = url.hash.slice(1)
  const separator = fragment.indexOf('?')
  const routePath = separator === -1 ? fragment : fragment.slice(0, separator)
  const existing = separator === -1 ? '' : fragment.slice(separator + 1)

  const search = new URLSearchParams(existing)
  for (const [key, value] of entries) search.set(key, value)

  const query = search.toString()
  url.hash = query === '' ? `#${routePath}` : `#${routePath}?${query}`
  return url.toString()
}
