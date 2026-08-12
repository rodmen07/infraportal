#!/usr/bin/env node
/**
 * sync-api-specs.mjs
 *
 * Reads the 11 canonical OpenAPI YAML specs and emits deterministic JSON
 * snapshots into src/api-specs/, plus a small manifest.json the site uses for
 * its service selector and derived counts. Converting to JSON at sync time
 * means no YAML parser ever ships in the browser bundle; the snapshots are
 * committed so the site builds offline.
 *
 * Usage:
 *   npm run sync-specs                                       # local sibling checkout
 *   MICROSERVICES_DIR=../somewhere npm run sync-specs
 *   node ./scripts/sync-api-specs.mjs /path/to/microservices
 *   npm run sync-specs -- --source remote                    # fetch from GitHub at main
 *   npm run sync-specs -- --source remote --ref <sha-or-branch>
 *
 * Remote mode takes the SAME flags as `npm run check-spec-drift`, because both
 * scripts read scripts/lib/specSources.mjs -- see that module for where each
 * source comes from and which environment variables set the defaults. It is
 * what makes the drift check's own advice executable: the checker reports drift
 * at a ref, and the resync runs at that same ref without a sibling checkout,
 * which also removes the hazard of committing a snapshot built from whatever
 * uncommitted or branch state a neighbouring working tree happened to carry.
 *
 * Tooling is pinned: the YAML parser is the exact-pinned `yaml` devDependency
 * in package.json. Output is deterministic (stable service order, 2-space
 * indent, trailing newline, no timestamps) so a re-run on an unchanged source
 * tree produces a byte-identical diff.
 *
 * The snapshot build itself lives in scripts/lib/specSnapshot.mjs, shared
 * with scripts/check-spec-drift.mjs so the CI drift check regenerates through
 * exactly this pipeline.
 *
 * Exit codes:
 *   0  snapshots written
 *   1  operational failure (source unavailable, fetch error, invalid spec)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MANIFEST_FILE_NAME, buildSnapshotFiles, specFileName } from './lib/specSnapshot.mjs'
import { loadSpecSources } from './lib/specSources.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const outDir = join(repoRoot, 'src', 'api-specs')

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

let sources
let description
try {
  ;({ sources, description } = await loadSpecSources({
    repoRoot,
    argv: process.argv.slice(2),
    env: process.env,
  }))
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}

let build
try {
  build = buildSnapshotFiles(sources)
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}

mkdirSync(outDir, { recursive: true })

console.log(`source: ${description}`)

for (const service of build.services) {
  const fileName = specFileName(service.id)
  writeFileSync(join(outDir, fileName), build.files.get(fileName), 'utf8')
  console.log(`synced ${service.id}-service (${service.operationCount} operations) -> src/api-specs/${fileName}`)
}

writeFileSync(join(outDir, MANIFEST_FILE_NAME), build.files.get(MANIFEST_FILE_NAME), 'utf8')
console.log(`wrote manifest.json (${build.services.length} services, ${build.totalOperations} operations)`)
