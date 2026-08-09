/**
 * Coverage for the invite/reset link parsing extracted out of the two portal
 * auth pages during the `set-state-in-effect` triage (2026-08-01).
 *
 * These two links are the only entry points a client ever receives by email,
 * and until this pass the parsing lived inline in a mount effect with no test
 * at all: `PortalRegisterPage` shipped 2026-03 and `PortalResetPasswordPage`
 * with it, so the highest-stakes strings on the portal went untested for
 * months. Each case below pins behaviour the pages relied on implicitly.
 */
import { describe, expect, it } from 'vitest'
import { hashQueryParams, parseInviteParams, parseResetToken } from './hashParams'

describe('hashQueryParams', () => {
  it('reads the query component out of a hash route', () => {
    expect(hashQueryParams('#/portal/register?token=abc').get('token')).toBe('abc')
  })

  it('is empty for a hash with no query component', () => {
    expect([...hashQueryParams('#/portal/register').keys()]).toEqual([])
  })

  it('is empty for an empty hash', () => {
    expect([...hashQueryParams('').keys()]).toEqual([])
  })

  it('keeps only the first query component when the hash contains several', () => {
    // `split('?')[1]` is the shipped behaviour; pinning it so a refactor to
    // `indexOf` (which would swallow the second `?` into the value) is caught.
    expect(hashQueryParams('#/portal/register?a=1?b=2').get('a')).toBe('1')
  })
})

describe('parseInviteParams', () => {
  it('returns the token from an invite link', () => {
    expect(parseInviteParams('#/portal/register?token=inv-1')).toEqual({
      token: 'inv-1',
      email: '',
    })
  })

  it('pre-fills the email alongside a token', () => {
    expect(parseInviteParams('#/portal/register?token=inv-1&email=a%40b.com')).toEqual({
      token: 'inv-1',
      email: 'a@b.com',
    })
  })

  it('ignores an email that arrives without a token', () => {
    // The original page nested the email read inside `if (token)`, so a link
    // carrying only an address pre-filled nothing.
    expect(parseInviteParams('#/portal/register?email=a%40b.com')).toEqual({
      token: null,
      email: '',
    })
  })

  it('returns no token when the link carries no query component', () => {
    expect(parseInviteParams('#/portal/register')).toEqual({ token: null, email: '' })
  })

  it('applies the second decode pass the shipped links depend on', () => {
    // `%2540` -> URLSearchParams gives `%40` -> second pass gives `@`.
    expect(parseInviteParams('#/portal/register?token=t&email=a%2540b.com').email).toBe(
      'a@b.com',
    )
  })

  it('falls back to the raw address when the second decode would throw', () => {
    // A bare `%` survives URLSearchParams and makes `decodeURIComponent`
    // raise URIError. Inside the old mount effect that escaped as an unhandled
    // error; the parser now yields the address unchanged instead.
    expect(() =>
      parseInviteParams('#/portal/register?token=t&email=100%25off%40b.com'),
    ).not.toThrow()
    expect(parseInviteParams('#/portal/register?token=t&email=100%25off%40b.com').email).toBe(
      '100%off@b.com',
    )
  })
})

describe('parseResetToken', () => {
  it('returns the token from a reset link', () => {
    expect(parseResetToken('#/portal/reset-password?token=r-1')).toBe('r-1')
  })

  it('returns null when the link carries no token', () => {
    expect(parseResetToken('#/portal/reset-password')).toBeNull()
  })
})
