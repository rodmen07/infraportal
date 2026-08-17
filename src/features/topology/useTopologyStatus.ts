import { useEffect, useState } from 'react'
import { parseAggregate, summarize, type Summary, type Upstream } from '../status/statusModel'
import { UPSTREAMS_URL } from '../status/gateway'

// A one-shot read of the gateway health aggregate for the topology diagram.
//
// Sibling of useLiveServices (PROOF-COST-1): same endpoint, same single
// request on mount, same never-throw contract. It exists because the diagram
// needs the per-upstream detail (name → status, to place a dot on the right
// box) while useLiveServices deliberately reduces the aggregate to a Summary
// and keeps that narrow shape pinned by its own tests. The diagram does NOT
// poll: the architecture is committed data, only the overlay is measured, and
// one measurement per visit is the whole job. The `#/status` board remains
// the polling surface.

/** What the diagram knows about live upstream health right now. */
export type TopologyStatusState =
  | { phase: 'loading' }
  | { phase: 'loaded'; upstreams: Upstream[]; summary: Summary }
  /** The aggregate could not be read or did not match the contract. */
  | { phase: 'unavailable' }

const FETCH_TIMEOUT_MS = 8_000

/**
 * Map a parsed response body to a state. Pure, so it is testable without a
 * DOM or a network: any body that is not a well-formed aggregate degrades to
 * `unavailable` rather than throwing inside render.
 */
export function topologyStatusFrom(body: unknown): TopologyStatusState {
  const aggregate = parseAggregate(body)
  if (!aggregate) return { phase: 'unavailable' }
  return { phase: 'loaded', upstreams: aggregate.upstreams, summary: summarize(aggregate) }
}

/**
 * Read the health aggregate once on mount. Never throws and never updates
 * state after unmount; every failure path lands on `unavailable`.
 */
export function useTopologyStatus(): TopologyStatusState {
  const [state, setState] = useState<TopologyStatusState>({ phase: 'loading' })

  useEffect(() => {
    let active = true
    const read = async () => {
      try {
        const res = await fetch(UPSTREAMS_URL, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        })
        const body = await res.json().catch(() => null)
        if (active) setState(topologyStatusFrom(body))
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
