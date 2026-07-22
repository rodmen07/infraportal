import { useEffect, useMemo, useRef, useState } from 'react'
import { SPEC_SERVICES, loadSpec } from '../../api-specs'
import { COVERED_SERVICE_IDS } from '../../lib/tryItAdapter.mock'
import type { OpenApiSpec } from './openapiTypes'
import { buildApiDocsHash, parseApiDocsHash } from './deepLink'
import { extractOperations, groupOperationsByTag, type TagGroupView } from './specModel'
import { ServiceSpecView } from './SpecView'

// Session cache so switching back to an already-viewed service is instant and
// re-triggers no chunk fetch. Read during render; the effect below only fills
// misses asynchronously and bumps a tick to re-render.
const specCache = new Map<string, OpenApiSpec>()

interface ExplorerTarget {
  service: string
  op: string | null
}

/**
 * Resolves a deep-link hash (v1.17.3) to a valid explorer target, falling
 * back to the first service when the hash names no known service.
 */
function resolveTarget(hash: string): ExplorerTarget {
  const fallback = SPEC_SERVICES[0]?.id ?? ''
  const parsed = parseApiDocsHash(hash)
  if (!parsed?.service || !SPEC_SERVICES.some((service) => service.id === parsed.service)) {
    return { service: fallback, op: null }
  }
  return { service: parsed.service, op: parsed.op ?? null }
}

export function ApiSpecExplorer() {
  const [initialTarget] = useState<ExplorerTarget>(() =>
    resolveTarget(typeof window === 'undefined' ? '' : window.location.hash),
  )
  const [selectedId, setSelectedId] = useState<string>(initialTarget.service)
  /** operationId a deep link asked to reveal, cleared once handled. */
  const pendingOpRef = useRef<string | null>(initialTarget.op)
  /** Bumped by hashchange so the reveal effect re-runs for a new target. */
  const [revealTick, setRevealTick] = useState(0)
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

  // Follow in-page deep-link navigation (e.g. a pasted #/api-docs?service=...
  // link while the page is already open). Our own replaceState below does not
  // fire hashchange, so this never loops.
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseApiDocsHash(window.location.hash)
      if (!parsed?.service || !SPEC_SERVICES.some((service) => service.id === parsed.service)) {
        return
      }
      pendingOpRef.current = parsed.op ?? null
      setSelectedId(parsed.service)
      setRevealTick((tick) => tick + 1)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const spec = specCache.get(selectedId)
  const errorMessage = loadErrors[selectedId]

  // Once the deep-linked service's spec is rendered, expand the requested
  // operation card and bring it into view. Pure DOM synchronization: the
  // pending target lives in a ref and is consumed here.
  useEffect(() => {
    const pendingOp = pendingOpRef.current
    if (pendingOp === null || !spec) return
    // Attribute scan instead of a selector so no CSS escaping is needed.
    const card = [...document.querySelectorAll('details[data-op-card]')].find(
      (element) => element.getAttribute('data-op-card') === pendingOp,
    )
    if (card instanceof HTMLDetailsElement) {
      card.open = true
      if (typeof card.scrollIntoView === 'function') {
        try {
          card.scrollIntoView({ block: 'start', behavior: 'smooth' })
        } catch {
          // Non-visual environments (jsdom) may stub this out.
        }
      }
    }
    pendingOpRef.current = null
  }, [revealTick, spec])

  const selectService = (id: string) => {
    setSelectedId(id)
    pendingOpRef.current = null
    // Keep the address bar sharable without adding history entries or
    // re-triggering the hash router (replaceState fires no hashchange).
    if (typeof window !== 'undefined' && parseApiDocsHash(window.location.hash) !== null) {
      window.history.replaceState(null, '', buildApiDocsHash({ service: id }))
    }
  }

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
              onClick={() => selectService(service.id)}
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
                    <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-scale-xs text-success-text">
                      try-it demo
                    </span>
                  )}
                  <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-scale-xs text-text-muted">
                    {service.operationCount} ops
                  </span>
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-scale-xs leading-4 text-text-subtle">{service.summary}</p>
            </button>
          )
        })}
      </div>

      {!spec && !errorMessage && (
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 p-6 text-center text-xs text-text-subtle">
          Loading {selectedId} spec...
        </div>
      )}

      {!spec && errorMessage && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-6 text-xs text-danger-text">
          Could not load the {selectedId} spec: {errorMessage}
        </div>
      )}

      {spec && <ServiceSpecView spec={spec} groups={groups} serviceId={selectedId} />}
    </div>
  )
}
