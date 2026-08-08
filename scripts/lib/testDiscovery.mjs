/**
 * testDiscovery.mjs — did every test file on disk actually RUN?
 *
 * COVERAGE-UNDERRUN-1, observed once on 2026-08-08: `npm run test:coverage`
 * printed `Test Files  85 passed (85)` / `Tests  2421 passed (2421)` and exited
 * 0, while `src/**\/*.test.ts` held 95 files and `vitest.config.ts`'s `include`
 * was (and still is) exactly `['src/**\/*.test.ts']`. Ten files never ran.
 * Nothing was reported failed, skipped or todo — the ONLY visible symptom was a
 * number in a summary line that nothing compares against anything.
 *
 * That is the L-046 shape at its purest: a tool's report about files it never
 * read is byte-identical to its report about files that were clean. It matters
 * beyond one flake because every "existing tests pass unchanged" measurement in
 * this repo (L-042, L-065) is derived from exactly that number, so an under-run
 * does not merely hide a regression, it silently forges the evidence that no
 * regression happened.
 *
 * The mechanism this module implements is deliberately OUTSIDE the runner: a
 * test cannot observe how many files the runner chose to load, so no in-suite
 * assertion can catch an under-run. Vitest's JSON reporter enumerates one entry
 * per file it actually ran; comparing that enumeration against the disk is the
 * whole check.
 *
 * Two things it does NOT do, stated so they are not mistaken for coverage:
 *   - it does not explain the under-run. The trigger is still unidentified (the
 *     leading untested hypothesis is machine contention). This turns a silent
 *     green into a loud red; it does not reproduce anything.
 *   - it does not count TESTS, only FILES. A file that ran with half its cases
 *     skipped still reports as present here.
 *
 * Refusal kinds are kept distinct rather than collapsed into one boolean
 * (L-053): "the reporter never wrote a report" and "the report is ten files
 * short" have different causes and different fixes, and a check that cannot
 * tell them apart sends the reader to the wrong place. `unreadable`, `foreign`
 * and `stale` exist for the same reason — each is a way a comparison could
 * otherwise pass VACUOUSLY, by reading nothing, by reading another checkout's
 * report, or by reading yesterday's.
 *
 * Consumers: scripts/check-test-discovery.mjs (the CI gate) and
 * src/features/site/testDiscoveryGuard.test.ts (the guard over this gate).
 * Lives under scripts/ rather than src/ because nothing in the app imports it
 * and src/features/site/dependencyAuditGate.test.ts treats every non-test file
 * under src/ as bundled.
 */
import { globSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Where `npm run test:coverage` writes vitest's JSON report. Repo-relative.
 * Mirrored in package.json's `--outputFile.json=` flag and in .gitignore; both
 * pairings are asserted by testDiscoveryGuard.test.ts, because a report path
 * that drifts turns this gate into a permanent "missing report" (loud) and a
 * report that gets COMMITTED turns it into a permanent stale pass (silent).
 */
export const TEST_REPORT_PATH = 'test-report.json'

/**
 * The globs vitest is configured to run. Mirrored from `vitest.config.ts`'s
 * `test.include` and locked to it by testDiscoveryGuard.test.ts, which imports
 * the real config object rather than re-reading this constant. A `.mjs` module
 * cannot import a `.ts` config, so the two-source drift guard lives on the
 * vitest side where the TypeScript loader already exists.
 */
export const INCLUDE_GLOBS = ['src/**/*.test.ts']

/**
 * How old the report may be before it stops counting as evidence about THIS
 * run. In CI the gate runs seconds after the suite, so any value above a couple
 * of minutes is equivalent; the bound exists for local runs, where an aborted
 * suite can leave last week's report lying next to a passing check.
 */
export const MAX_REPORT_AGE_MS = 60 * 60 * 1000

/** Every status this check can return. `ok` is the only passing one. */
export const STATUSES = Object.freeze([
  'ok',
  'missing-report',
  'unreadable-report',
  'foreign-report',
  'stale-report',
  'under-run',
  'unexpected-files',
])

function toPosix(p) {
  return String(p).replace(/\\/g, '/')
}

/**
 * Repo-relative POSIX path, or null when `absPath` is not inside `root`.
 *
 * Both halves are normalised because the two sides genuinely differ by platform
 * and this is the cross-platform seam: on Windows `process.cwd()` yields
 * `D:\Projects\...` while vitest's JSON reporter writes `D:/Projects/...`, and
 * on the ubuntu CI runner both are already POSIX. The drive letter is compared
 * case-insensitively for the same reason.
 */
export function relativeToRoot(absPath, root) {
  const file = toPosix(absPath)
  const base = toPosix(root).replace(/\/+$/, '')
  if (!base) return null
  const prefix = `${base}/`
  if (file.toLowerCase().startsWith(prefix.toLowerCase())) {
    return file.slice(prefix.length)
  }
  return null
}

/**
 * Every test file on disk, glob-discovered and sorted (L-031).
 *
 * A zero-match result is a hard failure, never an empty set: "no test files
 * exist" and "the glob stopped matching" are indistinguishable downstream, and
 * the second one would make every comparison below pass vacuously.
 */
export function discoverTestFilesOnDisk(root, globs = INCLUDE_GLOBS) {
  if (!Array.isArray(globs) || globs.length === 0) {
    throw new Error('discoverTestFilesOnDisk: no include globs given')
  }
  const matches = globSync(globs, { cwd: root })
    .map(toPosix)
    .filter((file) => {
      try {
        return statSync(path.join(root, file)).isFile()
      } catch {
        return false
      }
    })
  const unique = [...new Set(matches)].sort()
  if (unique.length === 0) {
    throw new Error(
      `discoverTestFilesOnDisk: ${globs.join(', ')} matched no files under ${root} — ` +
        'refusing to compare against an empty disk set',
    )
  }
  return unique
}

/**
 * The files a vitest JSON report says it actually ran, repo-relative and
 * sorted, plus any entry pointing outside `root`.
 *
 * `testResults.length` is the file count. `numTotalTestSuites` is NOT: it
 * counts `describe` blocks (measured on this repo — two files reported
 * `numTotalTestSuites: 8`), so reading it here would have compared describes
 * against files and reddened permanently.
 */
export function reportedTestFiles(report, root) {
  const results = report?.testResults
  if (!Array.isArray(results)) {
    throw new Error('reportedTestFiles: report has no testResults array')
  }
  const files = []
  const foreign = []
  for (const entry of results) {
    const name = entry?.name
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('reportedTestFiles: a testResults entry has no name')
    }
    const relative = relativeToRoot(name, root)
    if (relative === null) foreign.push(toPosix(name))
    else files.push(relative)
  }
  return { files: [...new Set(files)].sort(), foreign: foreign.sort() }
}

/**
 * Set difference both ways. `missing` is the defect this module exists for:
 * files that exist on disk and are absent from the report.
 */
export function compareDiscovery({ onDisk, reported }) {
  const reportedSet = new Set(reported)
  const diskSet = new Set(onDisk)
  const missing = onDisk.filter((file) => !reportedSet.has(file))
  const unexpected = reported.filter((file) => !diskSet.has(file))
  return { ok: missing.length === 0 && unexpected.length === 0, missing, unexpected }
}

/**
 * The whole check, as data. The CLI turns this into an exit code and the guard
 * test asserts on it directly.
 *
 * Every argument is explicit — root, report path, clock, age bound — so the
 * guard can drive each refusal kind from a fixture instead of from ambient
 * process state (L-062).
 */
