/**
 * specSources.mjs
 *
 * Where the canonical OpenAPI specs come from. Shared by BOTH halves of the
 * spec pipeline:
 *
 *   - scripts/sync-api-specs.mjs   (regenerates the committed src/api-specs/)
 *   - scripts/check-spec-drift.mjs (regenerates into a temp dir and compares)
 *
 * Until 2026-08-12 only the CHECKER could read the specs over the network, so
 * the fix it printed on failure -- "run `npm run sync-specs` against an
 * up-to-date microservices checkout" -- was not executable by the CI runner
 * that printed it, and on a developer box it silently depended on whatever
 * state a sibling working tree happened to carry. Both scripts now take the
 * same flags and reach the same two sources, which is the point of this module:
 * a drift the checker reports at a ref is resyncable from that same ref.
 *
 * Sources
 * -------
 *
 *   --source local (default)
 *     Reads `<microservices>/<id>-service/openapi.yaml` from a checkout on
 *     disk: the positional argument, else $MICROSERVICES_DIR, else
 *     `../microservices` relative to this repo. Dev-machine mode.
 *
 *   --source remote [--ref <sha-or-branch>]
 *     Fetches the canonical spec files from the PUBLIC microservices repo:
 *
 *       https://raw.githubusercontent.com/rodmen07/microservices/<ref>/<id>-service/openapi.yaml
 *
 *     The ref defaults to `main`, the branch the committed snapshots are
 *     synced from. Pass a commit SHA to pin a resync to the exact point the
 *     checker reported drift at -- which is also what makes a resync safe
 *     while somebody else is pushing to that repo's `main`.
 *
 * Environment: $SPEC_DRIFT_SOURCE and $SPEC_DRIFT_REF are read as defaults for
 * the two flags. The names keep their `SPEC_DRIFT_` prefix because
 * .github/workflows/spec-drift.yml is an existing consumer; they govern both
 * scripts, not just the checker.
 *
 * Every source is refused if its body is blank. A zero-byte spec is the one
 * failure that would otherwise look like success: `parse('')` yields nothing to
 * validate, so the snapshot for that service would be built from an absence
 * rather than from a document.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SERVICE_IDS } from './specSnapshot.mjs'

/** Raw-content host for the public microservices repo. */
export const RAW_BASE = 'https://raw.githubusercontent.com/rodmen07/microservices'

/** Ref used by remote mode when neither --ref nor $SPEC_DRIFT_REF is given. */
export const DEFAULT_REF = 'main'

/**
 * Raised for every operational failure in this module (bad flags, missing
 * checkout, failed fetch, unusable body). Callers map it to their own exit
 * code so the scripts keep the exit contracts they already document.
 */
export class SpecSourceError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SpecSourceError'
  }
}

/**
 * Refuses a spec body that carries no document.
 *
 * An HTTP 200 with an empty body, or a truncated/empty file on disk, is not a
 * fetch failure and not a missing file: it is indistinguishable from a healthy
 * read everywhere except here. Downstream, `buildSnapshotFiles` would reject it
 * as "not an OpenAPI 3.x document", which is true but names the wrong cause and
 * sends the reader to the microservices repo to look for a spec that is fine.
 *
 * @param {string} text raw body
 * @param {string} label origin (path or URL) named in the error
 * @throws {SpecSourceError} when the body is empty or whitespace-only
 */
export function assertUsableSpecBody(text, label) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new SpecSourceError(
      `empty spec body from ${label} (${typeof text === 'string' ? text.length : 0} bytes, no document): ` +
        'refusing to build a snapshot from it',
    )
  }
}

/**
 * Parses the source-selection flags shared by both scripts.
 *
 * @param {string[]} argv argument list (already sliced past node + script)
 * @param {Record<string, string | undefined>} env environment defaults
 * @returns {{ source: 'local' | 'remote', ref: string, dir: string | undefined }}
 * @throws {SpecSourceError} on a missing value, an unknown flag, or a bad --source
 */
