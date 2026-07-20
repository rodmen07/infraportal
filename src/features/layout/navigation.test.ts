/**
 * One navigation, one brand, keyboard a11y (v1.18.2 PR1).
 *
 * Locks in D2 (one brand name), D3 (TopNav on every route, SideNav retired),
 * and the finding-F11 keyboard gaps (skip link, aria-current, overlay Escape
 * and focus return). These are source-scan assertions, the established
 * pattern in this repo (see tokens.test.ts, themeDefault.test.ts): there is
 * no React render harness here (vitest runs in the node environment), and per
 * D11 an axe + jsdom smoke test would need a render harness this milestone
 * does not otherwise use, so targeted assertions are used instead.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
  ADMIN_NAV_ITEMS,
} from './navItems'

const ROOT = process.cwd()

/** Source with block comments and whole-line `//` comments removed, so a
 * component's documentation header (which legitimately names SideNav,
 * lg:pl-64, main-content, etc. to explain what changed) is never mistaken for
 * live code by the scans below. Mirrors tokens.test.ts's stripComments. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const read = (rel: string) => stripComments(readFileSync(path.join(ROOT, rel), 'utf-8'))

const TOPNAV = read('src/features/layout/TopNav.tsx')
const PAGE_LAYOUT = read('src/pages/PageLayout.tsx')
const APP = read('src/App.tsx')
const SLIDE_OVER = read('src/features/site/SlideOver.tsx')
const FOCUS_TRAP = read('src/features/layout/useFocusTrap.ts')
const SKIP_LINK = read('src/features/layout/SkipLink.tsx')
const INDEX_HTML = read('index.html')

describe('D3: SideNav is retired in favour of a single navigation system', () => {
  it('the SideNav component file no longer exists', () => {
    expect(existsSync(path.join(ROOT, 'src/features/layout/SideNav.tsx'))).toBe(false)
  })

  it('PageLayout no longer imports or renders SideNav', () => {
    expect(PAGE_LAYOUT).not.toMatch(/SideNav/)
  })

  it('PageLayout no longer reserves the lg:pl-64 gutter for the closed drawer', () => {
    expect(PAGE_LAYOUT).not.toMatch(/pl-64/)
  })

  it('PageLayout renders TopNav at every width (no lg:hidden nav wrapper)', () => {
    expect(PAGE_LAYOUT).toMatch(/<TopNav\s*\/>/)
    expect(PAGE_LAYOUT).not.toMatch(/lg:hidden/)
  })
})

describe('D3: every route SideNav served is still reachable from TopNav', () => {
  // SideNav rendered three sections: PRIMARY, WORKSPACE, and ADMIN. TopNav
  // renders PRIMARY (always) and ADMIN (in the authed admin row). WORKSPACE
  // is empty. So each route SideNav served must live in PRIMARY or ADMIN.
  const topNavReachable = new Set([
    ...PRIMARY_NAV_ITEMS.map((i) => i.href),
    ...ADMIN_NAV_ITEMS.map((i) => i.href),
  ])

  it('WORKSPACE_NAV_ITEMS is empty, so nothing is lost from that section', () => {
    expect(WORKSPACE_NAV_ITEMS.length).toBe(0)
  })

  it.each(NAV_ITEMS)('route "$label" ($href) is reachable from TopNav', (item) => {
    expect(topNavReachable.has(item.href)).toBe(true)
  })

  it('TopNav renders both the primary items and the authed admin row', () => {
    expect(TOPNAV).toMatch(/PRIMARY_NAV_ITEMS/)
    expect(TOPNAV).toMatch(/ADMIN_NAV_ITEMS/)
  })
})

describe('D2: one brand name in the chrome', () => {
  it('TopNav shows "RM Cloud Consulting" in the brand slot', () => {
    expect(TOPNAV).toMatch(/text-accent">RM Cloud Consulting</)
  })

  it('the old "Managed Hosting" brand slot is gone (it is only a descriptor now)', () => {
    // The brand slot is the accent-coloured heading; the phrase must not sit
    // there. It may still appear lowercased in the descriptor line.
    expect(TOPNAV).not.toMatch(/text-accent">Managed Hosting</)
  })

  it('the "RMCC" compact mark no longer appears in the chrome', () => {
    expect(TOPNAV).not.toMatch(/RMCC/)
    expect(PAGE_LAYOUT).not.toMatch(/RMCC/)
  })

  it('index.html title agrees with the brand', () => {
    expect(INDEX_HTML).toMatch(/<title>RM Cloud Consulting<\/title>/)
  })
})

describe('F11: active nav item carries aria-current="page"', () => {
  it('TopNav sets aria-current on the active item', () => {
    expect(TOPNAV).toMatch(/aria-current=\{isActive\(item\) \? 'page' : undefined\}/)
  })
})

describe('F11: skip-to-content link targets the main landmark', () => {
  it('SkipLink points at #main-content and is screen-reader-only until focused', () => {
    expect(SKIP_LINK).toMatch(/main-content/)
    expect(SKIP_LINK).toMatch(/Skip to content/)
    expect(SKIP_LINK).toMatch(/sr-only/)
  })

  it('home renders SkipLink before a labelled <main id="main-content">', () => {
    expect(APP).toMatch(/<SkipLink\s*\/>/)
    expect(APP).toMatch(/id="main-content"/)
    expect(APP.indexOf('<SkipLink')).toBeLessThan(APP.indexOf('id="main-content"'))
  })

  it('subpages render SkipLink before a labelled <main id="main-content">', () => {
    expect(PAGE_LAYOUT).toMatch(/<SkipLink\s*\/>/)
    expect(PAGE_LAYOUT).toMatch(/id="main-content"/)
    expect(PAGE_LAYOUT.indexOf('<SkipLink')).toBeLessThan(PAGE_LAYOUT.indexOf('id="main-content"'))
  })

  it('the skip target sits after the nav so focus lands past it', () => {
    // In both shells TopNav is rendered before the main landmark in DOM
    // order, which is what lets the skip link move focus past the navigation.
    expect(APP.indexOf('<TopNav')).toBeLessThan(APP.indexOf('id="main-content"'))
    expect(PAGE_LAYOUT.indexOf('<TopNav')).toBeLessThan(PAGE_LAYOUT.indexOf('id="main-content"'))
  })
})

describe('F11: overlays trap focus, close on Escape, and return focus', () => {
  it('useFocusTrap closes on Escape', () => {
    expect(FOCUS_TRAP).toMatch(/Escape/)
    expect(FOCUS_TRAP).toMatch(/onCloseRef\.current\(\)/)
  })

  it('useFocusTrap traps Tab and Shift+Tab inside the overlay', () => {
    expect(FOCUS_TRAP).toMatch(/event\.key !== 'Tab'/)
    expect(FOCUS_TRAP).toMatch(/event\.shiftKey/)
  })

  it('useFocusTrap returns focus to the trigger on close', () => {
    expect(FOCUS_TRAP).toMatch(/previouslyFocused\?\.focus\?\.\(\)/)
  })

  it('SlideOver uses the focus trap and is a labelled dialog', () => {
    expect(SLIDE_OVER).toMatch(/useFocusTrap/)
    expect(SLIDE_OVER).toMatch(/role="dialog"/)
    expect(SLIDE_OVER).toMatch(/aria-modal="true"/)
    expect(SLIDE_OVER).toMatch(/aria-label=/)
  })
})
