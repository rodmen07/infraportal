import { SPEC_SERVICES, TOTAL_OPERATIONS } from '../../api-specs'

// The API surface chart's model (API-SURFACE-1): operations per service,
// derived entirely from the committed OpenAPI manifest. Nothing here is
// hand-typed, so the chart re-derives itself on every spec sync — the same
// rule the proof strip and the topology count follow.

export interface ApiSurfaceRow {
  readonly id: string
  readonly name: string
  readonly operationCount: number
  /** Bar length as a percentage of the largest service's count. */
  readonly percentOfMax: number
}

/** Rows sorted largest-first, so the chart reads as a ranking. */
export function apiSurfaceRows(): readonly ApiSurfaceRow[] {
  const max = Math.max(...SPEC_SERVICES.map((s) => s.operationCount))
  return [...SPEC_SERVICES]
    .sort((a, b) => b.operationCount - a.operationCount || a.name.localeCompare(b.name))
    .map((s) => ({
      id: s.id,
      name: s.name,
      operationCount: s.operationCount,
      percentOfMax: (s.operationCount / max) * 100,
    }))
}

export const API_SURFACE_TOTAL = TOTAL_OPERATIONS

export const API_SURFACE_SERVICE_COUNT = SPEC_SERVICES.length