export function parseSourceArgs(argv = [], env = {}) {
  let source = env.SPEC_DRIFT_SOURCE ?? 'local'
  let ref = env.SPEC_DRIFT_REF ?? DEFAULT_REF
  let dir

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--source') {
      const value = argv[i + 1]
      if (value === undefined) throw new SpecSourceError('--source requires a value (local | remote)')
      source = value
      i += 1
    } else if (arg === '--ref') {
      const value = argv[i + 1]
      if (value === undefined) throw new SpecSourceError('--ref requires a value')
      ref = value
      i += 1
    } else if (arg.startsWith('--')) {
      throw new SpecSourceError(`unknown flag ${arg}`)
    } else {
      dir = arg
    }
  }

  if (source !== 'local' && source !== 'remote') {
    throw new SpecSourceError(`--source must be "local" or "remote", got "${source}"`)
  }

  return { source, ref, dir }
}

/**
 * Reads the specs from a microservices checkout on disk.
 *
 * @param {{ repoRoot: string, dir?: string, env?: Record<string, string | undefined>, serviceIds?: string[] }} options
 * @returns {{ sources: Array<{ id: string, text: string, label: string }>, description: string }}
 * @throws {SpecSourceError}
 */
export function loadLocalSources({ repoRoot, dir, env = {}, serviceIds = SERVICE_IDS } = {}) {
  const sourceRoot = resolve(dir ?? env.MICROSERVICES_DIR ?? join(repoRoot, '..', 'microservices'))

  if (!existsSync(sourceRoot)) {
    throw new SpecSourceError(
      `microservices checkout not found at ${sourceRoot}\n` +
        'Pass the path as an argument, set MICROSERVICES_DIR, or use --source remote --ref <sha-or-branch>.',
    )
  }

  const sources = []
  for (const id of serviceIds) {
    const yamlPath = join(sourceRoot, `${id}-service`, 'openapi.yaml')
    if (!existsSync(yamlPath)) {
      throw new SpecSourceError(`missing spec ${yamlPath}`)
    }
    const text = readFileSync(yamlPath, 'utf8')
    assertUsableSpecBody(text, yamlPath)
    sources.push({ id, text, label: yamlPath })
  }

  return { sources, description: `local sibling checkout at ${sourceRoot}` }
}

/**
 * Fetches the specs from the public microservices repo at a pinned ref.
 *
 * @param {{ ref?: string, serviceIds?: string[], fetchImpl?: typeof fetch }} options
 *   `fetchImpl` exists so the failure paths are drivable in tests; production
 *   callers leave it unset and get the global `fetch`.
 * @returns {Promise<{ sources: Array<{ id: string, text: string, label: string }>, description: string }>}
 * @throws {SpecSourceError}
 */
export async function loadRemoteSources({ ref = DEFAULT_REF, serviceIds = SERVICE_IDS, fetchImpl } = {}) {
  const doFetch = fetchImpl ?? fetch

  const sources = await Promise.all(
    serviceIds.map(async (id) => {
      const url = `${RAW_BASE}/${ref}/${id}-service/openapi.yaml`
      let response
      try {
        response = await doFetch(url)
      } catch (err) {
        throw new SpecSourceError(`fetch failed for ${url}: ${err instanceof Error ? err.message : err}`)
      }
      if (!response.ok) {
        throw new SpecSourceError(`fetch failed for ${url}: HTTP ${response.status}`)
      }
      const text = await response.text()
      assertUsableSpecBody(text, url)
      return { id, text, label: url }
    }),
  )

  return {
    sources,
    description: `public microservices repo (raw.githubusercontent.com) at ref "${ref}"`,
  }
}

/**
 * Parses the flags and loads from whichever source they select. This is the
 * single entry point both scripts call, so they cannot drift apart on which
 * sources exist or on what a flag means.
 *
 * @param {{ repoRoot: string, argv?: string[], env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} options
 * @returns {Promise<{ sources: Array<{ id: string, text: string, label: string }>, description: string, source: 'local' | 'remote', ref: string }>}
 * @throws {SpecSourceError}
 */
export async function loadSpecSources({ repoRoot, argv = [], env = {}, fetchImpl } = {}) {
  const { source, ref, dir } = parseSourceArgs(argv, env)

  const loaded =
    source === 'remote'
      ? await loadRemoteSources({ ref, fetchImpl })
      : loadLocalSources({ repoRoot, dir, env })

  return { ...loaded, source, ref }
}
