// @vitest-environment jsdom
/**
 * FIRST coverage of any kind for `src/features/auth/AuthContext.tsx`, the
 * module that decides who the visitor is and whether the admin and portal
 * surfaces render (L-014: the oldest untested surface beats deepening coverage
 * on new code). The file was added 2026-03-26 and last edited 2026-06-25;
 * before this suite, `grep -rn 'AuthContext|AuthProvider|useAuth|decodeJwt'`
 * over every `*.test.ts(x)` matched exactly two things, neither of them a
 * behavioural claim about this module: `pricingViewAnalytics.test.ts` mounts
 * `AuthProvider` purely as a context wrapper, and `envContract.test.ts`
 * mentions `portal_token` in a prose comment.
 *
 * WHY IT MATTERS THAT NOTHING TESTED IT. `decodeJwt` ends in
 * `JSON.parse(json) as AuthClaims`, and that cast is the whole bug: the
 * payload is attacker-shaped `unknown` (the client never verifies the
 * signature, and the token arrives from `?token=` / `#token=` in a link
 * anyone can send), yet only `sub` and `exp` were checked, and only for
 * truthiness. Four separate consequences, all reproduced below against the
 * real provider:
 *
 *   A. `roles: "non-admin"` made `isAdmin` TRUE. `roles.includes('admin')` is
 *      `String.prototype.includes` when the claim is a string, so the role
 *      gate degraded into a substring match; `"read-only-client"` likewise
 *      satisfied `isClient`.
 *   B. `roles: 123` threw `roles.includes is not a function` during render.
 *      `AuthProvider` wraps the entire app in `main.tsx`, so `RootBoundary`
 *      caught it and every route rendered "Main page did not load" - and
 *      because the URL path writes the token to `localStorage` BEFORE the
 *      throw, the failure survived reloads. One crafted link therefore bricked
 *      the whole site for that browser until storage was cleared by hand.
 *   C. `exp: 'not-a-date'` produced a session that never expires, because
 *      `Date.now() / 1000 > NaN` is `false`. The repo's own second decoder
 *      already knew better: `src/config.ts:40` guards with
 *      `typeof payload.exp === 'number'`.
 *   D. `sub: 12345` and `email: {...}` were handed straight to consumers that
 *      assume strings - `claims.sub.slice(0, 12)` at
 *      `src/features/portal/auth.tsx:191` and the `claims.email ?? ...`
 *      rendered as a React child on the same line.
 *
 * A fifth defect lives in the same effect: the URL cleanup regex
 * `search.replace(/[?&]token=[^&#]+/, '')` consumed the leading `?` whenever
 * `token` was the FIRST query parameter, so `?token=X&plan=pro` was rewritten
 * into the path as `&plan=pro` (contract F).
 *
 * HARNESS: the `react-dom/client` + `act` probe precedent from
 * `useResource.test.ts` / `pricingViewAnalytics.test.ts`, without StrictMode -
 * these are claims about what the deployed bundle does, and StrictMode's
 * double effect invocation is development-only. Every assertion drives the
 * real `AuthProvider`; nothing here re-implements `decodeJwt`.
 */
import { act, createElement, useContext } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, AuthProvider, type AuthClaims } from './AuthContext'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const STORAGE_KEY = 'portal_token'
const FUTURE = Math.floor(Date.now() / 1000) + 3600
const PAST = Math.floor(Date.now() / 1000) - 3600

let container: HTMLDivElement
let root: Root

interface Snapshot {
  token: string | null
  claims: AuthClaims | null
  isClient: boolean
  isAdmin: boolean
  login: (token: string) => void
  logout: () => void
}

let frames: Snapshot[] = []

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  frames = []
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

/** The `{ alg }.{ payload }.{ sig }` shape `decodeJwt` splits on, base64url-encoded. */
function tokenWith(payload: Record<string, unknown>): string {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_')
  return `${btoa(JSON.stringify({ alg: 'HS256' }))}.${body}.sig`
}

