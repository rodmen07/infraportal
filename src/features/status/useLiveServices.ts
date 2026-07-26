import { useEffect, useState } from 'react'
import { parseAggregate, summarize, type Summary } from './statusModel'
import { UPSTREAMS_URL } from './gateway'

// A one-shot read of the platform health aggregate, for surfaces that want to
// SHOW a live service count instead of asserting one.
//
// Why this exists (PROOF-COST-1, v1.20.1): the home page used to state a
// runtime fact as a hand-typed string, a recurring-spend figure of "$0". That
// number was true when it was typed and false three weeks later, and nothing
// could ever notice, because a static bundle cannot know what is deployed. The
// fix is not a better hard-coded number, which would rot the same way; it is to
// measure, and to say nothing when the measurement is unavailable.
//
// Unlike the `#/status` board this does NOT poll: the home page shows one
// number, so one request on mount is the whole job.

/** What the caller knows about live services right now. */
export type LiveServicesState =
  | { phase: 'loading' }
  | { phase: 'loaded'; summary: Summary }
  /** The aggregate could not be read or did not match the contract. */
  | { phase: 'unavailable' }

const FETCH_TIMEOUT_MS = 8_000

/**
 * Map a parsed response body to a state. Pure, so the interesting half is
 * testable without a DOM, a network, or a fake timer: any body that is not a
 * well-formed aggregate degrades to `unavailable` rather than throwing inside
 * render.
 */
export function liveServicesFrom(body: unknown): LiveServicesState {
  const aggregate = parseAggregate(body)
  if (!aggregate) return { phase: 'unavailable' }
  return { phase: 'loaded', summary: summarize(aggregate) }
}

/**
 * Read the live service counts once on mount. Never throws and never leaves the
 * caller mid-flight after unmount; every failure path lands on `unavailable`.
 */
export function useLiveServices(): LiveServicesState {
  const [state, setState] = useState<LiveServicesState>({ phase: 'loading' })

  useEffect(() => {
    let active = true
    const read = async () => {
      try {
        const res = await fetch(UPSTREAMS_URL, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        })
        const body = await res.json().catch(() => null)
        if (active) setState(liveServicesFrom(body))
      } catch {
        if (active) setState({ phase: 'unavailable' })
      }
    }
    void read()
    return () => {
      active = false
    }
  }, [])

  return state
}
