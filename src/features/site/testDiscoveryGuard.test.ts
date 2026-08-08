/**
 * Test-discovery gate guard (QA, COVERAGE-UNDERRUN-1, 2026-08-08).
 *
 * THE DEFECT THIS EXISTS FOR, observed once and never reproduced: a
 * `npm run test:coverage` run printed `Test Files  85 passed (85)` /
 * `Tests  2421 passed (2421)` and exited 0 while `src/**\/*.test.ts` held 95
 * files on disk and `vitest.config.ts`'s `include` was exactly
 * `['src/**\/*.test.ts']`. Ten files never ran. Nothing was reported failed,
 * skipped or todo. Four later runs of the identical command printed the full
 * 95, so the trigger is still unidentified (leading untested hypothesis:
 * machine contention -- that run was 2-6x slower than every later one, with
 * five concurrent wave lanes live).
 *
 * WHY THIS IS NOT "JUST A FLAKE". The under-run is invisible by construction:
 * a suite that reports 85/85 green is byte-identically shaped to a suite that
 * ran everything, which is the L-046 class exactly -- a tool's report about
 * files it never read reads the same as its report about files that were
 * clean. And in this repo that number is load-bearing evidence: every "existing
 * tests pass unchanged" measurement (L-042, L-065) in every PR body and run
 * report is derived from it, so an under-run does not merely hide a regression,
 * it forges the proof that none happened.
 *
 * WHY THE CHECK CANNOT LIVE INSIDE THE SUITE. A test file that was never loaded
 * cannot assert that it was never loaded, and no loaded test can see the
 * runner's file-discovery decision. The only vantage point is after the run,
 * against the runner's own enumeration of what it loaded (vitest's JSON
 * reporter writes one `testResults` entry per file), compared with the disk.
 * That comparison is `scripts/check-test-discovery.mjs`, wired into the
 * required `Unit Tests` job right after the suite; this file is the guard over
 * THAT gate, in the established shape of dependencyAuditGate.test.ts and
 * pagesDeployWorkflow.test.ts.
 *
 * WHAT IT DOES NOT CLAIM. It does not reproduce or explain the under-run, and
 * it does not count TESTS -- a file that ran with every case skipped still
 * reports as present. It converts a silent green into a loud red; the repro
 * half of COVERAGE-UNDERRUN-1 stays open.
 *
 * The five ways this gate could silently stop guarding, each locked below:
 *   1. the reporter flag is dropped from `test:coverage`, so no report is
 *      written and the check has nothing to read (contract F)
 *   2. the report path drifts between package.json, the module and .gitignore
 *      (contracts F, H)
 *   3. the report gets COMMITTED, so a stale file passes the check forever --
 *      the exact vacuous pass the gate exists to prevent (contract H)
 *   4. the workflow step is removed, neutered with `continue-on-error`, or
 *      reordered before the suite that produces its input (contract G)
 *   5. the include globs drift from `vitest.config.ts`, so the disk side counts
 *      a different file set than the runner was ever asked to run (contract A)
 *
 * Behaviour difference (L-001) is proven at the EXIT CODE, not at the helper:
 * contract C spawns the real CLI twice against one temp checkout, once with a
 * complete report (exit 0) and once with the same report minus one file (exit
 * 1, naming the file). That is the signal CI consumes, so it is the signal
 * asserted.
 */

import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import vitestConfig from '../../../vitest.config'
import {
  INCLUDE_GLOBS,
  MAX_REPORT_AGE_MS,
  STATUSES,
  TEST_REPORT_PATH,
  checkTestDiscovery,
  compareDiscovery,
  discoverTestFilesOnDisk,
  relativeToRoot,
  reportedTestFiles,
} from '../../../scripts/lib/testDiscovery.mjs'

const ROOT = process.cwd()
const CLI_PATH = path.join(ROOT, 'scripts', 'check-test-discovery.mjs')
const WORKFLOW_PATH = '.github/workflows/test.yml'
const PACKAGE_JSON_PATH = 'package.json'
const GITIGNORE_PATH = '.gitignore'

/**
 * Vacuity floor for the disk sweep (L-031). The repo had 95 test files when
 * this was written and the anomalous run reported 85; any figure that could
 * plausibly be reached by a broken glob returning a handful of matches must
 * fail, so the floor sits far below today's count and far above zero.
 */
