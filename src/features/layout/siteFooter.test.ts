// @vitest-environment jsdom
/**
 * Site-footer guard (v1.20.3, decision D-3).
 *
 * The status board (NF-1 PR2) shipped with no discoverable entry point: the
 * marketing nav deliberately excludes app/workspace items (navItems.test.ts's
 * "should NOT include Status item" case) and this site had no footer at all -
 * verified 2026-07-25 by four searches that all came back empty. D-3 answers
 * that with a persistent <footer> landmark instead of reopening the nav
 * decision, so BOTH guards can hold at once.
 *
 * This file is a DRIFT GUARD, not a one-time reconciliation (L-003). Every
 * assertion below reads both sides of a contract, so the pairing cannot rot:
 *
 *   1. unconditional mount  `<SiteFooter />` in main.tsx's render tree vs the
 *                           body of `Root()` (the route-conditional chain). A
 *                           footer moved inside Root becomes per-route, which
 *                           is exactly the regression "renders on every route"
 *                           is meant to exclude.
 *   2. destinations         every internal footer href vs the route vocabulary
 *                           parsed out of src/main.tsx, the pattern
 *                           routeIntegrity.test.ts established.
 *   3. the D-3 pairing      NAV_ITEMS (no Status) vs FOOTER_LINKS (Status), so
 *                           moving Status into the nav, or dropping it from
 *                           the footer, fails here rather than silently
 *                           un-answering D-3.
 *   4. the boot watchdog    the `main, section, nav, [data-app-ready]`
 *                           selector parsed out of main.tsx vs what the footer
 *                           actually renders. The footer is the first thing on
 *                           the page that renders unconditionally, so a <nav>
 *                           inside it would satisfy that query on every load
 *                           and permanently disable the failure screen for a
 *                           broken page. That is why the links are a <ul>.
 *
 * Rendering assertions use the repo's jsdom style (TemplateLibrary.test.ts,
 * TryItPanel.test.ts); router wiring is asserted by scanning main.tsx's source,
 * because that tree is node-env hostile (routeIntegrity.test.ts, tokens.test.ts).
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SiteFooter } from './SiteFooter'
import { FOOTER_LINKS, isExternalFooterHref } from './footerLinks'
import { NAV_ITEMS } from './navItems'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const MAIN_SRC = read('src/main.tsx')
const MAIN_CODE = stripComments(MAIN_SRC)
const FOOTER_CODE = stripComments(read('src/features/layout/SiteFooter.tsx'))

// --------------------------------------------------------------------------
// Router vocabulary, parsed the same way routeIntegrity.test.ts parses it.
// --------------------------------------------------------------------------
interface RouteVocabulary {
  exact: Set<string>
  prefixes: string[]
}

function parseRouteVocabulary(source: string): RouteVocabulary {
  const exact = new Set<string>()
  for (const m of source.matchAll(/hash === '(#\/[^']*)'/g)) exact.add(m[1])
  const prefixes: string[] = []
  for (const m of source.matchAll(/hash\.startsWith\('(#\/[^']*)'\)/g)) prefixes.push(m[1])
  return { exact, prefixes }
}

const VOCAB = parseRouteVocabulary(MAIN_SRC)

function resolves(href: string): boolean {
  if (href === '#/' || href === '') return true
  if (VOCAB.exact.has(href)) return true
  return VOCAB.prefixes.some((p) => href.startsWith(p))
}

/** The body of `Root()` — the route-conditional chain — sliced out of main.tsx. */
function rootFunctionBody(source: string): string {
  const start = source.indexOf('function Root()')
  const end = source.indexOf('const rootElement')
  expect(start, 'main.tsx no longer declares function Root()').toBeGreaterThan(-1)
  expect(end, 'main.tsx no longer declares const rootElement').toBeGreaterThan(start)
  return source.slice(start, end)
}

/** The boot watchdog's "did the app render" selector, read from its source. */
function watchdogSelector(source: string): string {
  const match = source.match(/rootElement\.querySelector\('([^']+)'\)/)
  expect(match, 'the boot watchdog selector could not be parsed out of main.tsx').not.toBeNull()
  return match![1]
}

// --------------------------------------------------------------------------
// Render harness (repo jsdom style).
// --------------------------------------------------------------------------
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(createElement(SiteFooter)))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const anchors = () => Array.from(container.querySelectorAll('a'))

