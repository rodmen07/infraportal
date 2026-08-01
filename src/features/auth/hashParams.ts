/**
 * Query parameters carried on a hash-based URL.
 *
 * The portal runs on a hash router, so an emailed link looks like
 * `https://host/#/portal/register?token=abc&email=a%40b.com`: the query
 * component lives INSIDE the fragment, which is why `window.location.search`
 * is empty on these routes and the fragment has to be split by hand.
 *
 * Extracted from `PortalRegisterPage` / `PortalResetPasswordPage` in the
 * `set-state-in-effect` triage (DEP-MAJ-2 follow-up, 2026-08-01). Both pages
 * used to parse the hash inside a mount `useEffect` and `setState` from it,
 * which is a cascading render (the first paint showed the token as absent and
 * the email field as empty, and a keystroke landing in that window was
 * clobbered). As a pure function it can be read once by a `useState`
 * initializer instead, and it is directly testable without rendering.
 */

/**
 * The query component of a hash-based URL, e.g.
 * `#/portal/reset-password?token=abc` -> `token=abc`.
 *
 * The example deliberately names a real route: `routeIntegrity.test.ts` scans
 * every `#/...` literal in `src/`, including the ones inside comments, and a
 * made-up placeholder here would have to buy an exclusion entry.
 */
export function hashQueryParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.split('?')[1] ?? '')
}

/**
 * `decodeURIComponent` that yields the input unchanged instead of throwing.
 *
 * `URLSearchParams` has already percent-decoded its values, so the extra
 * decode below is a second pass. It is kept because it is the shipped
 * behaviour of the invite links already in the wild (a link generated with a
 * doubly-encoded address still resolves), but a value containing a bare `%`
 * makes a second decode throw `URIError`, which previously escaped a mount
 * effect and took the whole register page down. Falling back to the raw value
 * is the only divergence from the pre-extraction behaviour and it is
 * deliberate: a malformed invite link now renders an empty email field rather
 * than a blank page.
 */
function decodeOnceMore(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export interface InviteParams {
  /** The invite token, or `null` when the link carries none. */
  token: string | null
  /** The address to pre-fill, `''` when absent or when there is no token. */
  email: string
}

/**
 * Read the `token` / `email` pair off a portal invite link.
 *
 * `email` is only honoured alongside a `token`, matching the original page
 * logic: a bare `?email=` on the register route pre-filled nothing.
 */
export function parseInviteParams(hash: string): InviteParams {
  const params = hashQueryParams(hash)
  const token = params.get('token')
  if (!token) return { token: null, email: '' }
  const email = params.get('email')
  return { token, email: email ? decodeOnceMore(email) : '' }
}

/** Read the `token` off a password-reset link, `null` when absent. */
export function parseResetToken(hash: string): string | null {
  return hashQueryParams(hash).get('token')
}