const MIN_TEST_FILES = 40

interface WorkflowStep {
  name?: string
  run?: string
  uses?: string
  'continue-on-error'?: boolean
}

interface Workflow {
  jobs?: Record<string, { name?: string; steps?: WorkflowStep[] }>
}

interface PackageManifest {
  scripts?: Record<string, string>
}

const workflow = parse(readFileSync(path.join(ROOT, WORKFLOW_PATH), 'utf-8')) as Workflow
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, PACKAGE_JSON_PATH), 'utf-8'),
) as PackageManifest
const gitignore = readFileSync(path.join(ROOT, GITIGNORE_PATH), 'utf-8')

/** A throwaway checkout with `count` real test files and no report yet. */
function makeFixtureCheckout(count: number): { root: string; files: string[] } {
  const root = mkdtempSync(path.join(os.tmpdir(), 'infraportal-discovery-'))
  mkdirSync(path.join(root, 'src', 'nested'), { recursive: true })
  const files: string[] = []
  for (let i = 0; i < count; i += 1) {
    const relative = i % 2 === 0 ? `src/file${i}.test.ts` : `src/nested/file${i}.test.ts`
    writeFileSync(path.join(root, relative), 'export {}\n', 'utf-8')
    files.push(relative)
  }
  // A non-test file, so the disk sweep is proven to filter rather than to list
  // everything it walks past.
  writeFileSync(path.join(root, 'src', 'notATest.ts'), 'export {}\n', 'utf-8')
  return { root, files: files.sort() }
}

function writeReport(root: string, relativeFiles: string[], startTime = Date.now()): string {
  const reportPath = path.join(root, TEST_REPORT_PATH)
  writeFileSync(
    reportPath,
    JSON.stringify({
      startTime,
      success: true,
      numTotalTestSuites: relativeFiles.length * 4,
      testResults: relativeFiles.map((relative) => ({
        name: path.join(root, relative),
        status: 'passed',
        assertionResults: [],
      })),
    }),
    'utf-8',
  )
  return reportPath
}

