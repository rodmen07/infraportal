// @vitest-environment jsdom
/**
 * First behavior coverage for the five content hooks (QA 2026-07-26, L-014:
 * usePricingContent / useServicesContent / useCaseStudiesContent shipped
 * 2026-05-01, useSiteContent the same day, useHomeSectionsContent 2026-06-25,
 * and none was referenced by any test until this file). Renders each hook
 * through a probe component against a stubbed fetch, per the render harness
 * precedent in src/components/ProjectCloneModal.test.ts, and locks the
 * currently shipped semantics:
 *
 *   - the payload replaces the default on a 200,
 *   - the default survives a 404, a malformed body, and a network failure
 *     (the silent-fallback behavior contract B of contentContract.test.ts
 *     exists to keep honest: a fetch failure EMPTIES the pricing grid),
 *   - each hook requests `${baseUrl}content/<file>.json`,
 *   - useSiteContent falls back per-field and writes document.title,
 *   - useHomeSectionsContent drops cards missing heading or body and
 *     resolves relative media URLs against the base.
 */

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCaseStudiesContent } from '../consulting/useCaseStudiesContent'
import { usePricingContent } from '../consulting/usePricingContent'
import { useServicesContent } from '../consulting/useServicesContent'
import { useHomeSectionsContent } from './useHomeSectionsContent'
import { useSiteContent } from './useSiteContent'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let latest: unknown
let mounted: boolean

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  latest = undefined
  mounted = true
})

afterEach(() => {
  if (mounted) act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

/** Unmount inside the test body (the lifetime tests below need to observe a
 *  fetch resolving AFTER unmount); the `mounted` flag keeps afterEach from
 *  unmounting twice (the pricingViewAnalytics.test.ts precedent). */
function unmountProbe(): void {
  act(() => root.unmount())
  mounted = false
}

type AnyHook = (baseUrl: string) => unknown

function Probe({ hook, baseUrl }: { hook: AnyHook; baseUrl: string }) {
  latest = hook(baseUrl)
  return null
}

/** Render the hook and flush the async load; returns the latest hook value. */
async function renderHook(hook: AnyHook, baseUrl = '/base/'): Promise<unknown> {
  await act(async () => {
    root.render(createElement(Probe, { hook, baseUrl }))
  })
  // One extra microtask flush so setContent from the awaited fetch lands.
  await act(async () => {})
  return latest
}

function stubFetchOk(payload: unknown): ReturnType<typeof vi.fn> {
  const stub = vi.fn(async () => ({ ok: true, json: async () => payload }))
  vi.stubGlobal('fetch', stub)
  return stub
}

function stubFetch404(): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    json: async () => ({}),
  })))
}

function stubFetchMalformed(): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError('Unexpected token in JSON')
    },
  })))
}

function stubFetchNetworkFailure(): void {
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  }))
}

// ---------------------------------------------------------------------------
// The three simple consulting hooks share one shape: default in, payload out.
// ---------------------------------------------------------------------------

