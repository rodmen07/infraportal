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
 * documented one-command fix:
 *
 *   npm run sync-specs      # regenerate src/api-specs/ from the source specs
 *   (then commit the diff)
 *
 * Where the source specs come from:
 *
 *   --source local (default)
 *     Reads `<microservices>/<id>-service/openapi.yaml` from the sibling
 *     checkout on disk: the positional argument, else $MICROSERVICES_DIR,
 *     else `../microservices` relative to this repo. This is the dev-machine
 *     mode and matches sync-api-specs.mjs exactly.
 *
 *   --source remote
 *     CI mode. GitHub Actions runners check out only this repo; they have no
 *     sibling microservices checkout and cannot clone one without extra
 *     configuration. Instead of pretending otherwise, remote mode fetches the
 *     canonical spec files from the PUBLIC microservices repo over HTTPS:
 *
 *       https://raw.githubusercontent.com/rodmen07/microservices/<ref>/<id>-service/openapi.yaml
 *
 *     The ref is pinned by flag (--ref) or $SPEC_DRIFT_REF and defaults to
 *     `main`, the branch the committed snapshots are synced from. Pinning to
 *     main means the check answers exactly one question: "do the committed
 *     snapshots still match the canonical published specs?" A commit SHA or
 *     tag can be passed instead to compare against a frozen point.
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

import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SERVICE_IDS,
  buildSnapshotFiles,
  compareSnapshotDirs,
  formatComparisonReport,
} from './lib/specSnapshot.mjs'

const RAW_BASE = 'https://raw.githubusercontent.com/rodmen07/microservices'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const committedDir = join(repoRoot, 'src', 'api-specs')

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(2)
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
let source = process.env.SPEC_DRIFT_SOURCE ?? 'local'
let ref = process.env.SPEC_DRIFT_REF ?? 'main'
let localDirArg

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]
  if (arg === '--source') {
    source = args[++i] ?? fail('--source requires a value (local | remote)')
  } else if (arg === '--ref') {
    ref = args[++i] ?? fail('--ref requires a value')
  } else if (arg.startsWith('--')) {
    fail(`unknown flag ${arg}`)
  } else {
    localDirArg = arg
  }
}

if (source !== 'local' && source !== 'remote') {
  fail(`--source must be "local" or "remote", got "${source}"`)
}

// ---------------------------------------------------------------------------
// Source loading
// ---------------------------------------------------------------------------

function loadLocalSources() {
  const sourceRoot = resolve(
    localDirArg ?? process.env.MICROSERVICES_DIR ?? join(repoRoot, '..', 'microservices'),
  )
  if (!existsSync(sourceRoot)) {
    fail(
      `microservices checkout not found at ${sourceRoot}\n` +
        'Pass the path as an argument, set MICROSERVICES_DIR, or use --source remote.',
    )
  }
  const sources = []
  for (const id of SERVICE_IDS) {
    const yamlPath = join(sourceRoot, `${id}-service`, 'openapi.yaml')
    if (!existsSync(yamlPath)) {
      fail(`missing spec ${yamlPath}`)
    }
    sources.push({ id, text: readFileSync(yamlPath, 'utf8'), label: yamlPath })
  }
  return { sources, description: `local sibling checkout at ${sourceRoot}` }
}

async function loadRemoteSources() {
  const sources = await Promise.all(
    SERVICE_IDS.map(async (id) => {
      const url = `${RAW_BASE}/${ref}/${id}-service/openapi.yaml`
      let response
      try {
        response = await fetch(url)
      } catch (err) {
        fail(`fetch failed for ${url}: ${err instanceof Error ? err.message : err}`)
      }
      if (!response.ok) {
        fail(`fetch failed for ${url}: HTTP ${response.status}`)
      }
      return { id, text: await response.text(), label: url }
    }),
  )
  return { sources, description: `public microservices repo (raw.githubusercontent.com) at ref "${ref}"` }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { sources, description } = source === 'remote' ? await loadRemoteSources() : loadLocalSources()

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
    console.log('')
    console.log('The committed snapshot stays authoritative for the deployed site until resynced.')
    console.log('To resync: run `npm run sync-specs` against an up-to-date microservices checkout')
    console.log('and commit the resulting diff under src/api-specs/.')
    process.exit(1)
  }
} finally {
  rmSync(freshDir, { recursive: true, force: true })
}
