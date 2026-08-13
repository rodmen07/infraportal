/**
 * Required dependency-audit gate guard (DevSecOps, 2026-08-07).
 *
 * `.github/workflows/test.yml`'s "Audit npm dependencies" step is the only
 * required check that looks at advisories at all, and on 2026-08-07 it was
 * proven blind to the exact advisory class it exists to stop.
 *
 * GHSA-55q2-fjhq-7xh7 (dompurify <=3.4.12, MODERATE, "IN_PLACE hook removal
 * leaves a detached subtree executable, causing XSS") sat in a DIRECT
 * production dependency while that step reported exit 0 / "found 0
 * vulnerabilities", because it was pinned at `--audit-level=high`. dompurify
 * is this app's only untrusted-HTML sanitiser: `DOMPurify.sanitize()` feeds the
 * single `dangerouslySetInnerHTML` on a portal surface
 * (`src/features/portal/projectDetail.tsx`). Measured both directions on the
 * pre-fix lockfile: `--omit=dev --audit-level=high` exited 0, `--omit=dev
 * --audit-level=moderate` exited 1 with that one advisory.
 *
 * Three ways that gate can silently stop guarding, and this file locks all
 * three:
 *
 *   1. the THRESHOLD drifts back up (or the step gets neutered with
 *      `continue-on-error` / `|| true`, the pattern already live one step
 *      below it on the codecov upload)
 *   2. the SCOPE stops covering what ships. `--omit=dev` is a deliberate
 *      decision documented in the workflow, but it means the gate audits
 *      exactly `package.json`'s `dependencies` and nothing else. A package
 *      that runtime `src/` imports while being declared in `devDependencies`
 *      is shipped in the bundle and invisible to the required check.
 *   3. the CADENCE stops covering the calendar. An audit that runs only on
 *      `push`/`pull_request` is a function of our commit rate, not of the
 *      advisory database's publication rate. Measured 2026-08-08 over the last
 *      100 `Tests` runs on main: the largest gap between consecutive advisory
 *      checks was 76.0 h, and zero schedule-triggered runs audited anything.
 *      `.github/workflows/security-audit.yml` closes that; the assertion below
 *      keeps it closed.
 *
 *   4. the two SCOPES collapse into one. Since 2026-08-10 this repo audits at
 *      two scopes on purpose (DEP-AUDIT-SCOPE-1, owner decision: option (b)):
 *      `--omit=dev` in the required `Unit Tests` job, which blocks, and the
 *      FULL tree in `Full-tree audit (advisory)`, which reports and does not.
 *      Either half can be undone by a one-line edit that reads as harmless --
 *      dropping `--omit=dev` from the required step makes a dev-tool advisory
 *      merge-blocking (option (c), which the owner did NOT choose), and moving
 *      the full-tree step into `test` does the same from the other direction.
 *      The last describe block asserts both directions against the recorded
 *      required-context list.
 *
 *   5. "non-blocking" stops being true ONE LEVEL UP. Added 2026-08-13
 *      (ADVISORY-RED-MAIN-1, option (c)). Branch protection could already see
 *      that the full-tree job blocks no merge, and the Pages deploy is
 *      `push`-triggered rather than a `workflow_run` consumer, so it blocks no
 *      deploy either. But while that job ALSO ran on `push` to main, a dev-tree
 *      advisory would show the `Tests` RUN on main as failed with all five
 *      required contexts green -- and the run-level colour of `Tests` is what
 *      every reader treats as "main is green", including autodev's preemption
 *      ladder, which takes a red main as a tier-1 interrupt. The job is now
 *      `if: github.event_name != 'push'` and its calendar arm moved to
 *      `security-audit.yml`'s daily cron. Both halves are asserted, because
 *      dropping the push arm WITHOUT adding the cron arm is the cheaper edit
 *      and is a genuine loss of coverage; so is the symmetric mistake of
 *      silencing the REQUIRED audit on main the same way.
 *
 * WIDENED 2026-08-08 (DevSecOps). This file used to read exactly one
 * hand-named workflow, `test.yml`. That was correct while `test.yml` held the
 * only `npm audit` line in the repo, and it silently stopped being correct the
 * moment a second workflow ran one: a step outside the corpus is not "clean",
 * it is UNREAD, and the two are indistinguishable in a green report (L-046).
 * The workflow set is now GLOB-DISCOVERED, so a third audit invocation is
 * covered on the day it is written rather than on the day somebody remembers
 * this file. `test.yml` keeps a named anchor of its own, because it is the one
 * that is a REQUIRED context: without that anchor, deleting the required audit
 * and leaving only the scheduled one would pass every assertion here.
 *
 * Drift guard, not a one-time check (L-003): every assertion reads BOTH
 * sources it compares (the workflow vs the recorded severity order; the real
 * runtime import graph vs `package.json`), and each has a vacuity assert so a
 * broken parse announces itself instead of passing green. Source-scan
 * assertions in this repo's established pattern (`repoIdentity.test.ts`,
 * `pagesDeployWorkflow.test.ts`).
 *
 * Both artifacts are read with their REAL parser rather than by regex (L-023):
 * the workflow through `yaml`, the sources through the TypeScript AST. The
 * second is load-bearing, not stylistic -- see `moduleSpecifiersOf` below for
 * the three phantom packages a `from '...'` regex reported here on its first
 * run. The file list is glob-discovered with a zero-match hard failure and a
 * `react` presence anchor, never hand-enumerated (L-031), so the next module
 * extraction cannot silently shrink what is watched.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import ts from 'typescript'

const ROOT = process.cwd()
const WORKFLOWS_DIR = '.github/workflows'
const TESTS_WORKFLOW_PATH = `${WORKFLOWS_DIR}/test.yml`
const SCHEDULED_AUDIT_WORKFLOW_PATH = `${WORKFLOWS_DIR}/security-audit.yml`
const PACKAGE_JSON_PATH = 'package.json'
const SRC_DIR = 'src'

interface WorkflowStep {
  name?: string
  run?: string
  'continue-on-error'?: boolean
}

interface WorkflowJob {
  name?: string
  /**
   * A job-level `if:`. GitHub still CREATES the job for an event the workflow
   * triggers on and then reports it `skipped`, so this expression — not the
   * workflow's `on:` block — is what decides whether an advisory audit can
   * colour a run. It is therefore read as part of the corpus, not ignored.
   */
  if?: string
  steps?: WorkflowStep[]
}

