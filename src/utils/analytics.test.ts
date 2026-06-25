// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { trackPortfolioEvent } from './analytics'

describe('analytics', () => {
  it('pushes events to dataLayer and gtag when available', () => {
    const dataLayer: Array<Record<string, unknown>> = []
    const gtag = vi.fn()

    const w = window as typeof window & {
      dataLayer?: Array<Record<string, unknown>>
      gtag?: (...args: unknown[]) => void
    }
    w.dataLayer = dataLayer
    w.gtag = gtag

    trackPortfolioEvent('consulting_cta_click', { label: 'Start paid discovery', location: 'hero' })

    expect(dataLayer).toEqual([
      {
        event: 'consulting_cta_click',
        label: 'Start paid discovery',
        location: 'hero',
      },
    ])
    expect(gtag).toHaveBeenCalledWith('event', 'consulting_cta_click', {
      label: 'Start paid discovery',
      location: 'hero',
    })
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
