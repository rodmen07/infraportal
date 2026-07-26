/**
 * App-copy runtime-status guard (SPEC-COPY-2, 2026-07-25).
 *
 * The sibling of `src/features/apiDocs/specRuntimeStatus.test.ts`, which bans
 * the same class of claim from the committed OpenAPI snapshots. That guard
 * shipped one day earlier and cleaned the specs, but the sweep that closed it
 * found the identical falsehood still living in this app's OWN copy, and one
 * instance was locked in place by a test expectation:
 *
 *   - the snippets banner ("offline since the 2026-06-04 decommission to zero
 *     infrastructure"), which `specCatalog.test.ts` asserted verbatim;
 *   - the comment emitted INTO every generated SDK snippet, so a visitor who
 *     copied a snippet carried the claim away with them;
 *   - the "Try it" panel note, the API-docs page intro, and the boundary notes
 *     re-exported by all five `*.mock.ts` demo modules.
 *
 * Cloud SQL was rebuilt on 2026-07-21 and every service answers `/health` with
 * HTTP 200, so all of it was false, and it was rendered on the public API
 * playground, one click from a status board saying the opposite.
 *
 * WHY THE WHOLE CLASS IS BANNED, not the one sentence that rotted. Every one
 * of these strings was doing two jobs at once: explaining that a surface makes
 * no network request (STRUCTURAL and permanently true: the site is a static
 * bundle with no service URL configured) and asserting what is deployed
 * (a RUNTIME status, which this bundle cannot know and which rots the moment
 * infrastructure changes). The honest split is to keep the first and hand the
 * second to `#/status`, which measures it. Any future "offline since <date>"
 * or "decommissioned" note would rot in exactly the same way, so the pattern
 * is banned rather than the string.
 *
 * Source-scan assertions, matching this repo's established pattern
 * (`tokens.test.ts`, `typeScaleFloor.test.ts`, `routeIntegrity.test.ts`,
 * `specRuntimeStatus.test.ts`).
 *
 * v1.20.1 (PROOF-COST-1) added the second half below: a runtime STATUS is not
 * the only fact this bundle cannot know. The home page also asserted a runtime
 * COST ("$0 / Recurring infra cost today"), which was true when it was typed
 * and false from 2026-07-21, when the Cloud Run half came back at roughly $9 a
 * month. Its two files left the allowlist in the same commit that fixed them.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ROUTER_SOURCE = 'src/main.tsx'

/** In-app deep link the copy uses to hand runtime status to the board. */
const STATUS_BOARD_HASH = '#/status'

/**
 * Phrases that assert a platform-wide runtime status. Same vocabulary as
 * `specRuntimeStatus.test.ts`, so the two guards cannot drift apart on what
 * counts as a claim.
 */
const RUNTIME_STATUS_CLAIMS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'offline-since', pattern: /offline since/i },
  { label: 'have-been-offline', pattern: /(have|has) been offline/i },
  { label: 'decommissioned', pattern: /decommission/i },
  { label: 'historical-deployment', pattern: /historical (cloud run|deployment)/i },
  { label: 'endpoints-are-offline', pattern: /endpoints? (is|are) offline/i },
  { label: 'nothing-is-running', pattern: /nothing is running/i },
]

/**
 * The ONLY files allowed to carry the vocabulary, each for a stated reason.
 *
 * Every entry is asserted below to (a) still exist and (b) still contain a
 * claim, so an exemption cannot outlive the thing it exempts: clean the file
 * up and the guard tells you to delete its allowlist entry, which stops this
 * list from quietly becoming the place new falsehoods hide.
 */
const ALLOWED: readonly { readonly file: string; readonly why: string }[] = [
  {
    file: 'src/pages/patchNotesData.ts',
    why: 'Dated historical changelog. The 2026-06-04 teardown genuinely happened; these entries are records of it, not statements about what is serving today.',
  },
  {
    file: 'src/features/apiDocs/specRuntimeStatus.test.ts',
    why: 'The sibling guard. It quotes the retired sentence as its own negative control.',
  },
  {
    file: 'src/features/site/runtimeStatusCopy.test.ts',
    why: 'This guard. It quotes the retired wording in its docstring and its negative control.',
  },
]

const ALLOWED_FILES = new Set(ALLOWED.map((entry) => entry.file))

