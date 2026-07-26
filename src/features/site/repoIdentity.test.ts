/**
 * Repository identity guard (v1.20.2, 2026-07-25).
 *
 * `README.md` is the first thing a recruiter reads on GitHub, and until this
 * pass it opened `# Task Portal Service` and described a Kanban board, an AI
 * goal planner and story-point gamification. None of that has existed in this
 * codebase since the CRM portal era and the 2026-06-26 consulting pivot, and
 * the `package.json` package name carried the same retired identity (the v1.18
 * UX audit already listed it as one of the four competing brand names, and
 * v1.18.2 unified the other three while this one survived).
 *
 * A one-time rewrite would rot again the moment the product moves, which is
 * exactly how the old text survived two pivots, so this is a DRIFT GUARD that
 * reads BOTH sides of every claim it checks (L-003):
 *
 *   1. identity      README heading + package name vs the brand in index.html
 *   2. roadmap link  README vs the ROADMAP.md file that must exist
 *   3. routes        every `#/...` route the README names vs the router
 *                    vocabulary parsed out of `src/main.tsx`
 *   4. stack majors  the "Tech stack" table vs the real ranges in package.json
 *
 * (3) reuses the parsing approach `src/features/layout/routeIntegrity.test.ts`
 * established for navigation destinations: the router is a node-env-hostile
 * React tree, so its vocabulary is read as text rather than by rendering it.
 * (4) means a toolchain upgrade (the deferred Vite major, for instance) cannot
 * land while the README still advertises the old one.
 *
 * The retired name is not banned outright: ROADMAP.md's D-2 default keeps one
 * short dated history note for it. What is banned is presenting it as the
 * CURRENT identity, so the rule is positional — every mention must sit below
 * the `## History` heading.
 *
 * Source-scan assertions, matching this repo's established pattern
 * (`tokens.test.ts`, `socialMeta.test.ts`, `routeIntegrity.test.ts`,
 * `runtimeStatusCopy.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

const README = read('README.md')
const ROADMAP_FILE = 'ROADMAP.md'
const ROUTER_SOURCE = 'src/main.tsx'

/** The identity retired across the CRM-portal and monetization pivots. */
const RETIRED_IDENTITY = /task[- ]portal/i

/** The heading the history note lives under. */
const HISTORY_HEADING = '## History'

/** The brand the shipped app presents, read from the page title, not memory. */
const BRAND = /<title>([^<]+)<\/title>/.exec(read('index.html'))?.[1]?.trim() ?? ''

const README_LINES = README.split(/\r?\n/)
const HISTORY_INDEX = README_LINES.findIndex((line) => line.trim() === HISTORY_HEADING)

/** Lines that mention the retired identity, with their 1-based line numbers. */
function retiredIdentityLines(lines: readonly string[]): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = []
  lines.forEach((text, i) => {
    if (RETIRED_IDENTITY.test(text)) found.push({ line: i + 1, text: text.trim() })
  })
  return found
}

interface RouteVocabulary {
  /** Routes matched by an exact `hash === '#/...'` comparison. */
  exact: Set<string>
  /** Route prefixes matched by `hash.startsWith('#/...')`. */
  prefixes: string[]
}

