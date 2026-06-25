import { describe, expect, it } from 'vitest'
import { resolvePricingCheckout } from './pricingCheckout'

describe('resolvePricingCheckout', () => {
  it('falls back to the internal href when no checkout URL is set', () => {
    expect(resolvePricingCheckout(undefined, '#/contact')).toEqual({
      href: '#/contact',
      external: false,
      eventName: 'pricing_cta_click',
    })
  })

  it('treats an empty or whitespace checkout URL as unset', () => {
    expect(resolvePricingCheckout('', '#/contact').external).toBe(false)
    expect(resolvePricingCheckout('   ', '#/contact').eventName).toBe('pricing_cta_click')
  })

  it('uses a configured HTTPS checkout URL as an external checkout target', () => {
    expect(resolvePricingCheckout('https://buy.stripe.com/test_123', '#/contact')).toEqual({
      href: 'https://buy.stripe.com/test_123',
      external: true,
      eventName: 'pricing_checkout_click',
    })
  })

  it('trims surrounding whitespace from the checkout URL', () => {
    const result = resolvePricingCheckout('  https://buy.stripe.com/abc  ', '#/contact')
    expect(result.href).toBe('https://buy.stripe.com/abc')
    expect(result.external).toBe(true)
  })

  it('rejects non-HTTPS schemes and falls back to the internal href', () => {
    expect(resolvePricingCheckout('http://buy.stripe.com/abc', '#/contact').external).toBe(false)
    expect(resolvePricingCheckout('javascript:alert(1)', '#/contact')).toEqual({
      href: '#/contact',
      external: false,
      eventName: 'pricing_cta_click',
    })
  })
})
