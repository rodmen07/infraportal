// Resolves how a pricing-tier CTA should behave.
//
// When a tier defines an HTTPS checkout URL (e.g. a Stripe Payment Link), the
// CTA points directly at that hosted checkout so a visitor can pay without a
// back-and-forth lead thread, and we emit a checkout-intent analytics event.
// Otherwise the CTA falls back to the internal lead-capture href.
//
// Empty, whitespace, or non-HTTPS URLs are treated as "not configured" so the
// feature is a graceful no-op until a real payment link is supplied. Requiring
// HTTPS also blocks unsafe schemes (javascript:, http:) from ever becoming a
// link target.

export type PricingCtaEvent = 'pricing_checkout_click' | 'pricing_cta_click'

export interface CheckoutResolution {
  href: string
  external: boolean
  eventName: PricingCtaEvent
}

export function resolvePricingCheckout(
  checkoutUrl: string | undefined,
  ctaHref: string,
): CheckoutResolution {
  const trimmed = (checkoutUrl ?? '').trim()

  if (trimmed && /^https:\/\//i.test(trimmed)) {
    return { href: trimmed, external: true, eventName: 'pricing_checkout_click' }
  }

  return { href: ctaHref, external: false, eventName: 'pricing_cta_click' }
}
