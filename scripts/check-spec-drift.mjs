#!/usr/bin/env node
/**
 * check-spec-drift.mjs
 *
 * Cross-repo spec drift detection (v1.17.4). Regenerates the OpenAPI JSON
 * snapshots through the exact pipeline `npm run sync-specs` uses (shared
 * scripts/lib/specSnapshot.mjs), writes them to a temp directory, and
 * byte-compares them against the committed src/api-specs/ snapshots. Any
 * difference produces a per-file report and a nonzero exit.
 *
 * The comparison is over git-normalized content: CRLF collapses to LF before
 * comparing, because git stores these files with LF while a Windows working
 * tree with core.autocrlf materializes CRLF on checkout. On CI (LF checkout)
 * that normalization is a no-op and the comparison is byte-exact.
 *
 * The committed snapshot stays authoritative for the deployed site; this
 * check exists so drift in the microservices repo gets NOTICED here, with a
 * documented one-command fix that runs from the SAME source this check read:
 *
 *   npm run sync-specs -- --source remote --ref <the ref reported below>
 *   (then commit the diff)
 *
 * Where the source specs come from -- local checkout or the public repo over
 * HTTPS, and which flags and environment variables select between them -- is
 * documented once, in scripts/lib/specSources.mjs, and is shared verbatim with
 * sync-api-specs.mjs. GitHub Actions runners check out only this repo, which
 * is why CI passes `--source remote`.
 *
 * Usage:
 *   npm run check-spec-drift                          # local sibling checkout
 *   node ./scripts/check-spec-drift.mjs /path/to/microservices
 *   npm run check-spec-drift -- --source remote       # fetch from GitHub (CI)
 *   npm run check-spec-drift -- --source remote --ref <sha-or-branch>
 *
 * Exit codes:
 *   0  committed snapshots are byte-identical to a fresh regeneration
 *   1  drift detected (see the per-file report)
 *   2  operational failure (source unavailable, fetch error, invalid spec)
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSnapshotFiles, compareSnapshotDirs, formatComparisonReport } from './lib/specSnapshot.mjs'
import { loadSpecSources } from './lib/specSources.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const committedDir = join(repoRoot, 'src', 'api-specs')

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(2)
}

// ---------------------------------------------------------------------------
// Source loading (flags, environment and both sources live in specSources.mjs)
// ---------------------------------------------------------------------------

let sources
let description
let source
let ref
try {
  ;({ sources, description, source, ref } = await loadSpecSources({
    repoRoot,
    argv: process.argv.slice(2),
    env: process.env,
  }))
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let build
try {
  build = buildSnapshotFiles(sources)
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}

const freshDir = mkdtempSync(join(tmpdir(), 'spec-drift-'))

try {
  for (const [fileName, content] of build.files) {
    writeFileSync(join(freshDir, fileName), content, 'utf8')
  }

  const report = compareSnapshotDirs(freshDir, committedDir)

  console.log('spec drift check')
  console.log(`  source:      ${description}`)
  console.log(`  committed:   ${committedDir}`)
  console.log(`  regenerated: ${freshDir}`)
  console.log('')
  for (const line of formatComparisonReport(report)) {
    console.log(line)
  }

  if (!report.clean) {
    const resyncFlags = source === 'remote' ? ` -- --source remote --ref ${ref}` : ''
    console.log('')
    console.log('The committed snapshot stays authoritative for the deployed site until resynced.')
    console.log(`To resync: run \`npm run sync-specs${resyncFlags}\``)
    console.log('and commit the resulting diff under src/api-specs/.')
    process.exit(1)
  }
} finally {
  rmSync(freshDir, { recursive: true, force: true })
}