interface WorkflowTriggers {
  schedule?: { cron?: string }[]
  /** `push:` with no body parses to `null`, which is still a live trigger. */
  push?: { branches?: string[] } | null
}

interface Workflow {
  on?: WorkflowTriggers
  jobs?: Record<string, WorkflowJob>
}

/** An `npm audit` step, carrying the workflow and the JOB it was read out of. */
interface AuditStep extends WorkflowStep {
  workflow: string
  jobId: string
  /**
   * The status-check context GitHub creates for the owning job: its `name:` if
   * it declares one, otherwise the job id. This is the string branch
   * protection matches on, which is what makes "required" vs "advisory" a
   * property this file can actually assert.
   */
  context: string
  /** The owning job's `if:` expression, verbatim, or `undefined` if it has none. */
  jobIf?: string
}

interface PackageManifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const manifest = JSON.parse(
  readFileSync(path.join(ROOT, PACKAGE_JSON_PATH), 'utf-8'),
) as PackageManifest

/**
 * Every workflow file, discovered rather than listed (L-031). A hand-written
 * list is exactly what let a second `npm audit` step live outside this guard.
 */
function workflowFiles(): string[] {
  return readdirSync(path.join(ROOT, WORKFLOWS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => `${WORKFLOWS_DIR}/${entry.name}`)
    .sort()
}

const WORKFLOW_FILES = workflowFiles()

/**
 * `on` is a YAML 1.1 boolean. The `yaml` package parses these files as YAML
 * 1.2, where it stays the string key GitHub actually means, but a parser or
 * schema change would move it to the `true` key and silently empty out the
 * trigger assertions below -- so read both and let the vacuity anchors speak.
 */
function triggersOf(workflow: Workflow): WorkflowTriggers {
  const legacyBooleanKey = (workflow as Record<string, unknown>)['true']
  return (workflow.on ?? (legacyBooleanKey as WorkflowTriggers) ?? {}) as WorkflowTriggers
}

const WORKFLOWS = new Map<string, Workflow>(
  WORKFLOW_FILES.map((file) => [
    file,
    parse(readFileSync(path.join(ROOT, file), 'utf-8')) as Workflow,
  ]),
)

/** Every `npm audit` step in the repo, from every workflow, with its job. */
const auditSteps: AuditStep[] = [...WORKFLOWS.entries()].flatMap(
  ([file, workflow]) =>
    Object.entries(workflow.jobs ?? {}).flatMap(([jobId, job]) =>
      (job.steps ?? [])
        .filter(
          (step) =>
            typeof step.run === 'string' && /\bnpm audit\b/.test(step.run),
        )
        .map((step) => ({
          ...step,
          workflow: file,
          jobId,
          context: job.name ?? jobId,
          jobIf: job.if,
        })),
    ),
)

const auditStepsIn = (file: string) =>
  auditSteps.filter((step) => step.workflow === file)

/** Human-readable id for a failure message: which file, which job, which step. */
const whereIs = (step: AuditStep) =>
  `${step.workflow} [${step.context}]: ${step.name ?? (step.run as string)}`

/**
 * The required status contexts on `main`, read from
 * `repos/rodmen07/infraportal/branches/main/protection` on 2026-08-10:
 * `["Build","Linting","Type Check","Unit Tests","GitGuardian Security Checks"]`,
 * `strict: true`.
 *
 * Recorded rather than fetched, because this suite runs offline. The API stays
 * the authority; this is the copy the two scope assertions compare the WORKFLOW
 * against, and it can genuinely fail without anyone editing it — renaming a
 * job, or moving an `npm audit` step from one job to another, breaks the
 * comparison on the next run.
 */
const REQUIRED_CONTEXTS = [
  'Build',
  'Linting',
  'Type Check',
  'Unit Tests',
  'GitGuardian Security Checks',
] as const

const isRequiredContext = (context: string) =>
  (REQUIRED_CONTEXTS as readonly string[]).includes(context)

/**
 * `--omit=dev` is what makes an audit a PRODUCTION-tree audit: it drops the
 * whole devDependencies tree, so a step carrying it is structurally incapable
 * of reporting a dev-tool advisory. A step WITHOUT it audits the full tree.
 */
const isProductionScoped = (step: AuditStep) =>
  /--omit=dev\b/.test(step.run as string)

/**
 * Does the step's workflow run on `push` at all? `push:` with no body is a live
 * trigger that parses to `null`, so presence of the KEY is the question, not
 * truthiness of the value.
 */
const workflowRunsOnPush = (file: string) =>
  'push' in (triggersOf(WORKFLOWS.get(file) as Workflow) as Record<string, unknown>)

/**
 * The job-level `if:` expressions that provably exclude the `push` event.
 *
 * A general GitHub expression cannot be evaluated statically, so this is a
 * deliberate allow-list of the two forms that are unambiguous, rather than a
 * substring search for "push" (which `github.event_name == 'push'` — the exact
 * inverse — would also satisfy). Anything else counts as NOT excluding push:
 * an unrecognised guard fails closed, which is the direction that reports a
 * problem instead of hiding one.
 */
const PUSH_EXCLUDING_JOB_GUARDS = [
  "github.event_name != 'push'",
  "github.event_name == 'pull_request'",
] as const

/** `${{ github.event_name != 'push' }}` and the bare form normalise the same. */
const normaliseExpression = (expression: string) =>
  expression
    .replace(/^\s*\$\{\{\s*/, '')
    .replace(/\s*\}\}\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/"/g, "'")
    .trim()

const jobExcludesPush = (step: AuditStep) =>
  step.jobIf !== undefined &&
  (PUSH_EXCLUDING_JOB_GUARDS as readonly string[]).includes(
    normaliseExpression(step.jobIf),
  )

/**
 * Can this audit step run — and therefore colour the workflow RUN — on a
 * `push` to main? Both halves matter: the workflow must trigger on push, and
 * the owning job must not be guarded off it.
 */
const isReachableOnPush = (step: AuditStep) =>
  workflowRunsOnPush(step.workflow) && !jobExcludesPush(step)

/** A cron that fires every day, i.e. `<m> <h> * * *`. */
const isDailyCron = (cron: unknown) =>
  typeof cron === 'string' && /^\S+ \S+ \* \* \*$/.test(cron.trim())

/** Does the step's workflow carry a cron that fires daily? */
const workflowRunsDaily = (file: string) =>
  (triggersOf(WORKFLOWS.get(file) as Workflow).schedule ?? []).some((entry) =>
    isDailyCron(entry?.cron),
  )

/**
 * npm's `--audit-level` scale, least to most severe. The gate must sit at or
 * BELOW the recorded ceiling: raising it hides advisories, and every level
 * above `moderate` would have hidden GHSA-55q2-fjhq-7xh7.
 */
const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'] as const
const AUDIT_LEVEL_CEILING = 'moderate'

/** Escapes that leave a step present in the yaml but unable to fail the job. */
const NEUTERING_PATTERNS: { pattern: RegExp; what: string }[] = [
  { pattern: /\|\|\s*true\b/, what: '`|| true`' },
  { pattern: /\|\|\s*exit\s+0\b/, what: '`|| exit 0`' },
  { pattern: /;\s*true\s*$/, what: 'a trailing `; true`' },
  { pattern: /--force\b/, what: '`--force`' },
]

const auditLevelOf = (run: string) =>
  /--audit-level[= ]([a-z]+)/.exec(run)?.[1]

/** Every `.ts`/`.tsx` under `src/` that is NOT a test file, i.e. ships. */
function runtimeSourceFiles(): string[] {
  const abs = path.join(ROOT, SRC_DIR)
  return readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) =>
      path
        .relative(ROOT, path.join(entry.parentPath, entry.name))
        .replace(/\\/g, '/'),
    )
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .sort()
}

