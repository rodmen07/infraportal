import { createContext, useEffect, useState, type ReactNode } from 'react'

export interface AuthClaims {
  sub: string
  roles: string[]
  exp: number
  username?: string
  email?: string
}

interface AuthContextValue {
  token: string | null
  claims: AuthClaims | null
  login: (token: string) => void
  logout: () => void
  isClient: boolean
  isAdmin: boolean
}

const STORAGE_KEY = 'portal_token'

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/**
 * Role membership, never substring. A non-array claim yields NO roles rather
 * than being handed to `Array.prototype.includes` — when `roles` arrived as a
 * string, `roles.includes('admin')` was `String.prototype.includes`, so
 * `"non-admin"` satisfied the admin gate; when it arrived as anything else,
 * `.includes` did not exist and the read threw during render.
 */
const asRoles = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((role): role is string => typeof role === 'string') : []

/**
 * Typed decode of an UNVERIFIED payload. The client never checks the
 * signature, and the token can arrive from `?token=` / `#token=` in any link,
 * so `JSON.parse` output is attacker-shaped `unknown` and every claim is
 * narrowed before it reaches a consumer. Rejecting the token is the
 * fail-closed answer for the two claims that identify the session (`sub`,
 * `exp`); the display claims are simply dropped, since a missing username was
 * already a supported state.
 */
function decodeJwt(token: string): AuthClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const raw: unknown = JSON.parse(json)
    if (typeof raw !== 'object' || raw === null) return null
    const claims = raw as Record<string, unknown>

    const sub = asString(claims.sub)
    if (!sub) return null

    // A non-numeric `exp` used to mean the session NEVER expired, because
    // `Date.now() / 1000 > NaN` is false. `src/config.ts` already guards its
    // own decoder with `typeof payload.exp === 'number'`.
    const exp = claims.exp
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null
    if (Date.now() / 1000 > exp) return null

    return {
      sub,
      exp,
      roles: asRoles(claims.roles),
      username: asString(claims.username),
      email: asString(claims.email),
    }
  } catch {
    return null
  }
}

function loadStoredToken(): { token: string; claims: AuthClaims } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const claims = decodeJwt(stored)
    if (!claims) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { token: stored, claims }
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  claims: null,
  login: () => {},
  logout: () => {},
  isClient: false,
  isAdmin: false,
})

export { AuthContext }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [claims, setClaims] = useState<AuthClaims | null>(null)

  useEffect(() => {
    // Check URL search params for token (e.g. ?token=...)
    const params = new URLSearchParams(window.location.search)
    let urlToken = params.get('token')

    // Also check hash fragment — the auth service appends #token=... to hash-based
    // redirect URIs, producing patterns like #/some-route#token=...
    if (!urlToken) {
      const tokenMatch = window.location.hash.match(/#token=([^&#]+)/)
      if (tokenMatch) urlToken = tokenMatch[1]
    }

    if (urlToken) {
      const decoded = decodeJwt(urlToken)
      if (decoded) {
        localStorage.setItem(STORAGE_KEY, urlToken)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(urlToken)
        setClaims(decoded)
        // Remove the token from the URL, preserving the hash route. The query
        // string is rebuilt through URLSearchParams rather than regex-spliced:
        // `search.replace(/[?&]token=[^&#]+/, '')` consumed the leading `?`
        // whenever `token` came FIRST, so `?token=X&plan=pro` was rewritten
        // into the path as `&plan=pro`.
        const cleanHash = window.location.hash.replace(/#token=[^&#]+/, '')
        params.delete('token')
        const query = params.toString()
        const cleanSearch = query ? `?${query}` : ''
        const cleanUrl = `${window.location.pathname}${cleanSearch}${cleanHash}`
        window.history.replaceState(null, '', cleanUrl)
        // Re-fire hashchange so the hash router re-reads the cleaned hash
        window.dispatchEvent(new Event('hashchange'))
        return
      }
    }

    // Fall back to localStorage
    const stored = loadStoredToken()
    if (stored) {
      setToken(stored.token)
      setClaims(stored.claims)
    }
  }, [])

  const login = (newToken: string) => {
    const decoded = decodeJwt(newToken)
    if (!decoded) return
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setClaims(decoded)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setClaims(null)
  }

  const roles = claims?.roles ?? []

  return (
    <AuthContext.Provider
      value={{
        token,
        claims,
        login,
        logout,
        isClient: roles.includes('client'),
        isAdmin: roles.includes('admin'),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
