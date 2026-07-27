// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { trackPortfolioEvent } from './analytics'

describe('analytics', () => {
  it('forwards to no external sink: installed vendor globals stay untouched (v1.22.3)', () => {
    // The pre-v1.22.3 module pushed into window.dataLayer and called
    // window.gtag when they existed, but nothing on this site ever installed
    // them, so every event dispatched into a void while reading as
    // instrumented. The branches are deleted until a real sink is wired
    // (v1.22.2); this test fails if either forwarding branch comes back
    // without that decision.
    const dataLayer: Array<Record<string, unknown>> = []
    const gtag = vi.fn()

    const w = window as typeof window & {
      dataLayer?: Array<Record<string, unknown>>
      gtag?: (...args: unknown[]) => void
    }
    w.dataLayer = dataLayer
    w.gtag = gtag

    try {
      trackPortfolioEvent('consulting_cta_click', { label: 'Start paid discovery', location: 'hero' })

      expect(dataLayer).toEqual([])
      expect(gtag).not.toHaveBeenCalled()
    } finally {
      delete w.dataLayer
      delete w.gtag
    }
  })

  it('dispatches a portfolio analytics event', () => {
    const handler = vi.fn()
    window.addEventListener('portfolio:analytics', handler)

    trackPortfolioEvent('pricing_cta_click', { tier: 'Architecture Review' })

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ eventName: string; params: Record<string, unknown> }>
    expect(event.detail).toEqual({
      eventName: 'pricing_cta_click',
      params: { tier: 'Architecture Review' },
    })

    window.removeEventListener('portfolio:analytics', handler)
  })
})