/** `@scope/pkg/sub` -> `@scope/pkg`; `pkg/sub` -> `pkg`. */
function packageNameOf(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * Module specifiers are read off the TypeScript AST, never off the raw text.
 *
 * A regex sweep for `from '...'` is wrong here in a way that is not
 * hypothetical: it reported three phantom packages in this repo on the first
 * run, all of them prose or generated output rather than imports --
 * `${SDK_PACKAGE_NAME}` from the template literal that BUILDS an example
 * import line for the API-docs snippets (snippetModel.ts:213), plus two
 * English sentences containing the word "from" followed by a quoted phrase
 * (a JSDoc line in usePricingContent.ts, a case-study string in
 * DynamoDbCaseStudyPage.tsx). A guard that reports garbage gets deleted, so
 * it must only ever see real import declarations. Same AST approach as
 * `envVisibility.test.ts` in this directory.
 */
function moduleSpecifiersOf(file: string, source: string): string[] {
  // Script kind must follow the extension: parsing a .ts file as TSX would
  // misread `<T>value` type assertions as JSX.
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
  const specifiers: string[] = []

  const visit = (node: ts.Node): void => {
    // `import x from 'pkg'`, `export { x } from 'pkg'`
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    }
    // `import('pkg')` -- a real dynamic import, not a call to something named
    // `import`, so the literal argument is the specifier.
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }
    // `import x = require('pkg')`
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text)
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sf, visit)
  return specifiers
}

