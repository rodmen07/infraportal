import type { PortfolioEventName } from './analyticsEvents'

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

// v1.22.3 analytics truth pass: this module deliberately forwards to NO
// external sink. The forwarding branches it used to carry dispatched into a
// void (optional-chained against globals nothing ever installs; see
// ROADMAP.md "v1.22 - Count what converts"), which made the funnel look
// instrumented while producing no evidence. Until the v1.22.2 sink is wired,
// the only observable output is the in-page CustomEvent below, which exists
// so tests and future listeners have one stable seam. When a sink lands, its
// forwarding branch must ship together with the matching script tag in
// index.html - src/features/site/analyticsSink.test.ts reads both sides and
// fails on either half arriving alone.

export function trackPortfolioEvent(eventName: PortfolioEventName, params: AnalyticsParams = {}): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent('portfolio:analytics', { detail: { eventName, params } }))
}
