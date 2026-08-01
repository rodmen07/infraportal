import { useEffect, useState } from 'react'
import type { PricingContent } from '../../types'

const DEFAULT: PricingContent = {
  note: 'All engagements start with a free 30-minute discovery call.',
  tiers: [],
}

/**
 * The pricing content plus whether its load has SETTLED.
 *
 * WHY `settled` EXISTS (QA 2026-08-01, ANALYTICS-PHANTOM-1). The hook returns
 * its default synchronously and the payload one microtask later, so a consumer
 * effect keyed on the content alone runs TWICE per visit: once over the empty
 * default, once over the real tiers. `PricingPage` did exactly that and emitted
 * two `pricing_page_view` events per visit, the first one asserting
 * `tier_count: 0, has_retainer_link: false` - a claim that is false on every
 * real visit, and one that would have doubled and skewed the pricing funnel the
 * moment the v1.22.2 sink is wired. `settled` gives a consumer the one bit it
 * needs to measure the answer instead of the placeholder.
 *
 * It goes true when the fetch RESOLVES, whatever the outcome (payload, 404,
 * malformed body, network failure), because "the grid rendered with no tiers"
 * is a real, reportable state and must stay distinguishable from "we have not
 * looked yet".
 *
 * The effect also carries an `active` flag, so a response arriving after
 * unmount or after `baseUrl` changed cannot write state or report a settle for
 * a load nobody is waiting on.
 */
export interface PricingContentState extends PricingContent {
  /** False until the fetch resolves one way or the other; then true. */
  settled: boolean
}

/**
 * True when a decoded payload is shaped like `PricingContent`. Without this, a
 * valid-JSON body whose `tiers` is missing or not an array replaces the default
 * wholesale, and `PricingPage`'s `tiers.length` then throws into the root error
 * boundary - a content typo taking down the money page.
 * `contentContract.test.ts` guards the COMMITTED file; this guards what the
 * browser is actually handed at runtime.
 */
function isPricingContent(payload: unknown): payload is PricingContent {
  return typeof payload === 'object' && payload !== null && Array.isArray((payload as PricingContent).tiers)
}

export function usePricingContent(baseUrl: string): PricingContentState {
  const [state, setState] = useState<PricingContentState>({ ...DEFAULT, settled: false })

  useEffect(() => {
    let active = true

    const load = async () => {
      let next: PricingContent = DEFAULT
      try {
        const res = await fetch(`${baseUrl}content/pricing.json`)
        if (res.ok) {
          const payload: unknown = await res.json()
          if (isPricingContent(payload)) next = payload
        }
      } catch {
        // noop - error loading pricing; the default stands and still settles
      }
      if (active) setState({ ...next, settled: true })
    }
    void load()

    return () => {
      active = false
    }
  }, [baseUrl])

  return state
}