/** One frame per render, so an intermediate value cannot hide behind the last. */
function mount(): void {
  const Probe = () => {
    frames.push({ ...useContext(AuthContext) })
    return null
  }
  act(() => {
    root.render(createElement(AuthProvider, null, createElement(Probe)))
  })
}

const last = (): Snapshot => frames[frames.length - 1]

describe('AuthProvider: a well-formed session (positive controls)', () => {
  it('restores a stored token and reports exactly the roles it carries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      tokenWith({ sub: 'user-1', exp: FUTURE, roles: ['client', 'admin'], email: 'ada@example.com' }),
    )

    mount()

    expect(last().token).not.toBeNull()
    expect(last().claims?.sub).toBe('user-1')
    expect(last().claims?.email).toBe('ada@example.com')
    expect(last().claims?.roles).toEqual(['client', 'admin'])
    expect(last().isClient).toBe(true)
    expect(last().isAdmin).toBe(true)
  })

  it('drops a stored token that has genuinely expired, and purges it from storage', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 'user-1', exp: PAST, roles: ['client'] }))

    mount()

    expect(last().token).toBeNull()
    expect(last().claims).toBeNull()
    expect(last().isClient).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('login() opens a session and logout() closes it in both state and storage', () => {
    mount()
    expect(last().token).toBeNull()

    const good = tokenWith({ sub: 'user-2', exp: FUTURE, roles: ['client'] })
    act(() => last().login(good))

    expect(last().token).toBe(good)
    expect(last().isClient).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(good)

    act(() => last().logout())

    expect(last().token).toBeNull()
    expect(last().claims).toBeNull()
    expect(last().isClient).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('login() ignores an undecodable token rather than opening a half-session', () => {
    mount()

    act(() => last().login('not.a.jwt'))

    expect(last().token).toBeNull()
    expect(last().claims).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('contract A: the role gate is membership, never substring', () => {
  it('does not grant admin to a roles claim that merely CONTAINS "admin"', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 'user-1', exp: FUTURE, roles: 'non-admin' }))

    mount()

    // Pre-fix: `'non-admin'.includes('admin')` === true, so this read `true`.
    expect(last().isAdmin).toBe(false)
    expect(last().claims?.roles).toEqual([])
  })

  it('does not grant client to a roles claim that merely CONTAINS "client"', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 'user-1', exp: FUTURE, roles: 'read-only-client' }))

    mount()

    expect(last().isClient).toBe(false)
    expect(last().claims?.roles).toEqual([])
  })

  it('keeps only the string entries of a mixed roles array', () => {
    localStorage.setItem(
      STORAGE_KEY,
      tokenWith({ sub: 'user-1', exp: FUTURE, roles: ['client', 7, null, { role: 'admin' }] }),
    )

    mount()

    expect(last().claims?.roles).toEqual(['client'])
    expect(last().isClient).toBe(true)
    expect(last().isAdmin).toBe(false)
  })
})

describe('contract B: a hostile roles claim cannot take the site down', () => {
  it('survives a non-array roles claim delivered from storage', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 'user-1', exp: FUTURE, roles: 123 }))

    // Pre-fix: `roles.includes is not a function` escaped render, and in the
    // real app `RootBoundary` turned that into "Main page did not load".
    expect(() => mount()).not.toThrow()
    expect(last().isAdmin).toBe(false)
    expect(last().isClient).toBe(false)
  })

  it('survives the same claim delivered by a crafted ?token= link, which is what made it persist', () => {
    const crafted = tokenWith({ sub: 'user-1', exp: FUTURE, roles: { admin: true } })
    window.history.replaceState(null, '', `/?token=${crafted}`)

    expect(() => mount()).not.toThrow()
    expect(last().isAdmin).toBe(false)
    // The URL path writes to storage BEFORE the roles read, so pre-fix the
    // failure came back on every reload. Storage is asserted here so the
    // persistence half of the defect stays documented.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(crafted)
  })
})