/** Every .ts/.tsx file under src/, relative to the repo root, sorted. */
function allSourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allSourceFiles(relPath))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) found.push(relPath)
  }
  return found.sort()
}

/** Which banned claims a document makes, by label. Empty means clean. */
function runtimeStatusClaimsIn(text: string): string[] {
  return RUNTIME_STATUS_CLAIMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)
}

/**
 * A zero-infrastructure-cost claim in any of the forms this site has used.
 * `$0` on its own counts: the tile that shipped the falsehood was exactly
 * `{ value: '$0', label: 'Recurring infra cost today' }`, two strings on one
 * line with no other context.
 */
const ZERO_COST_TOKEN = /\$0\b|zero (?:infrastructure |infra |recurring )?cost/i

/** Words that pin a cost claim to the present, which this bundle cannot know. */
const PRESENT_MARKER = /\b(today|now|currently|at present|these days)\b/i

/**
 * Words that anchor a cost claim to something that already happened. A past
 * event is a fact about the past and stays true; that is the whole difference
 * between "I ran it down to $0 once its job was done" (durable) and "$0
 * recurring infra cost today" (rots, and did).
 */
const PAST_ANCHOR =
  /\b(was|were|had|used to|once|then|after|until|tore|torn|shut|deleted|destroyed|eliminated|retired|ran|took|teardown|shipped)\b/i

/**
 * Split into rough sentences after collapsing whitespace, so a claim written
 * across several JSX lines is still read as one statement.
 */
function sentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').split(/[.!?]+/)
}

/**
 * Cost claims that are not anchored to the past, by label. Empty means clean.
 * Two independent failures, because they catch different regressions: a claim
 * that names the present is wrong even when it is well written, and a claim
 * with no anchor at all reads as a standing fact whatever tense it uses.
 */
function unanchoredCostClaimsIn(text: string): string[] {
  const found: string[] = []
  for (const sentence of sentences(text)) {
    if (!ZERO_COST_TOKEN.test(sentence)) continue
    if (PRESENT_MARKER.test(sentence)) found.push(`present-tense: "${sentence.trim()}"`)
    else if (!PAST_ANCHOR.test(sentence)) found.push(`unanchored: "${sentence.trim()}"`)
  }
  return found
}

const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), 'utf-8')

const SOURCE_FILES = allSourceFiles()
const SCANNED_FILES = SOURCE_FILES.filter((f) => !ALLOWED_FILES.has(f))

/** Read the router's exact-match route vocabulary out of its source. */
function exactRoutesIn(source: string): Set<string> {
  const exact = new Set<string>()
  for (const m of source.matchAll(/hash === '(#\/[^']*)'/g)) exact.add(m[1])
  return exact
}

const ROUTER_ROUTES = exactRoutesIn(read(ROUTER_SOURCE))

describe('app-copy runtime-status scan (sanity / negative control)', () => {
  it('the walk found the source tree (a scan over zero files would pass vacuously)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(150)
    expect(SOURCE_FILES).toContain('src/features/apiDocs/snippets/snippetModel.ts')
    expect(SCANNED_FILES.length).toBeGreaterThan(SOURCE_FILES.length - ALLOWED.length - 1)
  })

  it('the matcher flags the exact copy that shipped (proves it is not inert)', () => {
    // The on/off proof (L-001): the same function that returns [] for the
    // fixed modules returns the offenders for the strings they carried until
    // 2026-07-25, so reverting any of these edits reddens this suite.
    const planted =
      'These snippets document the API contract. The base URL is the historical Cloud Run ' +
      'deployment, offline since the 2026-06-04 decommission to zero infrastructure. ' +
      'Nothing is running in this demo.'
    expect(runtimeStatusClaimsIn(planted).sort()).toEqual(
      ['decommissioned', 'historical-deployment', 'nothing-is-running', 'offline-since'].sort(),
    )
  })

  it('the matcher does not fire on the replacement wording (no false positive)', () => {
    const replacement =
      'These snippets document the API contract; this page never runs them. The base URL is ' +
      'the first server the spec documents. For live per-service health, see the platform ' +
      `status board at ${STATUS_BOARD_HASH}.`
    expect(runtimeStatusClaimsIn(replacement)).toEqual([])
  })

  it('the router vocabulary scan actually found routes', () => {
    expect(ROUTER_ROUTES.size).toBeGreaterThan(15)
  })
})

