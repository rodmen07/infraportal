#!/usr/bin/env node
/**
 * sync-api-specs.mjs
 *
 * Reads the 11 committed OpenAPI YAML specs from the sibling microservices
 * checkout and emits deterministic JSON snapshots into src/api-specs/, plus a
 * small manifest.json the site uses for its service selector and derived
 * counts. Converting to JSON at sync time means no YAML parser ever ships in
 * the browser bundle; the snapshots are committed so the site builds offline.
 *
 * Usage:
 *   npm run sync-specs
 *   MICROSERVICES_DIR=../somewhere npm run sync-specs
 *   node ./scripts/sync-api-specs.mjs /path/to/microservices
 *
 * Tooling is pinned: the YAML parser is the exact-pinned `yaml` devDependency
 * in package.json. Output is deterministic (stable service order, 2-space
 * indent, trailing newline, no timestamps) so a re-run on an unchanged source
 * tree produces a byte-identical diff.
 *
 * The snapshot build itself lives in scripts/lib/specSnapshot.mjs, shared
 * with scripts/check-spec-drift.mjs so the CI drift check regenerates through
 * exactly this pipeline.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MANIFEST_FILE_NAME,
  SERVICE_IDS,
  buildSnapshotFiles,
  specFileName,
} from './lib/specSnapshot.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const outDir = join(repoRoot, 'src', 'api-specs')

const sourceRoot = resolve(
  process.argv[2] ?? process.env.MICROSERVICES_DIR ?? join(repoRoot, '..', 'microservices'),
)

if (!existsSync(sourceRoot)) {
  console.error(`error: microservices checkout not found at ${sourceRoot}`)
  console.error('Pass the path as an argument or set MICROSERVICES_DIR.')
  process.exit(1)
}

const sources = []
for (const id of SERVICE_IDS) {
  const yamlPath = join(sourceRoot, `${id}-service`, 'openapi.yaml')
  if (!existsSync(yamlPath)) {
    console.error(`error: missing spec ${yamlPath}`)
    process.exit(1)
  }
  sources.push({ id, text: readFileSync(yamlPath, 'utf8'), label: yamlPath })
}

let build
try {
  build = buildSnapshotFiles(sources)
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : err}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

for (const service of build.services) {
  const fileName = specFileName(service.id)
  writeFileSync(join(outDir, fileName), build.files.get(fileName), 'utf8')
  console.log(`synced ${service.id}-service (${service.operationCount} operations) -> src/api-specs/${fileName}`)
}

writeFileSync(join(outDir, MANIFEST_FILE_NAME), build.files.get(MANIFEST_FILE_NAME), 'utf8')
console.log(`wrote manifest.json (${build.services.length} services, ${build.totalOperations} operations)`)