describe('the footer is mounted unconditionally, so it renders on every route', () => {
  it('main.tsx imports SiteFooter', () => {
    expect(MAIN_CODE).toMatch(/import \{ SiteFooter \} from '\.\/features\/layout\/SiteFooter'/)
  })

  it('renders <SiteFooter /> in the root render tree', () => {
    expect(MAIN_CODE).toMatch(/<SiteFooter \/>/)
  })

  it('does NOT render it inside Root(), whose every branch is route-conditional', () => {
    // The on/off proof (L-001) for "renders on every route": a <SiteFooter />
    // moved inside Root() would render on some routes and not others, and this
    // assertion is what fails. Deleting the mount fails the assertion above.
    expect(rootFunctionBody(MAIN_CODE)).not.toMatch(/SiteFooter/)
  })

  it('renders after the page content, so the footer follows <main> in DOM order', () => {
    const rootIdx = MAIN_CODE.indexOf('<Root />')
    const footerIdx = MAIN_CODE.indexOf('<SiteFooter />')
    expect(rootIdx).toBeGreaterThan(-1)
    expect(footerIdx).toBeGreaterThan(rootIdx)
  })
})

describe('router route vocabulary (scan sanity / negative control)', () => {
  it('the scan actually found the router routes', () => {
    // Guards against a scrape that silently matches nothing, which would let
    // every destination "resolve" against an empty vocabulary.
    expect(VOCAB.exact.size).toBeGreaterThan(15)
    expect(VOCAB.exact.has('#/status')).toBe(true)
    expect(VOCAB.exact.has('#/contact')).toBe(true)
  })

  it('the resolver discriminates a real route from a made-up one', () => {
    expect(resolves('#/status')).toBe(true)
    expect(resolves('#/definitely-not-a-real-route')).toBe(false)
  })

  it('flags a planted broken footer destination (proves the check is not vacuous)', () => {
    const planted = ['#/status', '#/bogus-typo-route']
    expect(planted.filter((h) => !resolves(h))).toEqual(['#/bogus-typo-route'])
  })
})

