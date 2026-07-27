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

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  latest = undefined
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

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
