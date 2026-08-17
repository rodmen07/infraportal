import {
  API_SURFACE_SERVICE_COUNT,
  API_SURFACE_TOTAL,
  apiSurfaceRows,
} from './apiSurface'

// Operations per service as a ranked bar row (API-SURFACE-1), derived from
// the committed OpenAPI manifest. One nominal series, so every bar wears the
// single accent hue and carries a direct value label — the number is the
// datum; the bar is reinforcement, hidden from assistive tech.

export function ApiSurfaceChart() {
  const rows = apiSurfaceRows()
  return (
    <div className="forge-panel surface-card p-5">
      <h3 className="text-sm font-semibold text-text-primary">API surface by service</h3>
      <p className="mt-1 text-scale-xs text-text-muted">
        {API_SURFACE_TOTAL} documented operations across {API_SURFACE_SERVICE_COUNT} services,
        counted from the committed OpenAPI snapshots this page renders.
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-scale-xs text-text-secondary">{row.name}</span>
            <span aria-hidden="true" className="h-2.5 flex-1 rounded-full bg-neutral-bg">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${row.percentOfMax}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-mono text-scale-xs text-text-muted">
              {row.operationCount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