function runCli(root: string, extraArgs: string[] = []) {
  const result = spawnSync(process.execPath, [CLI_PATH, '--root', root, ...extraArgs], {
    encoding: 'utf-8',
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

describe('test-discovery gate (COVERAGE-UNDERRUN-1)', () => {
  it('contract A: the disk sweep uses the globs vitest is actually configured to run', () => {
    const configured = vitestConfig.test?.include

    expect(
      configured,
      'vitest.config.ts declares no test.include, so nothing pins which files the ' +
        'runner is asked to load and the disk side of this gate has no counterpart',
    ).toBeDefined()

    // Two sources, both read (L-003). If include ever grows a second pattern
    // (a .test.tsx suite, a tests/ directory) and the module is not widened
    // with it, the gate would compare the full run against a partial disk set
    // and pass while blind to the new files.
    expect(
      [...(configured as string[])].sort(),
      'scripts/lib/testDiscovery.mjs INCLUDE_GLOBS has drifted from vitest.config.ts ' +
        "test.include; the gate would then measure a file set the runner was never asked to run",
    ).toEqual([...INCLUDE_GLOBS].sort())
  })

  it('contract B: the disk sweep really enumerates this repo, and refuses an empty match', () => {
    const onDisk = discoverTestFilesOnDisk(ROOT)

    expect(
      onDisk.length,
      `only ${onDisk.length} test files were discovered under ${ROOT}; a sweep this ` +
        'small means the glob broke, and every comparison built on it would pass vacuously',
    ).toBeGreaterThan(MIN_TEST_FILES)

    // Self-anchor: the file making the assertion must be inside the set it is
    // asserting about (L-031).
    expect(onDisk).toContain('src/features/site/testDiscoveryGuard.test.ts')
    expect(onDisk.every((file) => file.endsWith('.test.ts'))).toBe(true)

    // Zero matches is an error, never an empty set.
    expect(() => discoverTestFilesOnDisk(ROOT, ['src/**/*.no-such-suffix.ts'])).toThrow(
      /matched no files/,
    )
    expect(() => discoverTestFilesOnDisk(ROOT, [])).toThrow(/no include globs/)
  })

  it('contract C: the CLI exits 0 on a complete report and 1 on an under-run, naming the file', () => {
    const { root, files } = makeFixtureCheckout(6)
    try {
      // ON: every file on disk appears in the report.
      writeReport(root, files)
      const green = runCli(root)
      expect(green.status, `expected exit 0, got ${green.status}: ${green.stderr}`).toBe(0)
      expect(green.stdout).toContain('test discovery OK: 6/6 test files ran')

      // OFF: the same tree, the same command, one file missing from the report
      // -- which is what a 10-file under-run looks like at 1/6 scale.
      const dropped = files[files.length - 1]
      writeReport(root, files.slice(0, -1))
      const red = runCli(root)
      expect(red.status, 'an under-run must fail the job, not pass it').toBe(1)
      expect(red.stderr).toContain('test discovery FAILED (under-run)')
      expect(red.stderr).toContain('on disk: 6 files')
      expect(red.stderr).toContain('reported as run: 5 files')
      expect(red.stderr).toContain(dropped)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('contract D: a missing, unreadable, foreign or stale report fails as its own kind', () => {
    const { root, files } = makeFixtureCheckout(4)
    try {
      // No report at all: the reporter flag was dropped, or the suite died
      // before writing. Distinct from an under-run because the fix is different.
      expect(checkTestDiscovery({ root }).status).toBe('missing-report')

      // Present but not parseable, and present but not shaped like a report.
      writeFileSync(path.join(root, TEST_REPORT_PATH), '{ not json', 'utf-8')
      expect(checkTestDiscovery({ root }).status).toBe('unreadable-report')
      writeFileSync(path.join(root, TEST_REPORT_PATH), '{"startTime":1}', 'utf-8')
      expect(checkTestDiscovery({ root }).status).toBe('unreadable-report')

      // A report from a different checkout would otherwise look like a total
      // under-run and send the reader hunting for a runner bug.
      writeFileSync(
        path.join(root, TEST_REPORT_PATH),
        JSON.stringify({
          startTime: Date.now(),
          testResults: [{ name: '/somewhere/else/src/x.test.ts' }],
        }),
        'utf-8',
      )
      expect(checkTestDiscovery({ root }).status).toBe('foreign-report')

      // Yesterday's report, complete and green: the vacuous pass this gate must
      // not hand out.
      writeReport(root, files, Date.now() - MAX_REPORT_AGE_MS - 60_000)
      const stale = checkTestDiscovery({ root })
      expect(stale.status).toBe('stale-report')

      // The same complete report, fresh, is the passing case -- so the failure
      // above is attributable to age alone.
      writeReport(root, files)
      const fresh = checkTestDiscovery({ root })
      expect(fresh.status).toBe('ok')
      expect(fresh.onDiskCount).toBe(4)
      expect(fresh.reportedCount).toBe(4)

      // A report naming a file that is not on disk is its own disagreement.
      writeReport(root, [...files, 'src/ghost.test.ts'])
      expect(checkTestDiscovery({ root }).status).toBe('unexpected-files')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('contract E: file counting reads testResults, not numTotalTestSuites, and both path styles', () => {
    // Measured on this repo: two test files reported numTotalTestSuites: 8,
    // because that field counts describe blocks. Reading it here would have
    // compared describes against files and reddened permanently.
    const report = {
      startTime: Date.now(),
      numTotalTestSuites: 99,
      testResults: [
        { name: 'D:/repo/src/a.test.ts' },
        { name: 'D:\\repo\\src\\b.test.ts' },
        { name: 'D:/repo/src/a.test.ts' },
      ],
    }
    const { files, foreign } = reportedTestFiles(report, 'D:\\repo')
    expect(files).toEqual(['src/a.test.ts', 'src/b.test.ts'])
    expect(foreign).toEqual([])

    // The ubuntu runner writes POSIX absolute paths; the same code must reduce
    // them identically or the gate would report every file foreign in CI.
    expect(
      reportedTestFiles(
        { startTime: Date.now(), testResults: [{ name: '/home/runner/work/x/src/a.test.ts' }] },
        '/home/runner/work/x',
      ).files,
    ).toEqual(['src/a.test.ts'])

    expect(relativeToRoot('/elsewhere/src/a.test.ts', '/home/runner/work/x')).toBeNull()
    expect(() => reportedTestFiles({ testResults: 'nope' }, ROOT)).toThrow(/testResults/)
    expect(() => reportedTestFiles({ testResults: [{}] }, ROOT)).toThrow(/no name/)
  })

  it('contract F: package.json still produces the report this gate reads, and wires the CLI', () => {
    const coverage = manifest.scripts?.['test:coverage']
    expect(coverage, 'package.json has no test:coverage script').toBeTypeOf('string')

    // The gate is only as real as its input. A dropped --reporter=json turns
    // every future run into "missing-report", which is loud -- but a CHANGED
    // --outputFile path would be loud for the wrong reason, so both halves are
    // pinned to the one constant the checker defaults to.
    expect(coverage).toContain('--reporter=json')
    expect(coverage).toContain(`--outputFile.json=./${TEST_REPORT_PATH}`)
    expect(
      coverage,
      'the human-readable reporter must survive alongside the JSON one, or the ' +
        'suite output disappears from the CI log',
    ).toContain('--reporter=default')
    expect(coverage).toContain('--coverage')

    const check = manifest.scripts?.['check-test-discovery']
    expect(check).toBe('node ./scripts/check-test-discovery.mjs')
  })

  it('contract G: the required Unit Tests job runs the gate, unneutered, after the suite', () => {
    const job = workflow.jobs?.test
    expect(job?.name, 'the required context is named "Unit Tests"').toBe('Unit Tests')

    const steps = job?.steps ?? []
    expect(steps.length, 'the test job parsed with no steps').toBeGreaterThan(3)

    const suiteIndex = steps.findIndex((step) => step.run?.includes('npm run test:coverage'))
    const gateIndex = steps.findIndex((step) => step.run?.includes('npm run check-test-discovery'))

    expect(
      gateIndex,
      'no step in the required Unit Tests job runs npm run check-test-discovery, so an ' +
        'under-run is once again invisible',
    ).toBeGreaterThan(-1)
    expect(suiteIndex).toBeGreaterThan(-1)
    expect(
      gateIndex,
      'the discovery gate must run AFTER the suite: it reads the report that run writes, ' +
        'so ahead of it the check would read the previous run or nothing at all',
    ).toBeGreaterThan(suiteIndex)
    expect(
      steps[gateIndex]['continue-on-error'],
      'continue-on-error on the discovery gate makes it a log line rather than a gate ' +
        '(the pattern is already live one step below, on the codecov upload)',
    ).toBeUndefined()
    expect(steps[suiteIndex]['continue-on-error']).toBeUndefined()
  })

  it('contract H: the report is gitignored, so a committed one can never pass this check', () => {
    const ignored = gitignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))

    expect(
      ignored,
      `${TEST_REPORT_PATH} is not gitignored; a committed report would satisfy the gate ` +
        'on every run without any suite having produced it',
    ).toContain(TEST_REPORT_PATH)
  })

  it('contract I: the comparison never passes on an empty or absent reported set', () => {
    // L-049: a check that decides from an empty capture reports "nothing wrong"
    // and "nothing read" identically. Both directions of the set difference are
    // asserted so neither can be quietly dropped.
    const onDisk = ['src/a.test.ts', 'src/b.test.ts']
    expect(compareDiscovery({ onDisk, reported: [] })).toEqual({
      ok: false,
      missing: onDisk,
      unexpected: [],
    })
    expect(compareDiscovery({ onDisk, reported: onDisk })).toEqual({
      ok: true,
      missing: [],
      unexpected: [],
    })
    expect(compareDiscovery({ onDisk, reported: [...onDisk, 'src/c.test.ts'] })).toEqual({
      ok: false,
      missing: [],
      unexpected: ['src/c.test.ts'],
    })

    // Every status the module can return is enumerated, so a future kind cannot
    // be added without appearing here.
    expect([...STATUSES].sort()).toEqual([
      'foreign-report',
      'missing-report',
      'ok',
      'stale-report',
      'under-run',
      'unexpected-files',
      'unreadable-report',
    ])
  })
})