/** Bare (non-relative, non-builtin) package names imported by shipped code. */
function runtimePackageImports(): Map<string, string[]> {
  const byPackage = new Map<string, string[]>()

  for (const file of runtimeSourceFiles()) {
    const source = readFileSync(path.join(ROOT, file), 'utf-8')
    for (const specifier of moduleSpecifiersOf(file, source)) {
      if (specifier.startsWith('.') || specifier.startsWith('node:')) continue
      const name = packageNameOf(specifier)
      byPackage.set(name, [...(byPackage.get(name) ?? []), file])
    }
  }

  return byPackage
}

describe('Required npm-audit gate: threshold', () => {
  it('discovers the workflow directory and parses it', () => {
    // Vacuity anchors for the glob itself: if the discovery breaks, every
    // assertion in this file passes on an empty set instead of failing.
    expect(
      WORKFLOW_FILES,
      `no workflow files were discovered under ${WORKFLOWS_DIR}/; the glob is ` +
        'broken and every assertion in this file would pass vacuously.',
    ).toContain(TESTS_WORKFLOW_PATH)

    expect(
      [...WORKFLOWS.values()].filter((workflow) => workflow.jobs !== undefined)
        .length,
      'no discovered workflow parsed into a `jobs:` map, so the yaml parse is ' +
        'broken and the audit-step scan below would find nothing.',
    ).toBeGreaterThan(0)
  })

  it(`parses at least one npm audit step out of ${TESTS_WORKFLOW_PATH}`, () => {
    // Named on purpose. `test.yml`'s audit is the one inside a REQUIRED
    // context, so it is the one whose disappearance must fail here. The
    // repo-wide assertions below would stay green if it were deleted and only
    // the scheduled audit survived.
    expect(
      auditStepsIn(TESTS_WORKFLOW_PATH).length,
      `no \`npm audit\` step was parsed out of ${TESTS_WORKFLOW_PATH}, the only ` +
        'workflow whose audit sits in a required status context. If the audit ' +
        'moved, move this anchor with it rather than deleting it.',
    ).toBeGreaterThan(0)
  })

  it('declares an explicit --audit-level on every npm audit step', () => {
    const missing = auditSteps
      .filter((step) => auditLevelOf(step.run as string) === undefined)
      .map(whereIs)

    expect(
      missing,
      'an `npm audit` with no `--audit-level` fails on ANY advisory including ' +
        'informational ones, so it gets loosened or deleted the first time it ' +
        'reds the base. State the threshold explicitly.',
    ).toEqual([])
  })

  it(`keeps the threshold at or below "${AUDIT_LEVEL_CEILING}"`, () => {
    const ceiling = SEVERITY_ORDER.indexOf(AUDIT_LEVEL_CEILING)
    const tooLoose = auditSteps
      .filter((step) => {
        const level = auditLevelOf(step.run as string) as string
        const index = SEVERITY_ORDER.indexOf(
          level as (typeof SEVERITY_ORDER)[number],
        )
        return index === -1 || index > ceiling
      })
      .map((step) => `${whereIs(step)} (${auditLevelOf(step.run as string)})`)

    expect(
      tooLoose,
      `these thresholds are above "${AUDIT_LEVEL_CEILING}" (or are not a valid ` +
        `npm level: ${SEVERITY_ORDER.join(', ')}). The gate ran at "high" until ` +
        '2026-08-07 and reported "found 0 vulnerabilities" while ' +
        'GHSA-55q2-fjhq-7xh7 (moderate XSS) sat in dompurify, a DIRECT ' +
        "production dependency that is the app's only HTML sanitiser. " +
        'Raising this again re-opens that blind spot.',
    ).toEqual([])
  })

  it('does not let the audit step fail without failing the job', () => {
    const neutered = auditSteps.flatMap((step) => {
      const found: string[] = []
      if (step['continue-on-error'] === true) found.push('`continue-on-error: true`')
      for (const { pattern, what } of NEUTERING_PATTERNS) {
        if (pattern.test(step.run as string)) found.push(what)
      }
      return found.map((what) => `${whereIs(step)}: ${what}`)
    })

    expect(
      neutered,
      'the audit step would still be present in the yaml and still be unable ' +
        'to block a merge. `continue-on-error: true` is already live one step ' +
        'below it (the codecov upload), so this is a copy-paste away.',
    ).toEqual([])
  })

  it('runs every PRODUCTION-scoped npm audit with the SAME command', () => {
    // Two hand-authored files, not a value compared against its own source, so
    // this can really fail: the scheduled audit and the required one are
    // written and edited independently, and a looser twin is worse than no
    // twin -- it makes "the audit is green" mean two different things
    // depending on which run you happen to be reading.
    //
    // NARROWED 2026-08-10 from "every npm audit in the repo" to "every
    // PRODUCTION-scoped one". This assertion used to demand exactly ONE
    // distinct command repo-wide, and its own failure message said "Keep one
    // command, or state here why they must differ." The reason they must
    // differ is now recorded: DEP-AUDIT-SCOPE-1, answered by the owner on
    // 2026-08-10 with option (b) -- a second, NON-REQUIRED job auditing the
    // FULL tree, deliberately at a different scope from the required gate.
    // The narrowing costs nothing, because everything the old assertion
    // actually protected (a looser production twin) is still asserted here,
    // and the new scope is held by the three assertions below plus the
    // threshold-parity one.
    const commands = [
      ...new Set(
        auditSteps
          .filter(isProductionScoped)
          .map((step) => (step.run as string).trim().replace(/\s+/g, ' ')),
      ),
    ]

    expect(
      commands,
      `the repo's production (\`--omit=dev\`) \`npm audit\` invocations ` +
        `disagree: ${commands
          .map((command) => JSON.stringify(command))
          .join(' vs ')}. Discovered in ${auditSteps
          .filter(isProductionScoped)
          .map((step) => step.workflow)
          .join(', ')}. Keep one command, or state here why they must differ.`,
    ).toHaveLength(1)
  })

  it('runs every FULL-TREE npm audit with the SAME command', () => {
    // The twin of the assertion above, in the other partition, added 2026-08-13
    // when ADVISORY-RED-MAIN-1 option (c) created a SECOND full-tree invocation
    // (security-audit.yml's daily arm, replacing the `push`-to-main arm the
    // test.yml job lost). Until that moment there was exactly one full-tree
    // audit in the repo and nothing could disagree with it; a partition of size
    // one needs no parity assertion, which is precisely why forking it is the
    // moment to write one (L-066: a hand-shaped guard goes silently partial the
    // instant a sibling appears, and it stays green while doing so).
    //
    // The two are edited independently in two files and answer the same
    // question, so a drift between them would make "the advisory audit is
    // green" mean two different things depending on which run is being read --
    // the exact confusion the production twin exists to prevent.
    const commands = [
      ...new Set(
        auditSteps
          .filter((step) => !isProductionScoped(step))
          .map((step) => (step.run as string).trim().replace(/\s+/g, ' ')),
      ),
    ]

    expect(
      commands,
      `the repo's full-tree \`npm audit\` invocations disagree: ${commands
        .map((command) => JSON.stringify(command))
        .join(' vs ')}. Discovered in ${auditSteps
        .filter((step) => !isProductionScoped(step))
        .map((step) => step.workflow)
        .join(', ')}. Keep one command, or state here why they must differ.`,
    ).toHaveLength(1)
  })

  it('holds the full-tree audit to the SAME threshold as the required gate', () => {
    // The two scopes are allowed to differ. The severity floor is not: if the
    // advisory job sat at `high` while the required gate sat at `moderate`,
    // "the audit is green" would mean two different things again, which is the
    // exact confusion the assertion above exists to prevent.
    const levels = (predicate: (step: AuditStep) => boolean) => [
      ...new Set(
        auditSteps
          .filter(predicate)
          .map((step) => auditLevelOf(step.run as string)),
      ),
    ]

    const production = levels(isProductionScoped)
    const fullTree = levels((step) => !isProductionScoped(step))

    expect(
      production,
      'no production-scoped audit declared an --audit-level, so the comparison ' +
        'below would be vacuous.',
    ).toHaveLength(1)

    expect(
      fullTree,
      `the full-tree audit runs at ${JSON.stringify(fullTree)} while the ` +
        `required production gate runs at ${JSON.stringify(production)}. ` +
        'Both scopes must use the same severity floor.',
    ).toEqual(production)
  })
})

