import type { LiveServicesState } from '../status/useLiveServices'

// The home-page proof tiles, as data.
//
// Two of the three are durable facts about work that was done (services built,
// languages used). The third used to hard-code "$0" as a standing claim about
// recurring infrastructure spend, which this bundle had no way to check and
// which went false the moment the Cloud Run half was revived on 2026-07-21
// (PROOF-COST-1). It is derived from the live health aggregate instead, so it
// either reports a measured number or reports nothing at all.

/** In-app destination for anything the visitor might want to verify. */
export const STATUS_BOARD_HASH = '#/status'

export interface ProofStat {
  readonly value: string
  readonly label: string
  /** Present when the tile is a link the visitor can follow to check it. */
  readonly href?: string
}

/** Facts about shipped work; nothing here depends on what is deployed today. */
export const BUILT_PROOF_STATS: readonly ProofStat[] = [
  { value: '16', label: 'Microservices shipped' },
  { value: '4+', label: 'Languages in production' },
] as const

/**
 * The live tile. Every phase links to the status board, because the board is
 * where the claim can be checked; only the `loaded` phase states a number.
 *
 * The unavailable phase deliberately shows no count and no verdict: "we could
 * not reach the platform" is not evidence that it is up OR down, and inventing
 * a value there is how the original defect happened.
 */
export function liveServicesStat(state: LiveServicesState): ProofStat {
  if (state.phase === 'loaded') {
    return {
      value: `${state.summary.ok}/${state.summary.total}`,
      label: 'Services live now',
      href: STATUS_BOARD_HASH,
    }
  }
  if (state.phase === 'loading') {
    return { value: '…', label: 'Checking services', href: STATUS_BOARD_HASH }
  }
  return { value: 'Status', label: 'See the platform board', href: STATUS_BOARD_HASH }
}

/** The three tiles the proof strip renders, in display order. */
export function proofStats(state: LiveServicesState): readonly ProofStat[] {
  return [...BUILT_PROOF_STATS, liveServicesStat(state)]
}
