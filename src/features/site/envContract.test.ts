/**
 * Build-time environment contract guard (v1.21.1, decision D-4, closes BADGE-DEAD-1).
 *
 * WHAT WENT WRONG, AND WHY A GUARD RATHER THAN THREE DELETIONS.
 *
 * The monitoring variable retired by v1.21.1 (named in ROADMAP.md, deliberately
 * not repeated in `src/` so that a grep for it stays at zero) was wired end to
 * end and shipped for months while being, at every point, dead.
 * `deploy-pages.yml` exported it as `${{ vars.<name> }}`; the repository defines
 * zero Actions variables (`gh api repos/rodmen07/infraportal/actions/variables`
 * -> `total_count: 0`, measured 2026-07-26), so vite inlined the empty string;
 * `src/config.ts` resolved it to `''`; and the three components reading it took
 * a `phase: 'disabled'` branch that `return null`ed. A whole panel therefore
 * vanished from three PUBLIC case-study pages with no error, no console warning
 * and a fully green deploy. Setting the variable could not have fixed it
 * either: the intended backend (observaboard on Fly) was destroyed in the
 * 2026-06-04 teardown and answers 404.
 *
 * The same sweep found a second instance of the identical class, which is why
 * this is a class fix (L-015): `AI_ORCHESTRATOR_URL` read
 * `VITE_AI_ORCHESTRATOR_URL`, was exported from `config.ts`, was exported by
 * the deploy workflow, and had ZERO consumers anywhere in `src/`.
 *
 * Every assertion below is a drift guard, not a one-time reconciliation
 * (L-003): each one reads BOTH sources it compares, so the pairing cannot be
 * half-undone later.
 *
 *   A  documented      every VITE_* read in src/  <->  .env.example
 *   B  deployable      every VITE_* read in src/  ->   deploy-pages.yml build env,
 *                      unless the read carries a non-empty literal fallback
 *   C  no dead config  every VITE_* in deploy-pages.yml  ->  a read in src/
 *   D  reachable       every constant exported by src/config.ts  ->  an importer
 *   E  visible         no env-coupled module may carry a 'disabled' state, the
 *                      exact shape that made this failure invisible
 *
 * (E) here is a cheap literal tripwire, deliberately kept: it is proven to
 * fire on the retired modules and costs one regex. The STRUCTURAL version of
 * the same contract -- which catches the shape under any name ('off',
 * 'hidden', a bare `if (!SOME_URL) return null`) by walking the TypeScript
 * AST -- lives beside this file in envVisibility.test.ts (v1.21.1 follow-up,
 * closing the PR #93 scope cut).
 *
 * (E) is the one that encodes the defect rather than its instances. The repo's
 * healthy pattern is to SAY it is unconfigured -- `PortalLoginGate` renders
 * "Auth service not configured (VITE_AUTH_SERVICE_URL)", `LiveFeedTab` renders
 * "VITE_EVENT_STREAM_URL not configured", `ServiceHealthPage` renders an
 * `unconfigured` row with "URL not configured". Only the monitoring panels
 * chose to disappear. A surface may still degrade; it may not do so silently.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'

const ROOT = process.cwd()
const WORKFLOW_PATH = '.github/workflows/deploy-pages.yml'
const ENV_EXAMPLE_PATH = '.env.example'
const CONFIG_PATH = 'src/config.ts'

const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

/** Every `.ts`/`.tsx` file under `src/`, excluding test files. */
function sourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...sourceFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found.sort()
}

const SOURCE_FILES = sourceFiles()

/**
 * Every `import.meta.env.VITE_*` read in non-test source, with the fallback
 * that follows it. `?? 'literal'` counts as a fallback only when the literal is
 * non-empty: `?? ''` is the empty-means-unset shape that produced this bug.
 */
interface EnvRead {
  name: string
  file: string
  hasNonEmptyFallback: boolean
}