describe('Advisory full-tree audit: visible, and structurally non-blocking', () => {
  // DEP-AUDIT-SCOPE-1, owner decision 2026-08-10: option (b).
  //
  // The required gate keeps `--omit=dev` and is NOT weakened, narrowed, or
  // replaced. A second job audits the FULL tree and reports without blocking.
  // Option (c) -- making the full tree required -- was explicitly NOT chosen:
  // a dev-tool advisory must not hold unrelated merges hostage.
  //
  // Both halves of that decision are asserted here, because each of them can
  // be undone by a one-line edit that looks harmless in review: deleting
  // `--omit=dev` from the required step silently makes a dev advisory
  // merge-blocking, and moving the full-tree step into the `test` job does the
  // same thing from the other direction.

  const fullTreeAudits = auditSteps.filter((step) => !isProductionScoped(step))

  it('runs at least one audit over the FULL tree', () => {
    expect(
      fullTreeAudits.map(whereIs),
      'no `npm audit` in this repo omits `--omit=dev`, so nothing can see a ' +
        'dev-tree advisory at all. That blind spot is what DEP-AUDIT-SCOPE-1 ' +
        'was filed about and what the owner decided on 2026-08-10; restore the ' +
        'full-tree job rather than deleting this assertion.',
    ).not.toEqual([])
  })

  it('keeps every full-tree audit OUT of a required-context job', () => {
    const blocking = fullTreeAudits
      .filter((step) => isRequiredContext(step.context))
      .map((step) => `${whereIs(step)} -> required context "${step.context}"`)

    expect(
      blocking,
      'a full-tree `npm audit` is running inside a job whose name is a REQUIRED ' +
        `status context (${REQUIRED_CONTEXTS.join(', ')}), so a dev-tool ` +
        'advisory would block every merge. That is option (c), which the owner ' +
        'did NOT choose on 2026-08-10. Give the full-tree audit its own ' +
        'non-required job. Re-read the live list with `gh api ' +
        'repos/rodmen07/infraportal/branches/main/protection` if it has moved.',
    ).toEqual([])
  })

  it('keeps the production gate INSIDE a required-context job', () => {
    // The other direction, and the one that matters more: adding a visible
    // advisory job is worthless if it arrives by demoting the gate that
    // actually blocks. This fails if the `--omit=dev` audit is deleted from
    // `test.yml`, or moved out of the job whose name is a required context.
    const requiredGates = auditSteps
      .filter(isProductionScoped)
      .filter((step) => isRequiredContext(step.context))
      .map(whereIs)

    expect(
      requiredGates,
      'no `npm audit --omit=dev` step is running inside a job whose name is a ' +
        `required status context (${REQUIRED_CONTEXTS.join(', ')}). The ` +
        'merge-blocking dependency gate is gone: an advisory against a SHIPPED ' +
        'package would no longer stop a merge.',
    ).not.toEqual([])
  })
})

