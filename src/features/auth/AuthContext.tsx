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

function decodeJwt(token: string): AuthClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as AuthClaims
    if (!claims.sub || !claims.exp) return null
    if (Date.now() / 1000 > claims.exp) return null
    return claims
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
        // Remove the token from the URL, preserving the hash route
        const cleanHash = window.location.hash.replace(/#token=[^&#]+/, '')
        const cleanSearch = window.location.search.replace(/[?&]token=[^&#]+/, '')
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
