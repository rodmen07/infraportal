type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

interface AnalyticsWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>
  gtag?: (...args: unknown[]) => void
}

export function trackPortfolioEvent(eventName: string, params: AnalyticsParams = {}): void {
  if (typeof window === 'undefined') return

  const analyticsWindow = window as AnalyticsWindow
  const payload = { event: eventName, ...params }

  analyticsWindow.dataLayer?.push(payload)
  analyticsWindow.gtag?.('event', eventName, params)

  window.dispatchEvent(new CustomEvent('portfolio:analytics', { detail: { eventName, params } }))
}
