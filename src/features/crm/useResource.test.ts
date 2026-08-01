// @vitest-environment jsdom
/**
 * Behaviour coverage for `useResource`, the admin console's shared loader seam
 * (SET-STATE-RATCHET slice 2, 2026-08-01), plus the first coverage of any kind
 * for `ActivitiesTab` -- the exemplar migrated onto it.
 *
 * The nine loaders on `SET_STATE_IN_EFFECT_LEGACY` all started their fetch with
 * a synchronous `setLoading(true)` (or a synchronous guard `setError`) inside
 * the mount effect. `react-hooks/set-state-in-effect` flags exactly that, and
 * the flag is sitting on a real defect: an effect runs AFTER the commit, so the
 * first painted frame is the component's idle state. For these tabs the idle
 * state is `rows.length === 0 && !loading && !error`, which renders the
 * "No activities yet" empty-state card. The user gets a "nothing here" flash
 * before the spinner that should have been there from the start, and React
 * re-renders to correct it.
 *
 * Contract A drives the hook's state machine directly. Contract B is the
 * behaviour difference: an inline probe reproducing the OLD loader shape is
 * asserted to emit the idle frame, and the new hook is asserted not to -- so
 * the two shapes are compared in one file rather than in a commit message.
 * Contract C renders the migrated `ActivitiesTab` end to end against a stubbed
 * fetch, covering the blocked, loading, loaded, failed and retry paths.
 *
 * Harness: the `react-dom/client` + `act` probe precedent from
 * `src/features/site/useContentHooks.test.ts`.
 */
import { act, createElement, useCallback, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivitiesTab } from './ActivitiesTab'
import { NO_TOKEN_MSG } from './ui'
import { resourceErrorMessage, useResource, type Resource } from './useResource'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  localStorage.clear()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  localStorage.clear()
})