describe('Advisory full-tree audit: on the calendar, off the main-push path', () => {
  // ADVISORY-RED-MAIN-1, closed 2026-08-13 with option (c).
  //
  // "Non-blocking" was already true at the two places branch protection can
  // see: the full-tree job is not a required context, and `Deploy to GitHub
  // Pages` is `push`-triggered rather than a `workflow_run` consumer of
  // `Tests`. It was NOT true one level up. While the job also ran on `push` to
  // main, the first real dev-tree advisory would show the `Tests` RUN on main
  // as failed with all five required contexts green -- and `Tests` is the
  // workflow whose run-level colour every reader, human and automated, treats
  // as "main is green". autodev's preemption ladder takes a red main as a
  // tier-1 interrupt, so a `typescript` advisory could have claimed a whole
  // increment: the toolchain veto over delivery that the owner's 2026-08-10
  // decision was chosen to deny, re-entering above the gate it was denied at.
  //
  // The old workflow comment said "read which job failed before treating it as
  // a broken-main incident". Prose is not a mechanism; this file is.
  //
  // The signal is MOVED, not weakened, and that is why both halves are asserted
  // here. Removing the `push` arm without adding the cron arm would be a real
  // loss of coverage, and it is the cheaper of the two edits.
  const fullTreeAudits = auditSteps.filter((step) => !isProductionScoped(step))
  const productionAudits = auditSteps.filter(isProductionScoped)

  it('sees a `push:` trigger on an auditing workflow', () => {
    // Vacuity anchor for the trigger parse. If `workflowRunsOnPush` ever stops
    // finding the key -- a yaml-parser change moving `on:` to the YAML 1.1
    // boolean `true`, a schema change, a rename -- then "no full-tree audit is
    // reachable on push" becomes true of everything and passes on an empty set,
    // which is the same green a correctly guarded repo reports.
    expect(
      WORKFLOW_FILES.filter(workflowRunsOnPush),
      'no discovered workflow declares a `push:` trigger, so the push-reachability ' +
        'assertions below would pass vacuously. `test.yml` runs on push to main.',
    ).toContain(TESTS_WORKFLOW_PATH)
  })

  it('keeps every full-tree audit OFF the `push` path', () => {
    const onPush = fullTreeAudits
      .filter(isReachableOnPush)
      .map(
        (step) =>
          `${whereIs(step)} -> job \`if:\` is ${
            step.jobIf === undefined ? 'absent' : JSON.stringify(step.jobIf)
          }`,
      )

    expect(
      onPush,
      'a full-tree `npm audit` can run on a `push` event, so a dev-tree ' +
        'advisory would colour that workflow RUN red on main while every ' +
        'required context stayed green -- indistinguishable from a broken main ' +
        'to any reader that does not open the run. Guard the job with one of ' +
        `${PUSH_EXCLUDING_JOB_GUARDS.map((guard) => `\`${guard}\``).join(' or ')}` +
        ', or move it to a workflow that does not trigger on push. The daily ' +
        `arm in ${SCHEDULED_AUDIT_WORKFLOW_PATH} is what replaces the cadence.`,
    ).toEqual([])
  })

  it('keeps a production audit ON the `push` path', () => {
    // The symmetric direction, and the one a future "just make main green"
    // edit would break: copying `if: github.event_name != 'push'` onto the
    // `test` job would silence the REQUIRED, merge-blocking audit on main too,
    // and would look like the same one-line fix in review.
    expect(
      productionAudits.filter(isReachableOnPush).map(whereIs),
      'no `npm audit --omit=dev` step can run on a `push` event any more. The ' +
        'advisory audit was moved off the push path on purpose (ADVISORY-RED-MAIN-1, ' +
        '2026-08-13); the REQUIRED production gate was not, and must still run ' +
        'when a commit lands on main.',
    ).not.toEqual([])
  })

  it('audits the FULL tree on a daily cron', () => {
    // Losing the `push`-to-main arm costs real calendar coverage unless
    // something replaces it. Note the direction of the trade: `push` fired on
    // OUR commit rate (measured 2026-08-08: gaps up to 76.0 h between advisory
    // checks on main), a daily cron fires on the calendar, so this is a
    // tightening rather than a swap.
    const daily = fullTreeAudits.filter((step) => workflowRunsDaily(step.workflow))

    expect(
      daily.map(whereIs),
      'no workflow running a FULL-TREE `npm audit` carries a daily `cron:`. ' +
        'Since 2026-08-13 the full-tree audit no longer runs on `push` to main, ' +
        `so ${SCHEDULED_AUDIT_WORKFLOW_PATH}'s cron is the ONLY thing bounding ` +
        'how long a dev-tree advisory can sit unreported between pull requests. ' +
        'Restore the daily arm rather than deleting this assertion.',
    ).not.toEqual([])
  })
})