const SIMPLE_HOOKS = [
  {
    name: 'usePricingContent',
    hook: usePricingContent as AnyHook,
    file: 'pricing.json',
    payload: {
      note: 'from payload',
      tiers: [
        {
          tier: 'T',
          price: '$1',
          description: 'd',
          features: ['f'],
          highlighted: false,
          ctaLabel: 'c',
          ctaHref: '#/contact',
          checkoutUrl: null,
          scarcity: null,
        },
      ],
    },
    expectDefault: (content: unknown) => {
      const c = content as { note: string; tiers: unknown[] }
      expect(c.note).toBe('All engagements start with a free 30-minute discovery call.')
      expect(c.tiers).toEqual([])
    },
    expectPayload: (content: unknown) => {
      const c = content as { note: string; tiers: unknown[] }
      expect(c.note).toBe('from payload')
      expect(c.tiers).toHaveLength(1)
    },
  },
  {
    name: 'useServicesContent',
    hook: useServicesContent as AnyHook,
    file: 'services.json',
    payload: { intro: 'from payload', services: [{ title: 't', description: 'd', tags: ['x'] }] },
    expectDefault: (content: unknown) => {
      const c = content as { intro: string; services: unknown[] }
      expect(c.intro).toMatch(/^End-to-end cloud engineering/)
      expect(c.services).toEqual([])
    },
    expectPayload: (content: unknown) => {
      const c = content as { intro: string; services: unknown[] }
      expect(c.intro).toBe('from payload')
      expect(c.services).toHaveLength(1)
    },
  },
  {
    name: 'useCaseStudiesContent',
    hook: useCaseStudiesContent as AnyHook,
    file: 'case_studies.json',
    payload: {
      intro: 'from payload',
      featured: { title: 'F', subtitle: 's', description: 'd', techStack: ['x'], highlights: ['h'] },
      others: [],
    },
    expectDefault: (content: unknown) => {
      const c = content as { intro: string; featured: { title: string }; others: unknown[] }
      expect(c.intro).toBe('Real systems, shipped to production.')
      expect(c.featured.title).toBe('')
      expect(c.others).toEqual([])
    },
    expectPayload: (content: unknown) => {
      const c = content as { intro: string; featured: { title: string } }
      expect(c.intro).toBe('from payload')
      expect(c.featured.title).toBe('F')
    },
  },
] as const

describe.each(SIMPLE_HOOKS)('$name', ({ hook, file, payload, expectDefault, expectPayload }) => {
  it('requests the content file under the base URL', async () => {
    const stub = stubFetchOk(payload)
    await renderHook(hook, '/repo-base/')
    expect(stub).toHaveBeenCalledWith(`/repo-base/content/${file}`)
  })

  it('applies the payload on a 200', async () => {
    stubFetchOk(payload)
    expectPayload(await renderHook(hook))
  })

  it('keeps the default on a 404 (the silent-fallback contract)', async () => {
    stubFetch404()
    expectDefault(await renderHook(hook))
  })

  it('keeps the default on a malformed body', async () => {
    stubFetchMalformed()
    expectDefault(await renderHook(hook))
  })

  it('keeps the default on a network failure', async () => {
    stubFetchNetworkFailure()
    expectDefault(await renderHook(hook))
  })
})

// ---------------------------------------------------------------------------
// useSiteContent: per-field fallback plus the document.title side effect.
// ---------------------------------------------------------------------------

describe('useSiteContent', () => {
  it('applies the payload and writes document.title', async () => {
    stubFetchOk({ title: 'Payload Title', subtitle: 'Sub', heroTagline: 'Tag' })
    const content = (await renderHook(useSiteContent as AnyHook)) as {
      title: string
      subtitle: string
      heroTagline?: string
    }
    expect(content).toEqual({ title: 'Payload Title', subtitle: 'Sub', heroTagline: 'Tag' })
    expect(document.title).toBe('Payload Title')
  })

  it('keeps the default on a 404, and the default title still reaches document.title', async () => {
    stubFetch404()
    const content = (await renderHook(useSiteContent as AnyHook)) as { title: string }
    expect(content.title).toBe('R.M. Cloud Consulting')
    expect(document.title).toBe('R.M. Cloud Consulting')
  })

  it('falls back per-field: an empty title takes the default, a missing subtitle becomes empty', async () => {
    // Locks the SHIPPED semantics: title and heroTagline fall back to their
    // defaults, subtitle falls back to the empty string (not the default
    // subtitle). contentContract.test.ts contract B is what keeps the
    // committed file complete so this asymmetry never shows.
    stubFetchOk({ title: '' })
    const content = (await renderHook(useSiteContent as AnyHook)) as {
      title: string
      subtitle: string
      heroTagline?: string
    }
    expect(content.title).toBe('R.M. Cloud Consulting')
    expect(content.subtitle).toBe('')
    expect(content.heroTagline).toBe('AI + Cloud Launchpad')
  })

  it('requests the site content under the base URL', async () => {
    const stub = stubFetchOk({ title: 't', subtitle: 's' })
    await renderHook(useSiteContent as AnyHook, '/repo-base/')
    expect(stub).toHaveBeenCalledWith('/repo-base/content/site.json')
  })
})

