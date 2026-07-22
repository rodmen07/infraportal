import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for the retainer-checkout bug (user-reported): all three
 * retainer tiers shipped a HARDCODED `buy.stripe.com` payment link, and every
 * one was wrong:
 *   - Starter  -> the one-time "Architecture Review" checkout (wrong price)
 *   - Standard -> the one-time "Project" deposit checkout (wrong price)
 *   - Premium  -> a FABRICATED id ("Project" checkout's id with its last char
 *     bumped), which does not exist on Stripe and 404s in the browser.
 *
 * There are no dedicated per-tier retainer payment links today, so the tiers
 * must route to the discuss/contact flow (`checkoutUrl: null`, which
 * `resolvePricingCheckout` falls back to `ctaHref`). A correct future wiring
 * would read links from the generated `public/content/stripe_payment_links.json`,
 * not hardcode them here - so ANY literal `buy.stripe.com/...` in this file is
 * a regression until that exists.
 */
describe('RetainersPage checkout wiring', () => {
  it('ships no hardcoded Stripe payment link (retainers route to the discuss/contact flow)', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'src/pages/RetainersPage.tsx'),
      'utf-8',
    )
    const hardcodedStripeLinks = src.match(/buy\.stripe\.com\/[A-Za-z0-9_]+/g) ?? []
    expect(hardcodedStripeLinks).toEqual([])
  })
})