/** Read the router's route vocabulary out of its source, not by rendering it. */
function parseRouteVocabulary(source: string): RouteVocabulary {
  const exact = new Set<string>()
  for (const m of source.matchAll(/hash === '(#\/[^']*)'/g)) exact.add(m[1])
  const prefixes: string[] = []
  for (const m of source.matchAll(/hash\.startsWith\('(#\/[^']*)'\)/g)) prefixes.push(m[1])
  return { exact, prefixes }
}

const VOCAB = parseRouteVocabulary(read(ROUTER_SOURCE))

function resolves(href: string): boolean {
  if (href === '#/') return true
  if (VOCAB.exact.has(href)) return true
  return VOCAB.prefixes.some((p) => href.startsWith(p))
}

/**
 * Hash routes the README names. Only inline-code spans count (`` `#/status` ``):
 * prose that happens to contain a `#` is not a destination, and the OpenAPI
 * JSON-Pointer form (`#/components/...`) is not one either, which is the
 * false-positive class the 2026-07-25 manual href sweep measured at ~24% when
 * scanning raw literals instead of real destination sites.
 */
function documentedRoutes(markdown: string): string[] {
  const found = new Set<string>()
  for (const m of markdown.matchAll(/`(#\/[A-Za-z0-9/_-]*)(\?[^`]*)?`/g)) found.add(m[1])
  return [...found].sort()
}

const DOCUMENTED_ROUTES = documentedRoutes(README)

/**
 * Stack entries the README advertises, each paired with the package.json
 * dependency that decides whether the claim is still true.
 */
const STACK_CLAIMS: readonly { readonly label: string; readonly pkg: string }[] = [
  { label: 'React', pkg: 'react' },
  { label: 'Vite', pkg: 'vite' },
  { label: 'TypeScript', pkg: 'typescript' },
  { label: 'Tailwind CSS', pkg: 'tailwindcss' },
  { label: 'Vitest', pkg: 'vitest' },
  { label: 'ESLint', pkg: 'eslint' },
]

interface PackageManifest {
  name: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const PACKAGE: PackageManifest = JSON.parse(read('package.json'))

/** The major version of a declared dependency range, e.g. `^19.2.8` -> `19`. */
function declaredMajor(pkg: string): string {
  const range = PACKAGE.dependencies?.[pkg] ?? PACKAGE.devDependencies?.[pkg]
  if (!range) throw new Error(`package.json declares no dependency named "${pkg}"`)
  const major = /(\d+)\./.exec(range)?.[1]
  if (!major) throw new Error(`could not read a major version from "${pkg}": "${range}"`)
  return major
}

describe('repo identity guard (sanity / negative control)', () => {
  it('read the README, the router vocabulary and the manifest', () => {
    expect(README.length).toBeGreaterThan(1000)
    expect(VOCAB.exact.size).toBeGreaterThan(15)
    expect(Object.keys(PACKAGE.devDependencies ?? {}).length).toBeGreaterThan(5)
  })

  it('the retired-identity matcher fires on the text that actually shipped', () => {
    // L-001 on/off proof: the same matcher that passes the current README
    // returns the offender for the heading this repo carried until 2026-07-25.
    expect(retiredIdentityLines(['# Task Portal Service'])).toHaveLength(1)
    expect(retiredIdentityLines(['# infraportal — RM Cloud Consulting'])).toHaveLength(0)
  })

  it('the route scan reads inline-code destinations and ignores JSON pointers', () => {
    expect(documentedRoutes('see `#/status` for health')).toEqual(['#/status'])
    expect(documentedRoutes('the schema at `#/components/schemas/Lead`')).toEqual([
      '#/components/schemas/Lead',
    ])
    // ...and that JSON-pointer example is exactly why the resolver, not the
    // scanner, is what decides: it correctly does not resolve.
    expect(resolves('#/components/schemas/Lead')).toBe(false)
  })
})

describe('README presents the current product identity', () => {
  it('has a History section for the retired identity to live under', () => {
    expect(HISTORY_INDEX).toBeGreaterThan(-1)
  })

  it('does not present the retired identity as current (mentions are history only)', () => {
    const above = retiredIdentityLines(README_LINES.slice(0, HISTORY_INDEX))
    expect(
      above,
      `README.md mentions the retired "Task Portal" identity above "${HISTORY_HEADING}", ` +
        `which presents it as current: ${above.map((l) => `line ${l.line}: ${l.text}`).join(' | ')}`,
    ).toEqual([])
  })

  it('opens by naming the current identity, not the retired one', () => {
    const heading = README_LINES.find((line) => line.startsWith('# '))
    expect(heading).toBeDefined()
    expect(RETIRED_IDENTITY.test(heading!)).toBe(false)
    expect(heading!).toContain('infraportal')
  })

  it('names the brand the app itself renders', () => {
    expect(BRAND.length).toBeGreaterThan(3)
    expect(README, `README.md must name the brand in index.html <title> ("${BRAND}")`).toContain(
      BRAND,
    )
  })

  it('links the roadmap, and the roadmap exists', () => {
    expect(README).toContain(`](${ROADMAP_FILE})`)
    expect(read(ROADMAP_FILE).length).toBeGreaterThan(100)
  })
})

describe('package identity matches the repo', () => {
  it('the package name is not the retired identity', () => {
    expect(RETIRED_IDENTITY.test(PACKAGE.name)).toBe(false)
  })

  it('the package name matches the deployed base path in vite.config.js', () => {
    const base = /base:\s*mode === 'production' \? '\/([^/']+)\/'/.exec(read('vite.config.js'))?.[1]
    expect(base, 'could not read the production base path out of vite.config.js').toBeDefined()
    expect(PACKAGE.name).toBe(base)
  })
})

describe('README names only routes the router handles', () => {
  it('found routes to check (a scan over zero routes would pass vacuously)', () => {
    expect(DOCUMENTED_ROUTES.length).toBeGreaterThan(8)
  })

  it.each(DOCUMENTED_ROUTES)('%s resolves against the router vocabulary', (href) => {
    expect(
      resolves(href),
      `README.md documents "${href}", which ${ROUTER_SOURCE} does not handle`,
    ).toBe(true)
  })
})

describe('README tech stack agrees with package.json', () => {
  it.each(STACK_CLAIMS)('names the installed major of $pkg', ({ label, pkg }) => {
    const major = declaredMajor(pkg)
    const claim = new RegExp(`${label}\\s+${major}(\\D|$)`)
    expect(
      claim.test(README),
      `README.md must say "${label} ${major}" to match package.json's "${pkg}" range`,
    ).toBe(true)
  })
})