describe('Required npm-audit gate: cadence vs the advisory database', () => {
  const scheduledAuditWorkflows = auditSteps
    .map((step) => step.workflow)
    .filter((file) => (triggersOf(WORKFLOWS.get(file) as Workflow).schedule ?? []).length > 0)

  it('audits on a schedule, not only when somebody pushes', () => {
    expect(
      [...new Set(scheduledAuditWorkflows)],
      'no workflow that runs `npm audit` carries a `schedule:` trigger, so the ' +
        'advisory check is a function of our commit rate rather than of the ' +
        'advisory database. Measured 2026-08-08 over the last 100 `Tests` runs ' +
        `on main, the largest gap between checks was 76.0 h. ` +
        `${SCHEDULED_AUDIT_WORKFLOW_PATH} exists to bound it at 24 h; restore ` +
        'the cron rather than deleting this assertion.',
    ).not.toEqual([])
  })

  it('gives the scheduled audit a cron that actually fires daily', () => {
    // A `schedule:` key with no usable cron is the same inert surface as no
    // schedule at all, and it reports identically in the yaml.
    const crons = [...new Set(scheduledAuditWorkflows)].flatMap(
      (file) =>
        (triggersOf(WORKFLOWS.get(file) as Workflow).schedule ?? []).map(
          (entry) => entry.cron,
        ),
    )

    expect(
      crons.filter((cron) => typeof cron === 'string' && cron.trim() !== ''),
      'a `schedule:` block was found on an auditing workflow but it declares no ' +
        'usable `cron:` expression.',
    ).not.toEqual([])

    const daily = crons.filter(
      (cron) => typeof cron === 'string' && /^\S+ \S+ \* \* \*$/.test(cron),
    )

    expect(
      daily,
      `the auditing schedules are ${JSON.stringify(crons)}; none of them runs ` +
        'every day. A weekly advisory check leaves a window of up to 7 days, ' +
        'which is wider than the 76.0 h gap this workflow was written to close.',
    ).not.toEqual([])
  })

  it('keeps the scheduled audit off the required-context path', () => {
    // The scheduled workflow must never become a required status check: on a
    // PR that does not touch it, the path filter means the check run is never
    // created at all, and a required context that is never created blocks
    // every PR forever. Same failure mode the portfolio playbook records for
    // `Coverage` and `Deploy ${{ matrix.service }}`.
    const scheduled = WORKFLOWS.get(SCHEDULED_AUDIT_WORKFLOW_PATH)
    expect(
      scheduled,
      `${SCHEDULED_AUDIT_WORKFLOW_PATH} was not discovered; if the scheduled ` +
        'audit moved, move this assertion with it.',
    ).toBeDefined()

    const pullRequest = (
      triggersOf(scheduled as Workflow) as {
        pull_request?: { paths?: string[] }
      }
    ).pull_request

    expect(
      pullRequest?.paths,
      'the scheduled audit runs on `pull_request` with no `paths` filter, so it ' +
        'creates a check run on every PR in the repo. Either filter it to its ' +
        'own file (so it exercises itself and nothing else) or drop the ' +
        'trigger.',
    ).toContain(SCHEDULED_AUDIT_WORKFLOW_PATH)
  })
})

