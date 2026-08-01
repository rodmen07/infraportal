import { useCallback, useEffect, useState } from 'react'

/**
 * The admin console's shared "load a list from a service" seam.
 *
 * Every CRM tab and admin page grew its own copy of the same loader:
 *
 *     const [rows, setRows]       = useState<T[]>([])
 *     const [loading, setLoading] = useState(false)
 *     const [error, setError]     = useState<string | null>(null)
 *     const load = useCallback(async () => {
 *       if (!URL) { setError('... not configured.'); return }
 *       if (!resolveAdminToken()) { setError(NO_TOKEN_MSG); return }
 *       setLoading(true); setError(null)
 *       try { setRows(await api<T[]>(...)) }
 *       catch (e) { setError(...) } finally { setLoading(false) }
 *     }, [])
 *     useEffect(() => { load() }, [load])
 *
 * Nine files shipped that shape, and all nine sit on the
 * `SET_STATE_IN_EFFECT_LEGACY` list in `eslint.config.js` because of it. The
 * violation is not stylistic. The guard branches and the `setLoading(true)`
 * prefix run SYNCHRONOUSLY inside the mount effect, so the first painted frame
 * shows neither the spinner nor the error -- it shows the component's idle
 * state, which for these tabs is the "No activities yet" empty state. The user
 * sees a "nothing here" card flash before the spinner it should have started
 * with, and React does a second render pass to correct it.
 *
 * This hook removes the synchronous setState instead of hiding it:
 *
 *   - **`blocked` is computed by the caller during render**, so a refused load
 *     is the FIRST render's error rather than something an effect assigns.
 *   - **`loading` is derived, never set.** Nothing has settled for the current
 *     `(fetcher, run)` pair until the promise resolves, and "not settled yet"
 *     IS loading. That is why the effect body contains no setState at all: the
 *     only writes happen in the promise continuations, after an await boundary.
 *   - **`reload()` is an event-handler write** (a run counter), which is the
 *     placement `react-hooks/set-state-in-effect` is asking for.
 *
 * Callers pass a `useCallback`-stable `fetcher`. Its identity is part of the
 * freshness key, so a tab whose fetcher closes over filters (SpendTab,
 * AuditPage) re-loads when the filters change and shows the spinner again
 * without any extra bookkeeping.
 */

/** Normalises a rejection into the message shape the admin UI renders. */
export function resourceErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * The outcome of one completed attempt. `fetcher` and `run` together identify
 * WHICH attempt it was, so a stale settle can never mark the current one done.
 */
type Settled<T> = {
  readonly data: T
  readonly error: string | null
  readonly fetcher: () => Promise<T>
  readonly run: number
}

export interface Resource<T> {
  /** The last successfully loaded value; the initial value until one lands. */
  readonly data: T
  /** True while an attempt for the current fetcher/run is outstanding. */
  readonly loading: boolean
  /** The block reason if blocked, else the last attempt's failure, else null. */
  readonly error: string | null
  /** Re-runs the fetcher. Safe to pass straight to onClick/onRetry. */
  readonly reload: () => void
}

export function useResource<T>(
  initial: T,
  fetcher: () => Promise<T>,
  blocked: string | null = null,
): Resource<T> {
  // Captured once, via a lazy initialiser rather than a ref: callers may write
  // `useResource([], ...)` with a fresh array literal per render, the identity
  // of the pre-load value must not churn, and `react-hooks/refs` (correctly)
  // forbids reading a ref during render, which is where `data` is produced.
  const [initialValue] = useState(() => initial)
  const [run, setRun] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  const fresh = settled !== null && settled.fetcher === fetcher && settled.run === run

  useEffect(() => {
    if (blocked !== null) return
    let cancelled = false
    // Deliberately no setState before the await boundary: see the header.
    fetcher().then(
      (data) => {
        if (!cancelled) setSettled({ data, error: null, fetcher, run })
      },
      (cause) => {
        if (cancelled) return
        // A failed reload keeps the rows already on screen, which is what the
        // hand-written loaders did (they only ever setError on the way out).
        setSettled((previous) => ({
          data: previous ? previous.data : initialValue,
          error: resourceErrorMessage(cause),
          fetcher,
          run,
        }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [blocked, fetcher, initialValue, run])

  const reload = useCallback(() => setRun((n) => n + 1), [])

  return {
    data: settled ? settled.data : initialValue,
    loading: blocked === null && !fresh,
    error: blocked ?? (fresh ? settled.error : null),
    reload,
  }
}