const READS: EnvRead[] = SOURCE_FILES.flatMap((file) => {
  const source = read(file)
  const pattern = /import\.meta\.env\.(VITE_[A-Z0-9_]+)((?:\s*as\s+[^)?]+)?\s*\)?\s*\?\?\s*(['"])([^'"]*)\3)?/g
  return [...source.matchAll(pattern)].map((match) => ({
    name: match[1],
    file,
    hasNonEmptyFallback: Boolean(match[4] && match[4].length > 0),
  }))
})

const READ_NAMES = [...new Set(READS.map((r) => r.name))].sort()

/** VITE_* keys documented in `.env.example`, commented lines ignored. */
const DOCUMENTED = [
  ...new Set(
    read(ENV_EXAMPLE_PATH)
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .flatMap((line) => /^\s*(VITE_[A-Z0-9_]+)\s*=/.exec(line)?.slice(1, 2) ?? []),
  ),
].sort()

/** VITE_* keys the Pages deploy exports into the production build. */
interface WorkflowStep {
  run?: string
  env?: Record<string, string>
}
const workflow = parse(read(WORKFLOW_PATH)) as {
  jobs?: Record<string, { steps?: WorkflowStep[] }>
}
const BUILD_ENV = [
  ...new Set(
    Object.values(workflow.jobs ?? {})
      .flatMap((job) => job.steps ?? [])
      .flatMap((step) => Object.keys(step.env ?? {}))
      .filter((key) => key.startsWith('VITE_')),
  ),
].sort()

/**
 * A bearer token must never be baked into a public static bundle, so
 * VITE_ADMIN_JWT is deliberately absent from the deploy workflow: unset is the
 * correct production value. `resolveAdminToken()` in src/config.ts falls back
 * to the OAuth `portal_token` AuthContext writes to localStorage after login,
 * so the admin surfaces have a real, non-env path to a token.
 *
 * The exclusion is itself asserted below (it must still be read somewhere, and
 * it must still lack a non-empty fallback), so this list cannot quietly become
 * a place to hide the next dead variable.
 */
const NOT_DEPLOY_CONFIGURABLE = ['VITE_ADMIN_JWT'] as const

describe('env contract: the scanners are not vacuous', () => {
  it('finds the source tree, the reads, and both declaration sources', () => {
    expect(SOURCE_FILES.length, 'no source files scanned').toBeGreaterThan(100)
    expect(READ_NAMES.length, 'no import.meta.env.VITE_* reads parsed').toBeGreaterThan(15)
    expect(DOCUMENTED.length, `no VITE_* keys parsed out of ${ENV_EXAMPLE_PATH}`).toBeGreaterThan(15)
    expect(BUILD_ENV.length, `no VITE_* keys parsed out of ${WORKFLOW_PATH}`).toBeGreaterThan(10)
  })

  it('parses the fallback beside each read, not just the name', () => {
    // VITE_GATEWAY_URL is the repo's reference "works with zero config" read.
    // If the fallback regex ever stops matching, every read looks unconfigured
    // and assertion B below would demand workflow entries for all of them.
    expect(
      READS.filter((r) => r.name === 'VITE_GATEWAY_URL').map((r) => r.hasNonEmptyFallback),
    ).toContain(true)
  })
})

describe('env contract A: every build variable the code reads is documented', () => {
  it('documents every VITE_* read in src/ in .env.example', () => {
    const undocumented = READ_NAMES.filter((name) => !DOCUMENTED.includes(name))
    expect(
      undocumented,
      `these variables are read by src/ but absent from ${ENV_EXAMPLE_PATH}, so nobody ` +
        'running this app locally can discover they exist',
    ).toEqual([])
  })

  it('reads every VITE_* that .env.example documents', () => {
    const unread = DOCUMENTED.filter((name) => !READ_NAMES.includes(name))
    expect(
      unread,
      `${ENV_EXAMPLE_PATH} documents these variables but no source file reads them; ` +
        'either wire them up or delete the entry',
    ).toEqual([])
  })
})

describe('env contract B: every build variable the code reads is settable in production', () => {
  it('either exports the variable from the Pages deploy or gives it a non-empty fallback', () => {
    const stranded = READ_NAMES.filter((name) => {
      if (BUILD_ENV.includes(name)) return false
      if ((NOT_DEPLOY_CONFIGURABLE as readonly string[]).includes(name)) return false
      return READS.filter((r) => r.name === name).some((r) => !r.hasNonEmptyFallback)
    })

    expect(
      stranded,
      `these variables are read with an empty fallback but ${WORKFLOW_PATH} never exports ` +
        'them, so the production build resolves them to "" with no way to change that. ' +
        'Add them to the build env, give the read a real default, or record why not in ' +
        'NOT_DEPLOY_CONFIGURABLE.',
    ).toEqual([])
  })

  it.each(NOT_DEPLOY_CONFIGURABLE)(
    '%s is still a real read that still needs the exclusion',
    (name) => {
      const reads = READS.filter((r) => r.name === name)
      expect(reads.length, `${name} is excluded but nothing reads it any more`).toBeGreaterThan(0)
      expect(
        reads.some((r) => !r.hasNonEmptyFallback),
        `${name} now has a non-empty fallback everywhere, so the exclusion is dead weight`,
      ).toBe(true)
      expect(BUILD_ENV, `${name} is excluded from the deploy env but present in it`).not.toContain(
        name,
      )
    },
  )
})

describe('env contract C: the deploy exports nothing the code does not read', () => {
  it('has a reader in src/ for every VITE_* in the Pages build env', () => {
    const unread = BUILD_ENV.filter((name) => !READ_NAMES.includes(name))
    expect(
      unread,
      `${WORKFLOW_PATH} exports these into the production build but no source file reads ` +
        'them. This is exactly how the variable v1.21.1 retired survived: fully wired, ' +
        'entirely dead.',
    ).toEqual([])
  })
})

describe('env contract D: every config export is reachable', () => {
  const CONFIG_EXPORTS = [...read(CONFIG_PATH).matchAll(/^export\s+(?:const|function)\s+(\w+)/gm)].map(
    (m) => m[1],
  )

  it('parses the exports out of src/config.ts', () => {
    expect(CONFIG_EXPORTS.length, 'no exports parsed out of src/config.ts').toBeGreaterThan(3)
  })

  it('has at least one importer for every constant src/config.ts exports', () => {
    const importers = SOURCE_FILES.filter((file) => file !== CONFIG_PATH).map(read)
    const orphaned = CONFIG_EXPORTS.filter(
      (name) => !importers.some((source) => new RegExp(`\\b${name}\\b`).test(source)),
    )
    expect(
      orphaned,
      'src/config.ts exports these and nothing imports them. An unused export that reads ' +
        'an environment variable is dead build-time config (AI_ORCHESTRATOR_URL was exactly ' +
        'this until v1.21.1); delete it or wire it up.',
    ).toEqual([])
  })
})

describe('env contract E: an unset variable degrades visibly, never invisibly', () => {
  // The literal tripwire. The structural form of this contract (AST walk,
  // catches renamed states and direct `return null` guards) is
  // envVisibility.test.ts; keep both, they fail on different evidence.
  /** Files that read a VITE_* directly or import a URL constant from config. */
  const ENV_COUPLED = SOURCE_FILES.filter((file) => {
    const source = read(file)
    return (
      /import\.meta\.env\.VITE_/.test(source) ||
      /import\s*\{[^}]*_URL[^}]*\}\s*from\s*'[^']*\/config'/.test(source)
    )
  })

  it('finds the env-coupled modules', () => {
    expect(ENV_COUPLED.length, 'no env-coupled modules found; the guard would pass vacuously')
      .toBeGreaterThan(5)
  })

  it('has no module that switches itself off because a variable is unset', () => {
    const offenders = ENV_COUPLED.filter((file) => /'disabled'/.test(read(file)))
    expect(
      offenders,
      "these modules read build-time config and carry a 'disabled' state. That is the " +
        'BADGE-DEAD-1 shape: an unset variable takes the disabled branch and the component ' +
        'returns null, so the surface vanishes with no error and a green deploy. Render an ' +
        'explicit "not configured" state instead, the way PortalLoginGate, LiveFeedTab and ' +
        'ServiceHealthPage already do.',
    ).toEqual([])
  })
})

describe('env contract F: the pages that lost a dead panel point at a live one', () => {
  // v1.21.1 removed BuildStatusSection from #/case-studies and
  // #/case-studies/cicd and PipelineMetrics from #/case-studies/dynamodb. Each
  // of those pages must still hand the visitor a surface that is actually live,
  // which is the #/status board (src/pages/StatusPage.tsx, reading the gateway
  // aggregate). Reads both sides: the page source and the router vocabulary.
  const PAGES = [
    'src/pages/CaseStudiesPage.tsx',
    'src/pages/CicdCaseStudyPage.tsx',
    'src/pages/DynamoDbCaseStudyPage.tsx',
  ] as const

  it('still routes #/status', () => {
    expect(read('src/main.tsx')).toContain("hash === '#/status'")
  })

  it.each(PAGES)('%s links the live status board', (page) => {
    expect(read(page)).toContain('href="#/status"')
  })

  it.each(PAGES)('%s no longer mounts a monitoring panel', (page) => {
    const source = read(page)
    expect(source).not.toContain('BuildStatusSection')
    expect(source).not.toContain('PipelineMetrics')
  })
})
