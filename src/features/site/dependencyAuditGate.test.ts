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
 * Two ways that gate can silently stop guarding, and this file locks both:
 *
 *   1. the THRESHOLD drifts back up (or the step gets neutered with
 *      `continue-on-error` / `|| true`, the pattern already live one step
 *      below it on the codecov upload)
 *   2. the SCOPE stops covering what ships. `--omit=dev` is a deliberate
 *      decision documented in the workflow, but it means the gate audits
 *      exactly `package.json`'s `dependencies` and nothing else. A package
 *      that runtime `src/` imports while being declared in `devDependencies`
 *      is shipped in the bundle and invisible to the required check.
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
const TESTS_WORKFLOW_PATH = '.github/workflows/test.yml'
const PACKAGE_JSON_PATH = 'package.json'
const SRC_DIR = 'src'

interface WorkflowStep {
  name?: string
  run?: string
  'continue-on-error'?: boolean
}

interface WorkflowJob {
  steps?: WorkflowStep[]
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>
}

interface PackageManifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const workflow = parse(
  readFileSync(path.join(ROOT, TESTS_WORKFLOW_PATH), 'utf-8'),
) as Workflow

const manifest = JSON.parse(
  readFileSync(path.join(ROOT, PACKAGE_JSON_PATH), 'utf-8'),
) as PackageManifest

const STEPS: WorkflowStep[] = Object.values(workflow.jobs ?? {}).flatMap(
  (job) => job.steps ?? [],
)

const auditSteps = STEPS.filter(
  (step) => typeof step.run === 'string' && /\bnpm audit\b/.test(step.run),
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
  it('parses at least one npm audit step out of the tests workflow', () => {
    expect(
      auditSteps.length,
      `no \`npm audit\` step was parsed out of ${TESTS_WORKFLOW_PATH}; every ` +
        'assertion below would pass vacuously. If the audit moved to another ' +
        'workflow, point this guard at it rather than deleting it.',
    ).toBeGreaterThan(0)
  })

  it('declares an explicit --audit-level on every npm audit step', () => {
    const missing = auditSteps
      .filter((step) => auditLevelOf(step.run as string) === undefined)
      .map((step) => step.name ?? step.run)

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
      .map((step) => auditLevelOf(step.run as string) as string)
      .filter((level) => {
        const index = SEVERITY_ORDER.indexOf(
          level as (typeof SEVERITY_ORDER)[number],
        )
        return index === -1 || index > ceiling
      })

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
      return found.map((what) => `${step.name ?? 'audit step'}: ${what}`)
    })

    expect(
      neutered,
      'the audit step would still be present in the yaml and still be unable ' +
        'to block a merge. `continue-on-error: true` is already live one step ' +
        'below it (the codecov upload), so this is a copy-paste away.',
    ).toEqual([])
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
