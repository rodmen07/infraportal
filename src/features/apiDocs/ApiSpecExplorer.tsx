import { useEffect, useMemo, useState } from 'react'
import { SPEC_SERVICES, loadSpec } from '../../api-specs'
import { COVERED_SERVICE_IDS } from '../../lib/tryItAdapter.mock'
import type { OpenApiSpec } from './openapiTypes'
import { extractOperations, groupOperationsByTag, type TagGroupView } from './specModel'
import { ServiceSpecView } from './SpecView'

// Session cache so switching back to an already-viewed service is instant and
// re-triggers no chunk fetch. Read during render; the effect below only fills
// misses asynchronously and bumps a tick to re-render.
const specCache = new Map<string, OpenApiSpec>()

export function ApiSpecExplorer() {
  const [selectedId, setSelectedId] = useState<string>(SPEC_SERVICES[0]?.id ?? '')
  const [, setLoadTick] = useState(0)
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!selectedId || specCache.has(selectedId)) return
    let cancelled = false
    loadSpec(selectedId)
      .then((loaded) => {
        specCache.set(selectedId, loaded)
        if (!cancelled) setLoadTick((tick) => tick + 1)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadErrors((previous) => ({
            ...previous,
            [selectedId]: error instanceof Error ? error.message : 'failed to load spec',
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const spec = specCache.get(selectedId)
  const errorMessage = loadErrors[selectedId]

  const groups: TagGroupView[] = useMemo(() => {
    if (!spec) return []
    return groupOperationsByTag(spec, extractOperations(spec))
  }, [spec])

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SPEC_SERVICES.map((service) => {
          const isSelected = service.id === selectedId
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelectedId(service.id)}
              aria-pressed={isSelected}
              className={`rounded-xl border p-3 text-left transition ${
                isSelected
                  ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-orange-500/15'
                  : 'border-zinc-700/40 bg-zinc-900/40 hover:border-zinc-500/50 hover:bg-zinc-800/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-sm font-semibold ${isSelected ? 'text-amber-100' : 'text-zinc-200'}`}>
                  {service.name}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {COVERED_SERVICE_IDS.includes(service.id) && (
                    <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      try-it demo
                    </span>
                  )}
                  <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {service.operationCount} ops
                  </span>
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">{service.summary}</p>
            </button>
          )
        })}
      </div>

      {!spec && !errorMessage && (
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 p-6 text-center text-xs text-zinc-500">
          Loading {selectedId} spec...
        </div>
      )}

      {!spec && errorMessage && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-6 text-xs text-rose-300">
          Could not load the {selectedId} spec: {errorMessage}
        </div>
      )}

      {spec && <ServiceSpecView spec={spec} groups={groups} serviceId={selectedId} />}
    </div>
  )
}
