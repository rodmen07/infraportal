#!/usr/bin/env node
/**
 * check-test-discovery.mjs
 *
 * The CI gate for COVERAGE-UNDERRUN-1: compares the test files vitest actually
 * RAN (its JSON report, one entry per file) against the test files that exist
 * on disk, and exits nonzero if the runner silently skipped any.
 *
 * Runs immediately after `npm run test:coverage` in .github/workflows/test.yml.
 * The ordering is the point: a suite that under-runs exits 0 with a green
 * summary, so the only place this can be caught is outside the runner, after
 * it has finished, against its own enumeration of what it loaded.
 *
 * Usage:
 *   node ./scripts/check-test-discovery.mjs [options]
 *
 * Options:
 *   --report <path>      JSON report to read (default: test-report.json)
 *   --root <path>        repo root the report is compared against (default: cwd)
 *   --max-age-ms <n>     reject a report older than this (default: 3600000)
 *   --quiet              print only on failure
 *
 * Exit codes: 0 every file on disk ran; 1 anything else, with the reason and
 * the offending file list on stderr. All comparison logic lives in
 * scripts/lib/testDiscovery.mjs so the guard test can drive every refusal kind
 * without spawning a process, and spawn this CLI when the exit code itself is
 * what is being asserted.
 */
import process from 'node:process'
import {
  MAX_REPORT_AGE_MS,
  TEST_REPORT_PATH,
  checkTestDiscovery,
  formatResult,
} from './lib/testDiscovery.mjs'

function parseArgs(argv) {
  const options = {
    reportPath: TEST_REPORT_PATH,
    root: process.cwd(),
    maxAgeMs: MAX_REPORT_AGE_MS,
    quiet: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--quiet') options.quiet = true
    else if (arg === '--report') options.reportPath = argv[++i]
    else if (arg === '--root') options.root = argv[++i]
    else if (arg === '--max-age-ms') options.maxAgeMs = Number(argv[++i])
    else {
      console.error(`check-test-discovery: unknown argument ${arg}`)
      process.exit(2)
    }
  }
  if (!Number.isFinite(options.maxAgeMs) || options.maxAgeMs < 0) {
    console.error('check-test-discovery: --max-age-ms must be a non-negative number')
    process.exit(2)
  }
  return options
}

const options = parseArgs(process.argv.slice(2))

let result
try {
  result = checkTestDiscovery(options)
} catch (error) {
  // Discovery itself failed (a glob that matches nothing, an unreadable tree).
  // That is a hard failure by design: an empty disk set would make every
  // comparison below pass vacuously.
  console.error(`check-test-discovery: ${error.message}`)
  process.exit(1)
}

const rendered = formatResult(result)
if (result.status === 'ok') {
  if (!options.quiet) console.log(rendered)
  process.exit(0)
}

console.error(rendered)
process.exit(1)
