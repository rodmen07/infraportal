// ---------------------------------------------------------------------------
// homeRoute (2026-07-25): the single source of truth for "is this hash the
// Home route?", used by the router in src/main.tsx.
//
// Why it exists: before the NotFound page, the router's catch-all was
// `return <App />`, so EVERY unmatched hash — a typo'd deep link, a route
// renamed out of main.tsx, a stale bookmark — silently rendered Home with no
// error (the "shipped surface that silently does nothing" failure class the
// route-integrity guard was written to catch on the nav side). The catch-all
// is now `<NotFoundPage />`, which means the root/empty hash has to be routed
// to Home EXPLICITLY rather than by falling through. This pure predicate is
// that explicit check, extracted so its behaviour is unit-tested directly
// (the router tree itself is node-env-hostile and is only ever source-scanned
// in tests — see routeIntegrity.test.ts).
//
// The three forms are the ways a browser can present the site root:
//   ''    initial load, before any hash is set
//   '#'   a bare fragment (e.g. an `href="#"` click)
//   '#/'  the canonical Home href used by NAV_ITEMS and the TopNav logo
// ---------------------------------------------------------------------------

/** True only for the site-root hash forms; every other hash is a real route
 * (handled explicitly by the router) or unknown (handled by NotFound). */
export function isHomeHash(hash: string): boolean {
  return hash === '' || hash === '#' || hash === '#/'
}