// ---------------------------------------------------------------------------
// useHomeSectionsContent: the card filter and media URL resolution.
// ---------------------------------------------------------------------------

describe('useHomeSectionsContent', () => {
  it('applies valid cards and drops cards missing heading or body', async () => {
    stubFetchOk({
      title: 'From payload',
      cards: [
        { heading: 'Keep', body: 'kept' },
        { heading: 'No body' },
        { body: 'no heading' },
      ],
    })
    const content = (await renderHook(useHomeSectionsContent as AnyHook)) as {
      title: string
      cards: Array<{ heading: string }>
    }
    expect(content.title).toBe('From payload')
    expect(content.cards.map((c) => c.heading)).toEqual(['Keep'])
  })

  it('keeps the default cards when cards is not an array', async () => {
    stubFetchOk({ title: 'T', cards: 'not-an-array' })
    const content = (await renderHook(useHomeSectionsContent as AnyHook)) as {
      cards: Array<{ heading: string }>
    }
    expect(content.cards.map((c) => c.heading)).toEqual(['Cloud Architecture'])
  })

  it('resolves media URLs: absolute passes through, relative joins the base, empty drops', async () => {
    stubFetchOk({
      title: 'T',
      cards: [
        { heading: 'abs', body: 'b', image: 'https://example.com/x.png' },
        { heading: 'rel', body: 'b', image: 'uploads/y.png' },
        { heading: 'slash', body: 'b', image: '/uploads/z.png' },
        { heading: 'blank', body: 'b', image: '   ' },
      ],
    })
    const content = (await renderHook(useHomeSectionsContent as AnyHook, '/base')) as {
      cards: Array<{ heading: string; image?: string }>
    }
    const byHeading = Object.fromEntries(content.cards.map((c) => [c.heading, c.image]))
    expect(byHeading.abs).toBe('https://example.com/x.png')
    expect(byHeading.rel).toBe('/base/uploads/y.png')
    expect(byHeading.slash).toBe('/base/uploads/z.png')
    expect(byHeading.blank).toBeUndefined()
  })

  it('keeps the default on a 404', async () => {
    stubFetch404()
    const content = (await renderHook(useHomeSectionsContent as AnyHook)) as {
      title: string
      cards: unknown[]
    }
    expect(content.title).toBe('What I help with')
    expect(content.cards).toHaveLength(1)
  })

  it('keeps the default on a malformed body', async () => {
    stubFetchMalformed()
    const content = (await renderHook(useHomeSectionsContent as AnyHook)) as { title: string }
    expect(content.title).toBe('What I help with')
  })
})

// ---------------------------------------------------------------------------
// The typed-decode guard (QA 2026-08-01, L-015 sibling sweep).
//
// Three hooks decoded the response with a bare `as SomeContent`, which asserts
// a shape rather than checking one. A body that is valid JSON but the WRONG
// SHAPE - a content edit that drops a key, a CDN handing back a neighbouring
// document - therefore replaced the default wholesale, and the consuming page
// then read `.length` off `undefined` and threw into the root error boundary.
// Proven for pricing by revert-and-rerun: without the guard,
// `pricingViewAnalytics.test.ts` contract F fails with
// `TypeError: Cannot read properties of undefined (reading 'length')`.
//
// `contentContract.test.ts` cannot cover this: it validates the COMMITTED
// files, and the defect is about what the browser is handed at runtime.
//
// The other two hooks are NOT in the class and deliberately stay unchanged:
// `useSiteContent` and `useHomeSectionsContent` build their next state field by
// field inside the `try`, so a null or garbage payload throws into their own
// catch and the default already survives (the two cases just above prove it).
// ---------------------------------------------------------------------------

