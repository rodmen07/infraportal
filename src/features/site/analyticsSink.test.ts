/**
 * Analytics sink contract guard (v1.22.3, the analytics truth pass).
 *
 * WHAT WENT WRONG, AND WHY A GUARD RATHER THAN ONE DELETION.
 *
 * From 2026-06-26 to 2026-07-26 `src/utils/analytics.ts` forwarded every
 * funnel event to vendor globals (a tag-manager array push and an event
 * function call) that were optional-chained against `window` properties
 * nothing on this site ever installed: `index.html` -- the repo's only entry
 * HTML -- loaded no analytics script of any kind. All 28 production call
 * sites across the registered event vocabulary therefore dispatched into a
 * void while the source read as instrumented. v1.22.3 deleted the dead
 * branches; this guard makes the CLASS unrepresentable rather than the
 * instance: a sink's forwarding code and its loader script must arrive (and
 * leave) together.
 *
 * Every assertion reads BOTH sources it compares (L-003):
 *
 *   A  no half-wired sink   for each known sink family, the dispatcher
 *                           references it if and only if index.html loads it
 *   B  the test seam stays  the dispatcher keeps emitting the in-page
 *                           `portfolio:analytics` CustomEvent (D-10: the
 *                           unconfigured path is a visible no-op, not a
 *                           silent one)
 *   C  scanner controls     the comment-stripper neither counts a comment
 *                           mention as a reference nor loses a reference
 *                           carried by a string literal
 *   D  README guard map     every drift-guard path README.md names exists on
 *                           disk, and the map names this guard and the
 *                           conversion-coverage guard it complements
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DISPATCHER_PATH = 'src/utils/analytics.ts'
const ENTRY_HTML_PATH = 'index.html'
const README_PATH = 'README.md'

const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

/**
 * Strip JS comments so a historical note may NAME a sink without counting as
 * forwarding code. Line comments are removed only when `//` follows start of
 * line or whitespace, so `https://...` string literals keep their host names.
 */
function stripJsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

/** Strip HTML comments so index.html may carry a note without loading a sink. */
function stripHtmlComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, '')
}

/**
 * The sink families this guard knows how to pair. One regex per family, run
 * against both comment-stripped sources: referencing a family in the
 * dispatcher without loading it in index.html is the dispatch-into-a-void
 * defect; loading it without forwarding to it drops every funnel event while
 * the page-view counter looks alive.
 */
const SINK_FAMILIES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'GA4 / Google Tag Manager', pattern: /\bdataLayer\b|\bgtag\b|googletagmanager/i },
  { name: 'GoatCounter', pattern: /goatcounter|gc\.zgo\.at/i },
  { name: 'Plausible', pattern: /plausible/i },
  { name: 'Umami', pattern: /\bumami\b/i },
  { name: 'Fathom', pattern: /\bfathom\b/i },
]

describe('contract A: no half-wired analytics sink', () => {
  const dispatcher = stripJsComments(read(DISPATCHER_PATH))
  const entryHtml = stripHtmlComments(read(ENTRY_HTML_PATH))

  it.each(SINK_FAMILIES.map((f) => [f.name, f] as const))(
    '%s: the dispatcher references it if and only if index.html loads it',
    (_name, family) => {
      const inDispatcher = family.pattern.test(dispatcher)
      const inHtml = family.pattern.test(entryHtml)
      expect(
        inDispatcher,
        inDispatcher && !inHtml
          ? `${DISPATCHER_PATH} forwards events to ${family.name}, but ${ENTRY_HTML_PATH} loads no ` +
            `${family.name} script: every event would dispatch into a void, the exact v1.22 defect. ` +
            `Ship the loader script in the same PR, or do not forward.`
          : !inDispatcher && inHtml
            ? `${ENTRY_HTML_PATH} loads a ${family.name} script, but ${DISPATCHER_PATH} never forwards ` +
              `events to it: page views would be counted while every funnel event is silently dropped. ` +
              `Add the forwarding branch in the same PR, or do not load the script.`
            : 'both sides agree',
      ).toBe(inHtml)
    },
  )
})

describe('contract B: the in-page CustomEvent seam stays (D-10)', () => {
  it('the dispatcher emits portfolio:analytics whether or not a sink is wired', () => {
    const dispatcher = stripJsComments(read(DISPATCHER_PATH))
    expect(
      dispatcher.includes("new CustomEvent('portfolio:analytics'"),
      `${DISPATCHER_PATH} no longer dispatches the portfolio:analytics CustomEvent. That event is the ` +
        `one observable output on the unconfigured path and the seam every analytics test listens on; ` +
        `removing it makes the no-op silent, the failure shape envContract.test.ts contract E polices.`,
    ).toBe(true)
  })
})

describe('contract C: the scanner itself is proven, not assumed', () => {
  it('a comment naming a sink does not count as a reference', () => {
    const fixture = "const x = 1 // historical note: this used to call gtag\n/* and pushed to dataLayer */"
    const stripped = stripJsComments(fixture)
    expect(/\bgtag\b|\bdataLayer\b/.test(stripped)).toBe(false)
  })

  it('a live call and a script URL in a string literal both still count', () => {
    const call = "analyticsWindow.gtag?.('event', eventName, params)"
    expect(/\bgtag\b/.test(stripJsComments(call))).toBe(true)

    const urlLiteral = "const src = 'https://goatcounter.example/count.js' // loader"
    expect(/goatcounter/.test(stripJsComments(urlLiteral))).toBe(true)
  })

  it('an HTML comment naming a sink does not count as loading it', () => {
    const fixture = '<!-- TODO: add the plausible script here --><script src="/app.js"></script>'
    expect(/plausible/.test(stripHtmlComments(fixture))).toBe(false)
  })
})

describe('contract D: the README drift-guard map matches the tree', () => {
  const readme = read(README_PATH)
  const namedGuards = Array.from(new Set(readme.match(/src\/[A-Za-z0-9_/.-]+\.test\.tsx?/g) ?? []))

  it('names enough guards that a gutted map cannot pass vacuously', () => {
    expect(namedGuards.length).toBeGreaterThanOrEqual(5)
  })

  it('every guard path the README names exists on disk', () => {
    const missing = namedGuards.filter((rel) => !existsSync(path.join(ROOT, rel)))
    expect(
      missing,
      `README.md names drift guards that do not exist: ${missing.join(', ')}. ` +
        `Either the guard moved (update the README in the same PR) or the map is asserting fiction.`,
    ).toEqual([])
  })

  it('the map names the conversion-coverage guard and this sink guard', () => {
    expect(namedGuards).toContain('src/features/site/conversionInstrumentation.test.ts')
    expect(namedGuards).toContain('src/features/site/analyticsSink.test.ts')
  })
})
