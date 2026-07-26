// The one platform-health endpoint this site reads.
//
// Two surfaces consume it now (the `#/status` board and the home-page proof
// tile), so the URL lives here rather than being re-derived per caller: a
// duplicated base URL is exactly the kind of pair that drifts silently when
// one copy is updated and the other is not.

/** Gateway origin, overridable per-environment, never with a trailing slash. */
export const GATEWAY_URL = (
  import.meta.env.VITE_GATEWAY_URL ?? 'https://go-gateway-5gcrg4oiza-uc.a.run.app'
).replace(/\/$/, '')

/** The CORS-enabled upstream health aggregate (go-gateway PR #11). */
export const UPSTREAMS_URL = `${GATEWAY_URL}/health/upstreams`