describe('wrong-shape payloads keep the default instead of taking the page down', () => {
  const WRONG_SHAPE = [
    {
      name: 'usePricingContent',
      hook: usePricingContent as AnyHook,
      payload: { note: 'a typo dropped the tiers key' },
      arrayField: 'tiers',
      goodPayload: { note: 'ok', tiers: [] },
    },
    {
      name: 'useServicesContent',
      hook: useServicesContent as AnyHook,
      payload: { intro: 'a typo dropped the services key' },
      arrayField: 'services',
      goodPayload: { intro: 'ok', services: [] },
    },
    {
      name: 'useCaseStudiesContent',
      hook: useCaseStudiesContent as AnyHook,
      payload: { intro: 'a typo dropped the others key' },
      arrayField: 'others',
      goodPayload: {
        intro: 'ok',
        featured: { title: '', subtitle: '', description: '', techStack: [], highlights: [] },
        others: [],
      },
    },
  ] as const

  it.each(WRONG_SHAPE)('$name: a body missing $arrayField never yields a non-array', async ({ hook, payload, arrayField }) => {
    stubFetchOk(payload)
    const content = (await renderHook(hook)) as Record<string, unknown>
    expect(Array.isArray(content[arrayField])).toBe(true)
    expect(content[arrayField]).toEqual([])
  })

  it.each(WRONG_SHAPE)('$name: a null body never yields a non-array', async ({ hook, arrayField }) => {
    stubFetchOk(null)
    const content = (await renderHook(hook)) as Record<string, unknown>
    expect(Array.isArray(content[arrayField])).toBe(true)
  })

  it.each(WRONG_SHAPE)('$name: a well-shaped body is still accepted, so the guard is not rejecting everything', async ({
    hook,
    goodPayload,
    arrayField,
  }) => {
    stubFetchOk(goodPayload)
    const content = (await renderHook(hook)) as Record<string, unknown>
    expect(Array.isArray(content[arrayField])).toBe(true)
    expect((content as { intro?: string; note?: string }).intro ?? (content as { note?: string }).note).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// The `active` lifetime flag (v1.23.3, D-13; L-015 sibling sweep of the
// PR #118 `usePricingContent` fix).
//
// Every content hook fetches inside a mount effect and writes state after the
// await. Without a lifetime flag, an effect instance that has been CLEANED UP
// (its `baseUrl` changed, or the component unmounted) still runs its
// continuation when the response finally arrives. The observable defect is the
// race: render against base A, re-render against base B, and A's slower
// response lands LAST - overwriting B's fresher content, and for
// `useSiteContent` pushing the stale title into `document.title` through its
// title effect. The race tests below are the L-001 on/off proof: revert any
// hook's `active` flag and that hook's race test goes red.
//
// The unmount tests pin the other half of the contract: a response resolving
// after unmount writes nothing observable (for `useSiteContent`,
// `document.title` is the live consumer that keeps this assertion out of
// dead-surface territory - a post-unmount write could only ever surface
// there). React 18 already no-ops a bare setState on an unmounted root, so
// the unmount case alone cannot distinguish flag from no-flag; the race test
// above is what carries the behaviour difference.
// ---------------------------------------------------------------------------

/** One controllable deferred per fetch call, resolvable out of order. */
function stubFetchDeferredQueue(): {
  calls: () => number
  resolveCall: (index: number, payload: unknown) => void
} {
  const resolvers: Array<(response: { ok: boolean; json: () => Promise<unknown> }) => void> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
          resolvers.push(resolve)
        }),
    ),
  )
  return {
    calls: () => resolvers.length,
    resolveCall: (index, payload) => {
      resolvers[index]({ ok: true, json: async () => payload })
    },
  }
}