export function checkTestDiscovery({
  root,
  reportPath = TEST_REPORT_PATH,
  now = Date.now(),
  maxAgeMs = MAX_REPORT_AGE_MS,
  globs = INCLUDE_GLOBS,
} = {}) {
  const absoluteReport = path.isAbsolute(reportPath) ? reportPath : path.join(root, reportPath)
  const onDisk = discoverTestFilesOnDisk(root, globs)

  let raw
  try {
    raw = readFileSync(absoluteReport, 'utf-8')
  } catch {
    return {
      status: 'missing-report',
      onDiskCount: onDisk.length,
      reportedCount: 0,
      missing: onDisk,
      unexpected: [],
      foreign: [],
      reportPath: toPosix(reportPath),
    }
  }

  let report
  try {
    report = JSON.parse(raw)
  } catch (error) {
    return {
      status: 'unreadable-report',
      onDiskCount: onDisk.length,
      reportedCount: 0,
      missing: onDisk,
      unexpected: [],
      foreign: [],
      reportPath: toPosix(reportPath),
      detail: `not valid JSON: ${error.message}`,
    }
  }

  let reported
  try {
    reported = reportedTestFiles(report, root)
  } catch (error) {
    return {
      status: 'unreadable-report',
      onDiskCount: onDisk.length,
      reportedCount: 0,
      missing: onDisk,
      unexpected: [],
      foreign: [],
      reportPath: toPosix(reportPath),
      detail: error.message,
    }
  }

  const base = {
    onDiskCount: onDisk.length,
    reportedCount: reported.files.length,
    reportPath: toPosix(reportPath),
  }

  if (reported.foreign.length > 0) {
    return {
      ...base,
      status: 'foreign-report',
      missing: onDisk,
      unexpected: [],
      foreign: reported.foreign,
      detail: `report describes files outside ${toPosix(root)}`,
    }
  }

  const startTime = report?.startTime
  if (typeof startTime !== 'number' || !Number.isFinite(startTime)) {
    return {
      ...base,
      status: 'unreadable-report',
      missing: onDisk,
      unexpected: [],
      foreign: [],
      detail: 'report has no numeric startTime, so its freshness cannot be established',
    }
  }

  const ageMs = now - startTime
  if (ageMs > maxAgeMs) {
    return {
      ...base,
      status: 'stale-report',
      missing: [],
      unexpected: [],
      foreign: [],
      ageMs,
      detail: `report started ${Math.round(ageMs / 1000)}s ago, bound is ${Math.round(maxAgeMs / 1000)}s`,
    }
  }

  const diff = compareDiscovery({ onDisk, reported: reported.files })
  if (diff.missing.length > 0) {
    return { ...base, status: 'under-run', ...diff, foreign: [], ageMs }
  }
  if (diff.unexpected.length > 0) {
    return { ...base, status: 'unexpected-files', ...diff, foreign: [], ageMs }
  }
  return { ...base, status: 'ok', missing: [], unexpected: [], foreign: [], ageMs }
}

const REMEDIES = {
  'missing-report': [
    'vitest never wrote its JSON report, so nothing proves any file ran.',
    'Expected package.json\'s "test:coverage" to pass --reporter=json --outputFile.json.',
  ],
  'unreadable-report': [
    'The JSON report exists but cannot be trusted as an enumeration of what ran.',
  ],
  'foreign-report': [
    'The JSON report names files outside this checkout: it is not evidence about this run.',
  ],
  'stale-report': [
    'The JSON report predates this run; a stale report would pass this check vacuously.',
    'Re-run "npm run test:coverage" and check again.',
  ],
  'under-run': [
    'COVERAGE-UNDERRUN-1: the suite reported success while these files never ran.',
    'Every test-count claim derived from that run is void. Re-run before trusting it.',
  ],
  'unexpected-files': [
    'The report names test files that are not on disk — the report and the tree disagree.',
  ],
}

/** Human-readable rendering of a result, used by the CLI and asserted on. */
export function formatResult(result) {
  const lines = []
  if (result.status === 'ok') {
    lines.push(
      `test discovery OK: ${result.reportedCount}/${result.onDiskCount} test files ran ` +
        `(report ${result.reportPath})`,
    )
    return lines.join('\n')
  }
  lines.push(`test discovery FAILED (${result.status})`)
  lines.push(`  on disk: ${result.onDiskCount} files`)
  lines.push(`  reported as run: ${result.reportedCount} files`)
  if (result.detail) lines.push(`  detail: ${result.detail}`)
  for (const remedy of REMEDIES[result.status] ?? []) lines.push(`  ${remedy}`)
  if (result.missing?.length) {
    lines.push(`  never ran (${result.missing.length}):`)
    for (const file of result.missing) lines.push(`    - ${file}`)
  }
  if (result.unexpected?.length) {
    lines.push(`  reported but absent from disk (${result.unexpected.length}):`)
    for (const file of result.unexpected) lines.push(`    - ${file}`)
  }
  if (result.foreign?.length) {
    lines.push(`  outside this checkout (${result.foreign.length}):`)
    for (const file of result.foreign) lines.push(`    - ${file}`)
  }
  return lines.join('\n')
}
