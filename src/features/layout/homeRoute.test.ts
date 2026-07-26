import { describe, it, expect } from 'vitest'
import { isHomeHash } from './homeRoute'
import { NAV_ITEMS } from './navItems'

describe('isHomeHash — the router root-hash predicate', () => {
  it('is true for exactly the three site-root hash forms', () => {
    expect(isHomeHash('')).toBe(true) // initial load, before any hash
    expect(isHomeHash('#')).toBe(true) // bare fragment
    expect(isHomeHash('#/')).toBe(true) // canonical Home href
  })

  it("matches NAV_ITEMS' Home href, so the nav Home link routes to Home not NotFound", () => {
    const home = NAV_ITEMS.find((i) => i.label === 'Home')
    expect(home?.href).toBe('#/')
    expect(isHomeHash(home!.href)).toBe(true)
  })

  it('is false for every real explicit route (they must not be swallowed by the Home guard)', () => {
    for (const href of ['#/about', '#/services', '#/pricing', '#/contact', '#/status', '#/api-docs', '#/case-studies']) {
      expect(isHomeHash(href), `${href} must not be treated as Home`).toBe(false)
    }
  })

  it('is false for unknown hashes, so they reach the NotFound catch-all', () => {
    expect(isHomeHash('#/definitely-not-a-real-route')).toBe(false)
    expect(isHomeHash('#/portal/typo')).toBe(false)
    expect(isHomeHash('#/case-studies/anything')).toBe(false)
  })

  it('does not confuse a Home-prefixed deeper hash for Home', () => {
    // `#/home` is NOT the root; only the three canonical root forms are.
    expect(isHomeHash('#/home')).toBe(false)
  })
})
