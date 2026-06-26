import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const PRICING_FILE = path.join(ROOT, 'public', 'content', 'pricing.json')
const OUTPUT_FILE = path.join(ROOT, 'public', 'content', 'stripe_payment_links.json')

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const SITE_URL = (process.env.STRIPE_SITE_URL ?? 'https://rodmen07.github.io/infraportal').replace(/\/$/, '')
const THANK_YOU_URL =
  process.env.STRIPE_THANK_YOU_URL ?? `${SITE_URL}/#/checkout-thank-you`

const ARCHITECTURE_REVIEW_UNIT_CENTS = toCents('STRIPE_ARCH_REVIEW_UNIT_CENTS', 12_500)
const PROJECT_DEPOSIT_CENTS = toCents('STRIPE_PROJECT_DEPOSIT_CENTS', 50_000)
const RETAINER_WEEKLY_CENTS = toCents('STRIPE_RETAINER_WEEKLY_CENTS', 100_000)
const CURRENCY = (process.env.STRIPE_CURRENCY ?? 'usd').toLowerCase()
const DRY_RUN = process.argv.includes('--dry-run')

if (!STRIPE_SECRET_KEY && !DRY_RUN) {
  console.error('Missing STRIPE_SECRET_KEY. Use --dry-run to preview config without API calls.')
  process.exit(1)
}

if (!/^https:\/\//i.test(THANK_YOU_URL)) {
  console.error(`STRIPE_THANK_YOU_URL must be HTTPS. Received: ${THANK_YOU_URL}`)
  process.exit(1)
}

const tierPlan = [
  {
    tier: 'Architecture Review',
    slug: 'architecture-review',
    description:
      'Book architecture reviews, second opinions, compliance assessments, and troubleshooting sessions.',
    unitAmount: ARCHITECTURE_REVIEW_UNIT_CENTS,
    recurring: null,
    adjustableQuantity: { minimum: 1, maximum: 40 },
    priceLabel: '$125/hour blocks',
  },
  {
    tier: 'Project',
    slug: 'project-deposit',
    description:
      'Reserve a scoped project slot with a kickoff deposit before proposal finalization.',
    unitAmount: PROJECT_DEPOSIT_CENTS,
    recurring: null,
    adjustableQuantity: null,
    priceLabel: 'Kickoff deposit',
  },
  {
    tier: 'Retainer',
    slug: 'retainer-weekly',
    description: 'Reserve weekly engineering capacity with a recurring retainer checkout.',
    unitAmount: RETAINER_WEEKLY_CENTS,
    recurring: { interval: 'week' },
    adjustableQuantity: null,
    priceLabel: 'Weekly retainer',
  },
]

function toCents(name, defaultValue) {
  const raw = process.env[name]
  if (!raw) return defaultValue
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer amount in cents.`)
  }
  return parsed
}

function appendRedirect(params, slug) {
  const url = new URL(THANK_YOU_URL)
  url.searchParams.set('tier', slug)
  params.append('after_completion[type]', 'redirect')
  params.append('after_completion[redirect][url]', url.toString())
}

async function postStripeForm(endpoint, params) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Stripe API ${endpoint} failed (${res.status}): ${errorText}`)
  }

  return res.json()
}

async function createProduct(plan) {
  const productParams = new URLSearchParams()
  productParams.append('name', `Infraportal - ${plan.tier} (${plan.priceLabel})`)
  productParams.append('description', plan.description)
  productParams.append('metadata[tier]', plan.tier)
  productParams.append('metadata[managed_by]', 'setup-stripe-payment-links.mjs')

  const product = await postStripeForm('products', productParams)

  const priceParams = new URLSearchParams()
  priceParams.append('currency', CURRENCY)
  priceParams.append('product', product.id)
  priceParams.append('unit_amount', String(plan.unitAmount))
  if (plan.recurring) {
    priceParams.append('recurring[interval]', plan.recurring.interval)
  }

  const price = await postStripeForm('prices', priceParams)

  const linkParams = new URLSearchParams()
  linkParams.append('line_items[0][price]', price.id)
  linkParams.append('line_items[0][quantity]', '1')
  linkParams.append('allow_promotion_codes', 'true')
  linkParams.append('metadata[tier]', plan.tier)
  linkParams.append('metadata[managed_by]', 'setup-stripe-payment-links.mjs')
  appendRedirect(linkParams, plan.slug)

  if (plan.adjustableQuantity) {
    linkParams.append('line_items[0][adjustable_quantity][enabled]', 'true')
    linkParams.append('line_items[0][adjustable_quantity][minimum]', String(plan.adjustableQuantity.minimum))
    linkParams.append('line_items[0][adjustable_quantity][maximum]', String(plan.adjustableQuantity.maximum))
  }

  const paymentLink = await postStripeForm('payment_links', linkParams)
  return {
    tier: plan.tier,
    slug: plan.slug,
    productId: product.id,
    priceId: price.id,
    paymentLinkId: paymentLink.id,
    checkoutUrl: paymentLink.url,
    thankYouUrl: new URL(`${THANK_YOU_URL}`).toString(),
  }
}

async function run() {
  const pricingRaw = await fs.readFile(PRICING_FILE, 'utf8')
  const pricing = JSON.parse(pricingRaw)
  const foundTiers = new Set(pricing.tiers.map((t) => t.tier))
  for (const plan of tierPlan) {
    if (!foundTiers.has(plan.tier)) {
      throw new Error(`Tier '${plan.tier}' not found in ${PRICING_FILE}`)
    }
  }

  if (DRY_RUN) {
    const preview = {
      mode: 'dry-run',
      stripeConfigured: Boolean(STRIPE_SECRET_KEY),
      currency: CURRENCY,
      thankYouUrl: THANK_YOU_URL,
      tiers: tierPlan.map((p) => ({
        tier: p.tier,
        unitAmountCents: p.unitAmount,
        recurring: p.recurring,
      })),
    }
    console.log(JSON.stringify(preview, null, 2))
    return
  }

  const created = []
  for (const plan of tierPlan) {
    console.log(`Creating Stripe product/price/link for: ${plan.tier}`)
    // Sequential creation keeps Stripe object relationships easy to follow.
    // eslint-disable-next-line no-await-in-loop
    const linkInfo = await createProduct(plan)
    created.push(linkInfo)
  }

  const byTier = new Map(created.map((item) => [item.tier, item.checkoutUrl]))
  const updated = {
    ...pricing,
    tiers: pricing.tiers.map((tier) => {
      const checkoutUrl = byTier.get(tier.tier)
      return checkoutUrl ? { ...tier, checkoutUrl } : tier
    }),
  }

  await fs.writeFile(PRICING_FILE, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
  await fs.writeFile(
    OUTPUT_FILE,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), thankYouUrl: THANK_YOU_URL, tiers: created }, null, 2)}\n`,
    'utf8',
  )

  console.log('Stripe Payment Links created and pricing.json updated successfully.')
  for (const item of created) {
    console.log(`- ${item.tier}: ${item.checkoutUrl}`)
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})