describe('Required npm-audit gate: scope vs what actually ships', () => {
  const imports = runtimePackageImports()
  const dependencies = manifest.dependencies ?? {}
  const devDependencies = manifest.devDependencies ?? {}

  it('scans a real runtime import graph', () => {
    expect(
      runtimeSourceFiles().length,
      `no non-test .ts/.tsx files were found under ${SRC_DIR}/`,
    ).toBeGreaterThan(0)

    // `react` is imported by essentially every component here; if the
    // extraction regexes break, this anchor fails instead of the suite
    // silently reporting an empty import set as "nothing in the dev tree".
    expect(
      [...imports.keys()],
      'the import scan found no `react`, so the specifier extraction is broken ' +
        'and the dev-tree assertion below would pass vacuously.',
    ).toContain('react')
  })

  it('declares every package shipped code imports in `dependencies`', () => {
    const audited = auditSteps.some((step) =>
      /--omit=dev\b/.test(step.run as string),
    )
    expect(
      audited,
      'this assertion exists because the required audit runs with `--omit=dev`; ' +
        'if that scope changed, revisit the reasoning rather than dropping it.',
    ).toBe(true)

    const misplaced = [...imports.entries()]
      .filter(([name]) => !(name in dependencies))
      .map(([name, files]) => {
        const where = name in devDependencies ? 'devDependencies' : 'undeclared'
        return `${name} (${where}) imported by ${files.slice(0, 3).join(', ')}`
      })

    expect(
      misplaced,
      'these packages are bundled into the shipped app but are outside ' +
        '`dependencies`, so `npm audit --omit=dev` can never see an advisory ' +
        'against them. Move each into `dependencies` (or, if the importing ' +
        'file is test-only, name it `*.test.ts`).',
    ).toEqual([])
  })
})