describe('every footer destination is real', () => {
  it('each internal href resolves to a route main.tsx handles', () => {
    const broken = FOOTER_LINKS.map((l) => l.href)
      .filter((h) => !isExternalFooterHref(h))
      .filter((h) => !resolves(h))
    expect(broken, `footer links point at routes main.tsx does not handle: ${broken.join(', ')}`).toEqual([])
  })

  it('each external href is an absolute https URL', () => {
    const external = FOOTER_LINKS.map((l) => l.href).filter(isExternalFooterHref)
    expect(external.length).toBeGreaterThan(0)
    for (const href of external) expect(href).toMatch(/^https:\/\//)
  })

  it('classifies internal and external destinations from the href alone', () => {
    expect(isExternalFooterHref('#/status')).toBe(false)
    expect(isExternalFooterHref('https://github.com/rodmen07')).toBe(true)
  })
})

describe('D-3: Status lives in the footer, and the nav decision is untouched', () => {
  it('the marketing nav still carries no Status item', () => {
    // Mirrors navItems.test.ts's own guard by reading the real list: this pairing
    // is only answered if BOTH halves hold.
    expect(NAV_ITEMS.map((i) => i.href)).not.toContain('#/status')
  })

  it('the footer carries the status board', () => {
    expect(FOOTER_LINKS.map((l) => l.href)).toContain('#/status')
  })

  it('the footer also carries the open-source proof and a contact route', () => {
    const hrefs = FOOTER_LINKS.map((l) => l.href)
    expect(hrefs).toContain('#/contact')
    expect(hrefs.some((h) => h.includes('github.com'))).toBe(true)
    expect(hrefs.some((h) => h.includes('crates.io'))).toBe(true)
  })
})

describe('rendered landmark and link behaviour', () => {
  it('renders exactly one <footer> landmark with an accessible name', () => {
    const footers = container.querySelectorAll('footer')
    expect(footers).toHaveLength(1)
    expect(footers[0].getAttribute('aria-label')).toBeTruthy()
  })

  it('renders one anchor per configured link, with matching text and href', () => {
    expect(anchors()).toHaveLength(FOOTER_LINKS.length)
    for (const link of FOOTER_LINKS) {
      const anchor = anchors().find((a) => a.getAttribute('href') === link.href)
      expect(anchor, `no footer anchor for ${link.href}`).toBeTruthy()
      expect(anchor!.textContent).toContain(link.label)
    }
  })

  it('opens external links in a new tab with a safe rel, and says so for screen readers', () => {
    for (const link of FOOTER_LINKS.filter((l) => isExternalFooterHref(l.href))) {
      const anchor = anchors().find((a) => a.getAttribute('href') === link.href)!
      expect(anchor.getAttribute('target')).toBe('_blank')
      expect(anchor.getAttribute('rel')).toContain('noreferrer')
      expect(anchor.getAttribute('rel')).toContain('noopener')
      expect(anchor.querySelector('.sr-only')?.textContent).toMatch(/new tab/i)
    }
  })

  it('keeps internal links in the same tab', () => {
    for (const link of FOOTER_LINKS.filter((l) => !isExternalFooterHref(l.href))) {
      const anchor = anchors().find((a) => a.getAttribute('href') === link.href)!
      expect(anchor.getAttribute('target')).toBeNull()
      expect(anchor.getAttribute('rel')).toBeNull()
    }
  })

  it('gives every link a visible keyboard focus state', () => {
    for (const anchor of anchors()) {
      expect(anchor.className, `${anchor.getAttribute('href')} has no focus-visible ring`).toMatch(
        /focus-visible:outline\b/,
      )
      expect(anchor.className).toMatch(/focus-visible:outline-\[var\(--focus-ring\)\]/)
    }
  })
})

describe('the footer does not satisfy the boot watchdog', () => {
  it('the watchdog selector still includes the elements this coupling is about', () => {
    const selector = watchdogSelector(MAIN_SRC)
    expect(selector).toContain('nav')
    expect(selector).toContain('main')
  })

  it('renders none of the elements the watchdog reads as "the app rendered"', () => {
    // The footer renders unconditionally and before any route content resolves,
    // so a <nav> (or <section>, or [data-app-ready]) inside it would make the
    // watchdog's failure screen unreachable forever. Reads BOTH sides: the live
    // selector out of main.tsx, and the real rendered footer.
    const selector = watchdogSelector(MAIN_SRC)
    expect(container.querySelector(selector)).toBeNull()
  })

  it('still exposes its links as a list', () => {
    expect(container.querySelectorAll('ul')).toHaveLength(1)
    expect(container.querySelectorAll('li')).toHaveLength(FOOTER_LINKS.length)
  })
})

describe('tokens only: the footer cannot render invisible in either theme', () => {
  it('uses no raw palette colour class', () => {
    // The v1.18.4 ghost-class defect class: a dark-authored palette utility with
    // no [data-theme="light"] override composites to ~1.1:1 on the light surface.
    const raw = FOOTER_CODE.match(
      /\b(?:text|bg|border)-(?:zinc|slate|gray|neutral|stone|amber|orange|emerald|red|blue|indigo|violet)-\d{2,3}\b/g,
    )
    expect(raw ?? []).toEqual([])
  })

  it('uses no opacity-suffixed colour class', () => {
    const opacity = FOOTER_CODE.match(/\b(?:text|bg|border)-[a-z-]+-\d{2,3}\/\d{1,3}\b/g)
    expect(opacity ?? []).toEqual([])
  })

  it('states no sub-12px arbitrary type size', () => {
    expect(FOOTER_CODE).not.toMatch(/text-\[(?:10|11)px\]/)
  })

  it('reports link clicks through the shared analytics helper', () => {
    expect(FOOTER_CODE).toMatch(/trackPortfolioEvent\('footer_link_click'/)
  })

  it('actually emits the analytics event when a link is clicked', () => {
    // Exercises the handler rather than only reading it: a tracked CTA that
    // never fires is the "shipped surface that silently does nothing" class.
    const seen: { eventName: string; params: Record<string, unknown> }[] = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener('portfolio:analytics', listener)

    const statusLink = anchors().find((a) => a.getAttribute('href') === '#/status')!
    act(() => {
      statusLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    window.removeEventListener('portfolio:analytics', listener)
    expect(seen).toHaveLength(1)
    expect(seen[0].eventName).toBe('footer_link_click')
    expect(seen[0].params).toMatchObject({ location: 'site-footer', label: 'Platform status' })
  })
})
