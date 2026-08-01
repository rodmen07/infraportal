// @vitest-environment jsdom
/**
 * ANALYTICS-PHANTOM-1: how many times does one pricing visit report itself?
 *
 * WHAT WENT WRONG (found 2026-08-01 by a QA adversarial review of the v1.22
 * "Count what converts" instrumentation, which had shipped as source-scanning
 * guards only). `conversionInstrumentation.test.ts` proves the pricing page
 * OWNS the right event names and that every anchor is click-tracked; nothing
 * anywhere had ever counted what one visit actually emits. Rendering the real
 * page against a stubbed fetch answered it: TWO `pricing_page_view` events,
 *
 *     { tier_count: 0, has_retainer_link: false }   <- always false
 *     { tier_count: 2, has_retainer_link: true  }
 *
 * because `usePricingContent` returns its empty default synchronously and the
 * payload one microtask later, while the effect was keyed on `tiers` alone. So
 * every pricing view double-counted, and half of all `pricing_page_view`
 * records claimed the pricing page has no tiers and no retainer link. The sink
 * is not wired yet (v1.22.2 is gated on the owner's site code), which is
 * exactly why this is worth fixing now: the instrumentation would have gone
 * live already wrong, and a 2x inflation on the money page is the kind of
 * number nobody re-derives once it is in a dashboard.
 *
 * WHY THIS TEST RENDERS THE REAL PAGE. The defect lives in the seam between an
 * async hook and a consumer effect, so neither side shows it alone. Every
 * assertion below drives `PricingPage` itself through `createRoot` (the render
 * harness precedent of `useResource.test.ts` and `useContentHooks.test.ts`) and
 * listens on the one dispatch seam `trackPortfolioEvent` actually uses, the
 * `portfolio:analytics` CustomEvent. Nothing here re-implements the page.
 *
 * Contract B is the negative control (L-001): it drives the PRE-FIX wiring -
 * the real hook, read the old way, with the old dependency list - and asserts
 * it still emits the two-event phantom. If a future change made the fixed page
 * and the legacy shape behave alike, B fails and says so, so contract A cannot
 * quietly become an assertion that passes for the wrong reason.
 *
 * Note the harness renders WITHOUT StrictMode on purpose: StrictMode's double
 * effect invocation is a development-only behavior, and this is a claim about
 * what the deployed production bundle reports.
 */

import { act, createElement, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PricingPage } from './PricingPage'
import { usePricingContent } from '../features/consulting/usePricingContent'
import { trackPortfolioEvent } from '../utils/analytics'
import { PORTFOLIO_EVENTS } from '../utils/analyticsEvents'
import { ThemeProvider } from '../features/layout/ThemeContext'
import { AuthProvider } from '../features/auth/AuthContext'
import { NotificationProvider } from '../features/notifications/NotificationContext'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface Emission {
  eventName: string
  params: Record<string, unknown>
}

let container: HTMLDivElement
let root: Root
let mounted: boolean
let seen: Emission[]
let listener: (event: Event) => void

/** The notification provider opens an SSE connection on mount; jsdom has no
 *  EventSource, and this test is not about the feed. */
class InertEventSource {
  close() {}
  addEventListener() {}
  removeEventListener() {}
  onmessage: unknown = null
  onerror: unknown = null
  onopen: unknown = null
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mounted = true
  seen = []
  listener = (event: Event) => {
    seen.push((event as CustomEvent).detail as Emission)
  }
  window.addEventListener('portfolio:analytics', listener)
  vi.stubGlobal('EventSource', InertEventSource)
})

afterEach(() => {
  window.removeEventListener('portfolio:analytics', listener)
  if (mounted) act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function unmount(): void {
  act(() => root.unmount())
  mounted = false
}

/** The provider stack `main.tsx` mounts around every route. */
function withProviders(child: ReactNode): ReactNode {
  return createElement(ThemeProvider, null, createElement(AuthProvider, null, createElement(NotificationProvider, null, child)))
}

const TIERS = [
  {
    tier: 'Sprint',
    price: '$4,000',
    description: 'A scoped delivery sprint.',
    features: ['Architecture review'],
    highlighted: false,
    ctaLabel: 'Start a sprint',
    ctaHref: '#/contact',
  },
  {
    tier: 'Retainer',
    price: '$6,000/mo',
    description: 'Ongoing platform capacity.',
    features: ['Weekly capacity'],
    highlighted: true,
    ctaLabel: 'Book a call',
    ctaHref: '#/contact',
  },
]

const PAYLOAD = { note: 'Loaded pricing note.', tiers: TIERS }

const DEFAULT_NOTE = 'All engagements start with a free 30-minute discovery call.'

function stubFetchOk(payload: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })))
}

/** Renders `element` and flushes the awaited fetch so the load settles. */
async function renderAndSettle(element: ReactNode): Promise<void> {
  await act(async () => {
    root.render(withProviders(element))
  })
  // One extra microtask flush so the state write behind `await res.json()` lands.
  await act(async () => {})
}

const pageViews = () => seen.filter(e => e.eventName === PORTFOLIO_EVENTS.pricing_page_view)
const impressions = () => seen.filter(e => e.eventName === PORTFOLIO_EVENTS.pricing_tier_impression)

