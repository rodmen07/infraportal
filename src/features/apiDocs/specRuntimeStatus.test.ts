/**
 * API-spec runtime-status guard (2026-07-25).
 *
 * The eleven committed OpenAPI snapshots under `src/api-specs/` are rendered
 * verbatim on the PUBLIC API playground (`#/api-docs`): `info.description` in
 * the spec header and `servers[].description` in the server selector. Between
 * 2026-06-04 and 2026-07-25 every one of them carried the sentence
 *
 *   "All runtime endpoints have been offline since 2026-06-04, when the
 *    platform infrastructure was decommissioned to zero."
 *
 * plus a server labelled "Historical Cloud Run deployment. Offline since
 * 2026-06-04." Cloud SQL was rebuilt on 2026-07-21 and all eleven services
 * have answered `/health` with HTTP 200 since, so for over a month a visitor
 * browsing the platform's own API docs was told the entire platform was dead.
 * Nothing failed, because no test has ever read what these documents CLAIM.
 *
 * Two guards, both cheap, both closing a real hole:
 *
 * 1. FORBIDDEN VOCABULARY. A spec cannot know the platform's runtime status —
 *    it is a contract document, regenerated only when the contract changes,
 *    and it is served from a static bundle. Any sentence asserting that status
 *    is a claim that will rot, so the whole class is banned rather than the one
 *    sentence that happened to rot last time. The fix these snapshots now carry
 *    is to POINT AT the live status board instead of asserting anything.
 *
 * 2. CROSS-ARTIFACT DRIFT (the L-003 shape, same as `routeIntegrity.test.ts`).
 *    The replacement text hard-codes the status-board deep link, so this reads
 *    BOTH sides: every spec must name the board, AND the hash route it names
 *    must be one that `src/main.tsx` explicitly handles. Rename or drop the
 *    `#/status` route and this fails, instead of silently leaving eleven
 *    published specs pointing at a 404.
 *
 * Source-scan assertions, matching this repo's established pattern
 * (`tokens.test.ts`, `typeScaleFloor.test.ts`, `routeIntegrity.test.ts`): the
 * router is a node-env-hostile React tree, so its route vocabulary is read as
 * text rather than by rendering it.
 *
 * NOTE this guard is deliberately independent of `check-spec-drift`. That job
 * proves the snapshots MATCH the microservices sources; it is perfectly happy
 * when both sides are wrong together, which is exactly what happened here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SPEC_DIR = path.join(ROOT, 'src', 'api-specs')
const ROUTER_SOURCE = 'src/main.tsx'

/** The deep link the specs use to hand runtime-status questions to the board. */
const STATUS_BOARD_URL = 'https://rodmen07.github.io/infraportal/#/status'
const STATUS_BOARD_HASH = '#/status'

/**
 * Phrases that assert a platform-wide runtime status. Banned as a CLASS: the
 * specific 2026-06-04 wording is gone, but "offline since <any date>" or a
 * fresh "decommissioned" note would rot in exactly the same way.
 */
const RUNTIME_STATUS_CLAIMS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'offline-since', pattern: /offline since/i },
  { label: 'have-been-offline', pattern: /(have|has) been offline/i },
  { label: 'decommissioned', pattern: /decommission/i },
  { label: 'historical-deployment', pattern: /historical (cloud run|deployment)/i },
  { label: 'endpoints-are-offline', pattern: /endpoints? (is|are) offline/i },
]

/** Every committed snapshot the playground can render, manifest included. */
function specFileNames(): string[] {
  return readdirSync(SPEC_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
}

function readSpecText(fileName: string): string {
  return readFileSync(path.join(SPEC_DIR, fileName), 'utf-8')
}

/** Which banned claims a document makes, by label. Empty means clean. */
function runtimeStatusClaimsIn(text: string): string[] {
  return RUNTIME_STATUS_CLAIMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)
}

/** Read the router's exact-match route vocabulary out of its source. */
function exactRoutesIn(source: string): Set<string> {
  const exact = new Set<string>()
  for (const m of source.matchAll(/hash === '(#\/[^']*)'/g)) exact.add(m[1])
  return exact
}

const SPEC_FILES = specFileNames()
const SERVICE_SPEC_FILES = SPEC_FILES.filter((f) => f.endsWith('-service.json'))
const ROUTER_ROUTES = exactRoutesIn(readFileSync(path.join(ROOT, ROUTER_SOURCE), 'utf-8'))

describe('spec runtime-status scan (sanity / negative control)', () => {
  it('found every committed snapshot (a scan over zero files would pass vacuously)', () => {
    expect(SERVICE_SPEC_FILES).toHaveLength(11)
    expect(SPEC_FILES).toContain('manifest.json')
  })

  it('the matcher flags a planted runtime-status claim (proves it is not inert)', () => {
    // The on/off proof (L-001): the same function that returns [] for the real
    // snapshots returns the offenders for the exact text that shipped for a
    // month, so a revert of the fix reddens this suite rather than passing.
    const planted =
      'All runtime endpoints have been offline since 2026-06-04, when the platform ' +
      'infrastructure was decommissioned to zero. Historical Cloud Run deployment.'
    expect(runtimeStatusClaimsIn(planted).sort()).toEqual(
      ['decommissioned', 'have-been-offline', 'historical-deployment', 'offline-since'].sort(),
    )
  })

  it('the matcher does not fire on the replacement wording (no false positive)', () => {
    const replacement =
      'Runtime status is not asserted in this document: the deployed base URL is listed ' +
      `under servers below, and live per-service health is published on the platform ` +
      `status board at ${STATUS_BOARD_URL}.`
    expect(runtimeStatusClaimsIn(replacement)).toEqual([])
  })

  it('the router vocabulary scan actually found routes', () => {
    expect(ROUTER_ROUTES.size).toBeGreaterThan(15)
  })
})

describe('no committed API spec asserts a platform runtime status', () => {
  it.each(SPEC_FILES)('%s makes no runtime-status claim', (fileName) => {
    const claims = runtimeStatusClaimsIn(readSpecText(fileName))
    expect(
      claims,
      `src/api-specs/${fileName} asserts a runtime status (${claims.join(', ')}). ` +
        'Specs are static contract documents rendered on the public playground; they ' +
        'cannot know what is serving. Point at the status board instead.',
    ).toEqual([])
  })
})

describe('every spec hands runtime status to a status board route that exists', () => {
  it.each(SERVICE_SPEC_FILES)('%s links to the status board', (fileName) => {
    const spec = JSON.parse(readSpecText(fileName)) as { info?: { description?: string } }
    const description = spec.info?.description ?? ''
    expect(
      description.includes(STATUS_BOARD_URL),
      `src/api-specs/${fileName} info.description no longer names ${STATUS_BOARD_URL}, ` +
        'so its readers have nowhere to check what is actually serving.',
    ).toBe(true)
  })

  it('the linked hash route is one main.tsx actually handles (reads BOTH sources)', () => {
    // The drift half: the specs are regenerated from another repo, so nothing
    // here would ever notice this app dropping or renaming the route they name.
    expect(
      ROUTER_ROUTES.has(STATUS_BOARD_HASH),
      `the specs link to ${STATUS_BOARD_URL} but ${ROUTER_SOURCE} has no explicit ` +
        `${STATUS_BOARD_HASH} route, so eleven published specs point at a 404.`,
    ).toBe(true)
  })
})