const LIFETIME_HOOKS = [
  {
    name: 'useSiteContent',
    hook: useSiteContent as AnyHook,
    freshPayload: { title: 'Fresh Title', subtitle: 'fresh', heroTagline: 'f' },
    stalePayload: { title: 'Stale Title', subtitle: 'stale', heroTagline: 's' },
    readMarker: (content: unknown) => (content as { title: string }).title,
    freshMarker: 'Fresh Title',
  },
  {
    name: 'useHomeSectionsContent',
    hook: useHomeSectionsContent as AnyHook,
    freshPayload: { title: 'Fresh Sections', cards: [{ heading: 'h', body: 'b' }] },
    stalePayload: { title: 'Stale Sections', cards: [{ heading: 'h', body: 'b' }] },
    readMarker: (content: unknown) => (content as { title: string }).title,
    freshMarker: 'Fresh Sections',
  },
  {
    name: 'useCaseStudiesContent',
    hook: useCaseStudiesContent as AnyHook,
    freshPayload: {
      intro: 'fresh intro',
      featured: { title: 'F', subtitle: 's', description: 'd', techStack: [], highlights: [] },
      others: [],
    },
    stalePayload: {
      intro: 'stale intro',
      featured: { title: 'F', subtitle: 's', description: 'd', techStack: [], highlights: [] },
      others: [],
    },
    readMarker: (content: unknown) => (content as { intro: string }).intro,
    freshMarker: 'fresh intro',
  },
  {
    name: 'useServicesContent',
    hook: useServicesContent as AnyHook,
    freshPayload: { intro: 'fresh intro', services: [] },
    stalePayload: { intro: 'stale intro', services: [] },
    readMarker: (content: unknown) => (content as { intro: string }).intro,
    freshMarker: 'fresh intro',
  },
] as const

describe('the active lifetime flag (v1.23.3): dead hook instances cannot write', () => {
  it.each(LIFETIME_HOOKS)(
    '$name: a stale response for a previous baseUrl cannot overwrite fresher content',
    async ({ hook, freshPayload, stalePayload, readMarker, freshMarker }) => {
      const deferred = stubFetchDeferredQueue()
      await act(async () => {
        root.render(createElement(Probe, { hook, baseUrl: '/a/' }))
      })
      await act(async () => {
        root.render(createElement(Probe, { hook, baseUrl: '/b/' }))
      })
      expect(deferred.calls(), 'one fetch per baseUrl').toBe(2)

      // The fresh load (base B) answers first ...
      await act(async () => {
        deferred.resolveCall(1, freshPayload)
      })
      expect(readMarker(latest)).toBe(freshMarker)

      // ... and the stale load (base A) answers LAST. Its effect instance was
      // cleaned up at the re-render, so `active` is false and the write must
      // be skipped. Without the flag, this assertion reads the stale marker.
      await act(async () => {
        deferred.resolveCall(0, stalePayload)
      })
      expect(readMarker(latest)).toBe(freshMarker)
    },
  )

  it('useSiteContent: the stale late response cannot reach document.title either', async () => {
    const deferred = stubFetchDeferredQueue()
    await act(async () => {
      root.render(createElement(Probe, { hook: useSiteContent as AnyHook, baseUrl: '/a/' }))
    })
    await act(async () => {
      root.render(createElement(Probe, { hook: useSiteContent as AnyHook, baseUrl: '/b/' }))
    })
    await act(async () => {
      deferred.resolveCall(1, { title: 'Fresh Title', subtitle: 'x', heroTagline: 'y' })
    })
    expect(document.title).toBe('Fresh Title')
    await act(async () => {
      deferred.resolveCall(0, { title: 'Stale Title', subtitle: 'x', heroTagline: 'y' })
    })
    expect(document.title).toBe('Fresh Title')
  })

  it.each(LIFETIME_HOOKS)(
    '$name: a fetch resolving after unmount writes nothing observable',
    async ({ hook, stalePayload }) => {
      const deferred = stubFetchDeferredQueue()
      await act(async () => {
        root.render(createElement(Probe, { hook, baseUrl: '/a/' }))
      })
      expect(deferred.calls()).toBe(1)

      unmountProbe()
      const titleAtUnmount = document.title

      deferred.resolveCall(0, stalePayload)
      // Flush the continuation's microtasks (json decode + the guarded write).
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(document.title).toBe(titleAtUnmount)
    },
  )
})