describe('contract C: exp must be a number, or the session never expires', () => {
  it('rejects a token whose exp is a non-numeric string', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 'user-1', exp: 'not-a-date', roles: ['admin'] }))

    mount()

    // Pre-fix: `Date.now() / 1000 > 'not-a-date'` is `NaN > x` === false, so
    // the token read as un-expired forever and `isAdmin` was true.
    expect(last().token).toBeNull()
    expect(last().claims).toBeNull()
    expect(last().isAdmin).toBe(false)
  })

  it('rejects a numeric-looking string exp too, matching src/config.ts:40', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 'user-1', exp: '9999999999', roles: ['client'] }))

    mount()

    expect(last().token).toBeNull()
    expect(last().isClient).toBe(false)
  })

  it('rejects an object exp', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 'user-1', exp: {}, roles: ['client'] }))

    mount()

    expect(last().token).toBeNull()
  })
})

describe('contract D: sub, username and email reach consumers as strings or not at all', () => {
  it('rejects a non-string sub, which src/features/portal/auth.tsx:191 calls .slice() on', () => {
    localStorage.setItem(STORAGE_KEY, tokenWith({ sub: 12345, exp: FUTURE, roles: ['client'] }))

    mount()

    expect(last().claims).toBeNull()
    expect(last().token).toBeNull()
  })

  it('drops non-string username and email rather than passing objects to a React child', () => {
    localStorage.setItem(
      STORAGE_KEY,
      tokenWith({ sub: 'user-1', exp: FUTURE, roles: ['client'], email: { at: 'x' }, username: ['ada'] }),
    )

    mount()

    // The token itself is fine; only the display claims are unusable.
    expect(last().token).not.toBeNull()
    expect(last().claims?.email).toBeUndefined()
    expect(last().claims?.username).toBeUndefined()
  })
})

describe('contract E: the URL is cleaned without being corrupted', () => {
  function capturedUrl(): URL {
    const spy = vi.spyOn(window.history, 'replaceState')
    mount()
    const calls = spy.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    return new URL(String(calls[calls.length - 1][2]), window.location.origin)
  }

  it('keeps the query string well-formed when token is the FIRST parameter', () => {
    const good = tokenWith({ sub: 'user-1', exp: FUTURE, roles: ['client'] })
    window.history.replaceState(null, '', `/?token=${good}&plan=pro#/portal`)

    const url = capturedUrl()

    // Pre-fix: `'?token=X&plan=pro'.replace(/[?&]token=[^&#]+/, '')` === '&plan=pro',
    // so the rewritten URL was `/&plan=pro#/portal` - path corrupted, query gone.
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('?plan=pro')
    expect(url.hash).toBe('#/portal')
    expect(url.search).not.toContain('token=')
  })

  it('keeps working when token is NOT the first parameter (control: this path was already correct)', () => {
    const good = tokenWith({ sub: 'user-1', exp: FUTURE, roles: ['client'] })
    window.history.replaceState(null, '', `/?plan=pro&token=${good}#/portal`)

    const url = capturedUrl()

    expect(url.pathname).toBe('/')
    expect(url.search).toBe('?plan=pro')
    expect(url.hash).toBe('#/portal')
  })

  it('leaves no query string at all when token was the only parameter', () => {
    const good = tokenWith({ sub: 'user-1', exp: FUTURE, roles: ['client'] })
    window.history.replaceState(null, '', `/?token=${good}#/portal`)

    const url = capturedUrl()

    expect(url.pathname).toBe('/')
    expect(url.search).toBe('')
    expect(url.hash).toBe('#/portal')
  })

  it('accepts the hash-fragment shape the auth service actually redirects with', () => {
    const good = tokenWith({ sub: 'user-1', exp: FUTURE, roles: ['client'], username: 'ada' })
    window.history.replaceState(null, '', `/#/portal#token=${good}`)

    mount()

    expect(last().token).toBe(good)
    expect(last().claims?.username).toBe('ada')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(good)
    expect(window.location.hash).toBe('#/portal')
  })
})