// ---------------------------------------------------------------------------
// The pre-fix wiring, kept executable as the negative control for contract B.
// It reads the REAL hook (so it cannot drift away from the shipped loader) but
// ignores `settled` and keys the effect on the content alone, which is exactly
// what `PricingPage` did before this increment.
// ---------------------------------------------------------------------------
function LegacyPricingAnalyticsProbe({ baseUrl }: { baseUrl: string }) {
  const { tiers } = usePricingContent(baseUrl)

  useEffect(() => {
    trackPortfolioEvent(PORTFOLIO_EVENTS.pricing_page_view, {
      tier_count: tiers.length,
      has_retainer_link: tiers.some(t => t.tier === 'Retainer'),
    })
  }, [tiers])

  return null
}

describe('contract A: one pricing visit reports itself exactly once, truthfully', () => {
  it('emits a single pricing_page_view carrying the LOADED tier count', async () => {
    stubFetchOk(PAYLOAD)

    await renderAndSettle(createElement(PricingPage))

    expect(pageViews()).toHaveLength(1)
    expect(pageViews()[0].params).toEqual({ tier_count: 2, has_retainer_link: true })
  })

  it('never emits the pre-load placeholder reading (tier_count 0 on a page that has tiers)', async () => {
    stubFetchOk(PAYLOAD)

    await renderAndSettle(createElement(PricingPage))

    expect(pageViews().map(e => e.params.tier_count)).not.toContain(0)
    expect(pageViews().map(e => e.params.has_retainer_link)).not.toContain(false)
  })
})

describe('contract B: the negative control still reproduces the defect', () => {
  it('the pre-fix wiring emits TWO page views, the first one false', async () => {
    stubFetchOk(PAYLOAD)

    await renderAndSettle(createElement(LegacyPricingAnalyticsProbe, { baseUrl: '/' }))

    expect(pageViews()).toHaveLength(2)
    expect(pageViews()[0].params).toEqual({ tier_count: 0, has_retainer_link: false })
    expect(pageViews()[1].params).toEqual({ tier_count: 2, has_retainer_link: true })
  })

  it('the shipped page and the legacy shape disagree, which is the whole fix', async () => {
    stubFetchOk(PAYLOAD)
    await renderAndSettle(createElement(PricingPage))
    const fixed = pageViews().length

    seen = []
    unmount()
    container.remove()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mounted = true

    stubFetchOk(PAYLOAD)
    await renderAndSettle(createElement(LegacyPricingAnalyticsProbe, { baseUrl: '/' }))

    expect(fixed).toBe(1)
    expect(pageViews().length).toBe(2)
  })
})

describe('contract C: tier impressions follow the page view, once each, in order', () => {
  it('emits one impression per loaded tier, after the page view', async () => {
    stubFetchOk(PAYLOAD)

    await renderAndSettle(createElement(PricingPage))

    expect(impressions()).toHaveLength(TIERS.length)
    expect(impressions().map(e => e.params.tier)).toEqual(['Sprint', 'Retainer'])
    expect(impressions().map(e => e.params.index)).toEqual([1, 2])
    expect(impressions().map(e => e.params.highlighted)).toEqual(['no', 'yes'])
    expect(seen.findIndex(e => e.eventName === PORTFOLIO_EVENTS.pricing_page_view)).toBe(0)
  })
})

describe('contract D: a failed load is reported once, honestly', () => {
  const failures: Array<[string, () => void]> = [
    ['a 404', () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))],
    [
      'a malformed body',
      () =>
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => ({
            ok: true,
            json: async () => {
              throw new SyntaxError('Unexpected token in JSON')
            },
          })),
        ),
    ],
    [
      'a network failure',
      () =>
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            throw new TypeError('Failed to fetch')
          }),
        ),
    ],
  ]

  it.each(failures)('%s still settles and emits exactly one page view of an empty grid', async (_label, stub) => {
    stub()

    await renderAndSettle(createElement(PricingPage))

    expect(pageViews()).toHaveLength(1)
    expect(pageViews()[0].params).toEqual({ tier_count: 0, has_retainer_link: false })
    expect(impressions()).toHaveLength(0)
  })
})

describe('contract E: a visit abandoned before the content lands reports nothing', () => {
  it('emits no page view when the page unmounts while the fetch is still pending', async () => {
    let release: (value: unknown) => void = () => {}
    const pending = new Promise(resolve => {
      release = resolve
    })
    vi.stubGlobal('fetch', vi.fn(() => pending))

    act(() => {
      root.render(withProviders(createElement(PricingPage)))
    })
    expect(pageViews()).toHaveLength(0)

    unmount()
    release({ ok: true, json: async () => PAYLOAD })
    await act(async () => {})

    expect(seen).toHaveLength(0)
  })
})

describe('contract F: a wrong-shape payload cannot take the pricing page down', () => {
  it('keeps the default when the decoded body has no tiers array', async () => {
    stubFetchOk({ note: 'a content typo dropped the tiers key' })

    await renderAndSettle(createElement(PricingPage))

    expect(container.textContent).toContain(DEFAULT_NOTE)
    expect(container.textContent).not.toContain('a content typo dropped the tiers key')
    expect(pageViews()).toHaveLength(1)
    expect(pageViews()[0].params).toEqual({ tier_count: 0, has_retainer_link: false })
  })

  it('accepts the well-shaped payload, so the guard above is not rejecting everything', async () => {
    stubFetchOk(PAYLOAD)

    await renderAndSettle(createElement(PricingPage))

    expect(container.textContent).toContain('Loaded pricing note.')
    expect(pageViews()[0].params.tier_count).toBe(2)
  })
})