/** A never-expiring token in the shape `resolveAdminToken` accepts. */
function validToken(): string {
  const body = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${btoa(JSON.stringify({ alg: 'HS256' }))}.${body}.sig`
}

/** One entry per render, so an intermediate frame cannot hide behind the last. */
type Frame<T> = { data: T; loading: boolean; error: string | null }

/** `Array.prototype.at` is outside this repo's `lib` target; index instead. */
const last = <T,>(frames: Frame<T>[]): Frame<T> => frames[frames.length - 1]

function recorder<T>(frames: Frame<T>[]) {
  return (resource: Resource<T>) => {
    frames.push({ data: resource.data, loading: resource.loading, error: resource.error })
    return null
  }
}

/** Flush the mount effect plus the microtask its promise settles on. */
async function flush(): Promise<void> {
  await act(async () => {})
  await act(async () => {})
}

describe('useResource', () => {
  describe('contract A: the state machine', () => {
    it('is loading from the very first render, before any effect runs', async () => {
      const frames: Frame<string[]>[] = []
      const Probe = () => {
        const fetcher = useCallback(async () => ['a'], [])
        return recorder(frames)(useResource([] as string[], fetcher))
      }

      await act(async () => {
        root.render(createElement(Probe))
      })
      await flush()

      expect(frames[0]).toEqual({ data: [], loading: true, error: null })
      expect(last(frames)).toEqual({ data: ['a'], loading: false, error: null })
      // No frame is ever both idle and empty: that frame IS the flash.
      expect(frames.some((f) => !f.loading && f.error === null && f.data.length === 0)).toBe(false)
    })

    it('never calls the fetcher when blocked, and reports the reason on frame one', async () => {
      const fetcher = vi.fn(async () => ['a'])
      const frames: Frame<string[]>[] = []
      const Probe = () => {
        const stable = useCallback(fetcher, [])
        return recorder(frames)(useResource([] as string[], stable, 'not configured'))
      }

      await act(async () => {
        root.render(createElement(Probe))
      })
      await flush()

      expect(fetcher).not.toHaveBeenCalled()
      expect(frames[0]).toEqual({ data: [], loading: false, error: 'not configured' })
    })

    it('surfaces a rejection as an error and stops loading', async () => {
      const frames: Frame<string[]>[] = []
      const Probe = () => {
        const fetcher = useCallback(async () => {
          throw new Error('503 Service Unavailable')
        }, [])
        return recorder(frames)(useResource([] as string[], fetcher))
      }

      await act(async () => {
        root.render(createElement(Probe))
      })
      await flush()

      expect(last(frames)).toEqual({ data: [], loading: false, error: '503 Service Unavailable' })
    })

    it('reload() re-runs the fetcher, clears the error and keeps the rows on screen', async () => {
      const frames: Frame<string[]>[] = []
      let reload = () => {}
      let attempt = 0
      const Probe = () => {
        const fetcher = useCallback(async () => {
          attempt += 1
          if (attempt === 2) throw new Error('boom')
          return [`load-${attempt}`]
        }, [])
        const resource = useResource([] as string[], fetcher)
        reload = resource.reload
        return recorder(frames)(resource)
      }

      await act(async () => {
        root.render(createElement(Probe))
      })
      await flush()
      expect(last(frames)).toEqual({ data: ['load-1'], loading: false, error: null })

      frames.length = 0
      await act(async () => reload())
      await flush()
      // While the failing reload is in flight the previous rows stay rendered
      // and the error is cleared -- the hand-written `setLoading(true);
      // setError(null)` prefix, without the effect-time write.
      expect(frames[0]).toEqual({ data: ['load-1'], loading: true, error: null })
      expect(last(frames)).toEqual({ data: ['load-1'], loading: false, error: 'boom' })

      frames.length = 0
      await act(async () => reload())
      await flush()
      expect(last(frames)).toEqual({ data: ['load-3'], loading: false, error: null })
      expect(attempt).toBe(3)
    })

    it('re-loads when the fetcher identity changes (the filter-driven tabs)', async () => {
      const seen: string[] = []
      const frames: Frame<string[]>[] = []
      let setFilter: (value: string) => void = () => {}
      const Probe = () => {
        const [filter, set] = useState('all')
        setFilter = set
        const fetcher = useCallback(async () => {
          seen.push(filter)
          return [filter]
        }, [filter])
        return recorder(frames)(useResource([] as string[], fetcher))
      }

      await act(async () => {
        root.render(createElement(Probe))
      })
      await flush()
      expect(last(frames)).toEqual({ data: ['all'], loading: false, error: null })

      frames.length = 0
      await act(async () => setFilter('gcp'))
      await flush()
      expect(seen).toEqual(['all', 'gcp'])
      expect(frames[0]).toEqual({ data: ['all'], loading: true, error: null })
      expect(last(frames)).toEqual({ data: ['gcp'], loading: false, error: null })
    })

    it('ignores a settle that lands after unmount', async () => {
      let release: (rows: string[]) => void = () => {}
      const frames: Frame<string[]>[] = []
      const Probe = () => {
        const fetcher = useCallback(
          () =>
            new Promise<string[]>((resolve) => {
              release = resolve
            }),
          [],
        )
        return recorder(frames)(useResource([] as string[], fetcher))
      }

      await act(async () => {
        root.render(createElement(Probe))
      })
      const framesAtUnmount = frames.length
      await act(async () => root.unmount())
      await act(async () => release(['late']))
      await flush()

      expect(frames.length).toBe(framesAtUnmount)
    })

    it('normalises non-Error rejections', () => {
      expect(resourceErrorMessage(new Error('typed'))).toBe('typed')
      expect(resourceErrorMessage('plain string')).toBe('plain string')
      expect(resourceErrorMessage(404)).toBe('404')
    })
  })

  describe('contract B: the behaviour difference against the shape it replaces', () => {
    /**
     * The exact loader every listed file shipped, inlined so the comparison is
     * executable. If this probe ever stops emitting the idle frame, the class
     * this increment fixes has gone away and contract B can retire.
     */
    function useLegacyLoader(fetcher: () => Promise<string[]>) {
      const [rows, setRows] = useState<string[]>([])
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState<string | null>(null)
      const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
          setRows(await fetcher())
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        } finally {
          setLoading(false)
        }
      }, [fetcher])
      useEffect(() => {
        load()
      }, [load])
      return { data: rows, loading, error, reload: load }
    }

    it('the legacy loader paints one idle, empty frame; useResource paints none', async () => {
      const legacy: Frame<string[]>[] = []
      const Legacy = () => {
        const fetcher = useCallback(async () => ['a'], [])
        return recorder(legacy)(useLegacyLoader(fetcher) as Resource<string[]>)
      }
      await act(async () => {
        root.render(createElement(Legacy))
      })
      await flush()

      const isFlash = (f: Frame<string[]>) => !f.loading && f.error === null && f.data.length === 0
      expect(legacy.filter(isFlash).length).toBeGreaterThan(0)
      expect(legacy[0]).toEqual({ data: [], loading: false, error: null })

      const modern: Frame<string[]>[] = []
      const Modern = () => {
        const fetcher = useCallback(async () => ['a'], [])
        return recorder(modern)(useResource([] as string[], fetcher))
      }
      await act(async () => {
        root.render(createElement(Modern))
      })
      await flush()

      expect(modern.filter(isFlash)).toEqual([])
      // Fewer commits for the identical outcome: the cascading render is gone.
      expect(modern.length).toBeLessThan(legacy.length)
    })
  })

  describe('contract C: ActivitiesTab on the seam', () => {
    const row = {
      id: 'act-1',
      activity_type: 'email',
      subject: 'Kickoff email',
      completed: false,
      created_at: '2026-08-01T10:00:00Z',
    }

    function stubFetch(impl: () => Promise<unknown>) {
      const stub = vi.fn(async () => {
        const body = await impl()
        return { ok: true, status: 200, statusText: 'OK', json: async () => body }
      })
      vi.stubGlobal('fetch', stub)
      return stub
    }

    it('renders the no-token error on the first paint and never calls fetch', async () => {
      const stub = stubFetch(async () => [])

      await act(async () => {
        root.render(createElement(ActivitiesTab))
      })
      await flush()

      expect(container.textContent).toContain(NO_TOKEN_MSG)
      expect(container.textContent).not.toContain('No activities yet')
      expect(stub).not.toHaveBeenCalled()
    })

    it('shows the spinner rather than the empty state while loading, then the rows', async () => {
      localStorage.setItem('portal_token', validToken())
      let release: (rows: unknown[]) => void = () => {}
      const stub = stubFetch(() => new Promise((resolve) => { release = resolve }))

      await act(async () => {
        root.render(createElement(ActivitiesTab))
      })

      expect(container.textContent).toContain('Loading activities…')
      expect(container.textContent).not.toContain('No activities yet')

      await act(async () => release([row]))
      await flush()

      expect(stub).toHaveBeenCalledTimes(1)
      expect(container.textContent).toContain('Kickoff email')
      expect(container.textContent).toContain('1 record')
      expect(container.textContent).not.toContain('Loading activities…')
    })

    it('renders the empty state only once an empty list has actually loaded', async () => {
      localStorage.setItem('portal_token', validToken())
      stubFetch(async () => [])

      await act(async () => {
        root.render(createElement(ActivitiesTab))
      })
      await flush()

      expect(container.textContent).toContain('No activities yet')
    })

    it('surfaces a failed load and re-fetches from Retry', async () => {
      localStorage.setItem('portal_token', validToken())
      let calls = 0
      const stub = vi.fn(async () => {
        calls += 1
        if (calls === 1) return { ok: false, status: 503, statusText: 'Service Unavailable', text: async () => 'down' }
        return { ok: true, status: 200, statusText: 'OK', json: async () => [row] }
      })
      vi.stubGlobal('fetch', stub)

      await act(async () => {
        root.render(createElement(ActivitiesTab))
      })
      await flush()
      expect(container.textContent).toContain('503 Service Unavailable')

      const retry = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Retry')
      expect(retry).toBeDefined()
      await act(async () => retry!.click())
      await flush()

      expect(stub).toHaveBeenCalledTimes(2)
      expect(container.textContent).toContain('Kickoff email')
    })
  })
})