describe('no app source asserts a platform runtime status', () => {
  it.each(SCANNED_FILES)('%s makes no runtime-status claim', (relPath) => {
    const claims = runtimeStatusClaimsIn(read(relPath))
    expect(
      claims,
      `${relPath} asserts a platform runtime status (${claims.join(', ')}). This bundle is ` +
        'static and cannot know what is serving; say what the surface does (no network ' +
        `request is made) and point runtime-status questions at ${STATUS_BOARD_HASH}. If the ` +
        'claim is a dated historical record, add it to ALLOWED with a reason.',
    ).toEqual([])
  })
})

describe('no app source claims a zero infrastructure cost in the present', () => {
  it.each(SCANNED_FILES)('%s makes no standing zero-cost claim', (relPath) => {
    const claims = unanchoredCostClaimsIn(read(relPath))
    expect(
      claims,
      `${relPath} states a zero-cost claim the bundle cannot check. Cloud SQL was rebuilt on ` +
        '2026-07-21 and the platform now costs roughly $9 a month, so a present-tense "$0" is ' +
        'false. Anchor the claim to when it was true ("tore it down to $0 once its job was ' +
        `done") or show a measured number, as the proof strip does via ${STATUS_BOARD_HASH}.`,
    ).toEqual([])
  })

  it('flags the tile that shipped the falsehood (proves it is not inert)', () => {
    // L-001 on/off proof: the literal line that was live on the home page from
    // 2026-07-21 until v1.20.1, plus an unanchored variant that drops the word
    // the present-tense pattern keys on.
    expect(unanchoredCostClaimsIn("{ value: '$0', label: 'Recurring infra cost today' },")).toEqual([
      `present-tense: "{ value: '$0', label: 'Recurring infra cost today' },"`,
    ])
    expect(unanchoredCostClaimsIn('Recurring infra cost: $0')).toEqual([
      'unanchored: "Recurring infra cost: $0"',
    ])
    expect(unanchoredCostClaimsIn('The platform runs at zero infrastructure cost')).toEqual([
      'unanchored: "The platform runs at zero infrastructure cost"',
    ])
  })

  it('does not flag a claim anchored to when it was true (no false positive)', () => {
    expect(
      unanchoredCostClaimsIn(
        'I shipped a 16-service platform end to end, tore the whole thing down to $0 once its ' +
          'job was done, then brought the Cloud Run half back for about $9 a month.',
      ),
    ).toEqual([])
    expect(
      unanchoredCostClaimsIn('Then it was deliberately torn down to zero infrastructure cost.'),
    ).toEqual([])
  })
})

describe('the allowlist cannot outlive what it exempts', () => {
  it.each(ALLOWED)('$file still exists and still needs its exemption', ({ file, why }) => {
    expect(SOURCE_FILES, `${file} is allowlisted but no longer exists; delete the entry.`).toContain(
      file,
    )
    expect(
      runtimeStatusClaimsIn(read(file)).length,
      `${file} no longer makes a runtime-status claim, so its exemption ("${why}") is stale. ` +
        'Delete the ALLOWED entry so the file is guarded like every other.',
    ).toBeGreaterThan(0)
  })
})

describe('copy that defers runtime status points at a route that exists', () => {
  // The L-003 drift half: the replacement wording hard-codes a deep link, so
  // read BOTH sides. Rename or drop the status route and this fails, instead
  // of leaving the playground pointing visitors at a 404.
  const DEFERRING_SOURCES = [
    'src/features/apiDocs/snippets/snippetModel.ts',
    'src/lib/tryItAdapter.mock.ts',
    'src/pages/ApiDocsPage.tsx',
  ] as const

  it.each(DEFERRING_SOURCES)('%s names the status board', (relPath) => {
    expect(
      read(relPath).includes(STATUS_BOARD_HASH),
      `${relPath} no longer names ${STATUS_BOARD_HASH}, so the copy that stopped asserting a ` +
        'runtime status now leaves the reader with nowhere to check one.',
    ).toBe(true)
  })

  it('the linked hash route is one main.tsx actually handles (reads BOTH sources)', () => {
    expect(
      ROUTER_ROUTES.has(STATUS_BOARD_HASH),
      `app copy links to ${STATUS_BOARD_HASH} but ${ROUTER_SOURCE} has no explicit route for ` +
        'it, so the playground hands visitors a dead link.',
    ).toBe(true)
  })
})
