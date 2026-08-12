/**
 * Unit tests for the spec source loader shared by npm run sync-specs and
 * npm run check-spec-drift (scripts/lib/specSources.mjs).
 *
 * Two things are under test and they fail in opposite directions:
 *
 *  1. The flags select a source. `--source remote` is only a real capability
 *     if a run carrying it reaches the network and a run without it does not,
 *     so every routing test asserts BOTH arms against the same stub.
 *
 *  2. Every failure is loud. A missing checkout, a 404 ref, a refused
 *     connection and an EMPTY 200 body are the four ways a source can fail to
 *     produce a document, and the last one is the dangerous one: it is not an
 *     error anywhere in the HTTP stack, so without an explicit refusal the
 *     pipeline would build a snapshot out of an absence.
 *
 * Each clause gets its own test case: one perturbation would otherwise stop
 * the run at the first assertion and the later clauses would never report.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SERVICE_IDS } from '../../scripts/lib/specSnapshot.mjs'
import {
  DEFAULT_REF,
  RAW_BASE,
  SpecSourceError,
  assertUsableSpecBody,
  loadLocalSources,
  loadRemoteSources,
  loadSpecSources,
  parseSourceArgs,
} from '../../scripts/lib/specSources.mjs'

const REPO_ROOT = '/repo-root-placeholder'

function specYaml(id: string): string {
  return [
    'openapi: 3.0.3',
    'info:',
    `  title: ${id}-service`,
    '  version: 1.0.0',
    `  description: The ${id} service. More detail here.`,
    'paths:',
    '  /health:',
    '    get:',
    '      operationId: health',
    '      responses:',
    "        '200':",
    '          description: ok',
    '',
  ].join('\n')
}

/** A checkout on disk carrying one openapi.yaml per service id. */
function makeCheckout(ids: string[] = SERVICE_IDS, body: (id: string) => string = specYaml): string {
  const root = mkdtempSync(join(tmpdir(), 'spec-sources-'))
  for (const id of ids) {
    mkdirSync(join(root, `${id}-service`), { recursive: true })
    writeFileSync(join(root, `${id}-service`, 'openapi.yaml'), body(id), 'utf8')
  }
  return root
}

/** Minimal Response-alike; only `ok`, `status` and `text()` are ever read. */
function response(body: string, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => body,
  }
}

/**
 * A fetch stub that records every URL it is asked for. The recording is what
 * makes the routing assertions two-sided: "the local arm never fetched" is a
 * claim about calls, not about output.
 */
function recordingFetch(handler: (url: string) => unknown = (url) => response(specYaml(url))) {
  const calls: string[] = []
  const impl = (async (input: unknown) => {
    const url = String(input)
    calls.push(url)
    return handler(url)
  }) as unknown as typeof fetch
  return { calls, impl }
}

const tempRoots: string[] = []

beforeEach(() => {
  tempRoots.length = 0
})

afterEach(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true })
})

function checkout(...args: Parameters<typeof makeCheckout>): string {
  const root = makeCheckout(...args)
  tempRoots.push(root)
  return root
}

describe('parseSourceArgs', () => {
  it('defaults to the local checkout at the default ref with no directory', () => {
    expect(parseSourceArgs([], {})).toEqual({ source: 'local', ref: DEFAULT_REF, dir: undefined })
  })

  it('reads --source remote', () => {
    expect(parseSourceArgs(['--source', 'remote'], {}).source).toBe('remote')
  })

  it('reads --ref and does not disturb the source', () => {
    const parsed = parseSourceArgs(['--source', 'remote', '--ref', 'abc123'], {})
    expect(parsed).toEqual({ source: 'remote', ref: 'abc123', dir: undefined })
  })

  it('keeps the positional checkout path alongside the flags', () => {
    expect(parseSourceArgs(['/path/to/microservices'], {}).dir).toBe('/path/to/microservices')
  })

  it('takes defaults from the environment the workflow already sets', () => {
    const parsed = parseSourceArgs([], { SPEC_DRIFT_SOURCE: 'remote', SPEC_DRIFT_REF: 'deadbee' })
    expect(parsed).toEqual({ source: 'remote', ref: 'deadbee', dir: undefined })
  })

  it('lets an explicit flag beat the environment default', () => {
    const parsed = parseSourceArgs(['--ref', 'from-flag'], { SPEC_DRIFT_REF: 'from-env' })
    expect(parsed.ref).toBe('from-flag')
  })

  it('refuses --source with no value instead of silently staying local', () => {
    expect(() => parseSourceArgs(['--source'], {})).toThrow(/--source requires a value/)
  })

  it('refuses --ref with no value instead of silently using main', () => {
    expect(() => parseSourceArgs(['--ref'], {})).toThrow(/--ref requires a value/)
  })

  it('refuses an unknown flag rather than treating it as a directory', () => {
    expect(() => parseSourceArgs(['--sorce', 'remote'], {})).toThrow(/unknown flag --sorce/)
  })

  it('refuses a source that is neither local nor remote', () => {
    expect(() => parseSourceArgs(['--source', 'github'], {})).toThrow(
      /--source must be "local" or "remote", got "github"/,
    )
  })
})

describe('assertUsableSpecBody', () => {
  it('accepts a real document', () => {
    expect(() => assertUsableSpecBody(specYaml('accounts'), 'accounts.yaml')).not.toThrow()
  })

  it('refuses an empty body and names its origin and byte count', () => {
    expect(() => assertUsableSpecBody('', 'https://example.test/accounts-service/openapi.yaml')).toThrow(
      /empty spec body from https:\/\/example\.test\/accounts-service\/openapi\.yaml \(0 bytes, no document\)/,
    )
  })

  it('refuses a whitespace-only body, which parses to nothing rather than failing', () => {
    expect(() => assertUsableSpecBody('\n \n', 'accounts.yaml')).toThrow(SpecSourceError)
  })
})

describe('loadLocalSources', () => {
  it('reads one non-empty source per service id from the checkout', () => {
    const root = checkout()
    const { sources } = loadLocalSources({ repoRoot: REPO_ROOT, dir: root })

    expect(sources).toHaveLength(SERVICE_IDS.length)
    expect(sources.map((s) => s.id)).toEqual(SERVICE_IDS)
    for (const source of sources) {
      expect(source.text.length).toBeGreaterThan(0)
      expect(source.label).toContain(`${source.id}-service`)
    }
  })

  it('names the checkout it looked in, so the description is not a guess', () => {
    const root = checkout()
    expect(loadLocalSources({ repoRoot: REPO_ROOT, dir: root }).description).toContain(root)
  })

  it('falls back to MICROSERVICES_DIR when no directory argument is given', () => {
    const root = checkout()
    const { sources } = loadLocalSources({ repoRoot: REPO_ROOT, env: { MICROSERVICES_DIR: root } })
    expect(sources).toHaveLength(SERVICE_IDS.length)
  })

  it('fails loudly on a checkout that is not there, and points at remote mode', () => {
    expect(() => loadLocalSources({ repoRoot: REPO_ROOT, dir: join(tmpdir(), 'no-such-checkout-xyz') })).toThrow(
      /microservices checkout not found at[\s\S]*--source remote --ref/,
    )
  })

  it('fails loudly on a checkout missing one spec rather than syncing a partial set', () => {
    const root = checkout(SERVICE_IDS.filter((id) => id !== 'spend'))
    expect(() => loadLocalSources({ repoRoot: REPO_ROOT, dir: root })).toThrow(/missing spec .*spend-service/)
  })

  it('refuses a spec file that exists but is empty', () => {
    const root = checkout(SERVICE_IDS, (id) => (id === 'search' ? '' : specYaml(id)))
    expect(() => loadLocalSources({ repoRoot: REPO_ROOT, dir: root })).toThrow(
      /empty spec body from .*search-service/,
    )
  })
})

describe('loadRemoteSources', () => {
  it('fetches one raw URL per service at the requested ref', async () => {
    const { calls, impl } = recordingFetch((url) => response(specYaml(url)))
    await loadRemoteSources({ ref: 'abc123', fetchImpl: impl })

    expect(calls).toHaveLength(SERVICE_IDS.length)
    for (const id of SERVICE_IDS) {
      expect(calls).toContain(`${RAW_BASE}/abc123/${id}-service/openapi.yaml`)
    }
  })

  it('defaults to the main ref when none is given', async () => {
    const { calls, impl } = recordingFetch()
    await loadRemoteSources({ fetchImpl: impl })
    expect(calls[0]).toBe(`${RAW_BASE}/${DEFAULT_REF}/accounts-service/openapi.yaml`)
  })

  it('reports the ref it actually read, so a resync can be pinned to it', async () => {
    const { impl } = recordingFetch()
    const { description } = await loadRemoteSources({ ref: 'abc123', fetchImpl: impl })
    expect(description).toContain('abc123')
  })

  it('fails loudly on an unreachable ref instead of emitting a partial snapshot', async () => {
    const { impl } = recordingFetch((url) =>
      url.includes('spend-service') ? response('404: Not Found', { ok: false, status: 404 }) : response(specYaml(url)),
    )
    await expect(loadRemoteSources({ ref: 'no-such-ref', fetchImpl: impl })).rejects.toThrow(
      /fetch failed for .*spend-service\/openapi\.yaml: HTTP 404/,
    )
  })

  it('fails loudly when the connection itself fails', async () => {
    const { impl } = recordingFetch(() => {
      throw new Error('getaddrinfo ENOTFOUND raw.githubusercontent.com')
    })
    await expect(loadRemoteSources({ fetchImpl: impl })).rejects.toThrow(
      /fetch failed for .*: getaddrinfo ENOTFOUND/,
    )
  })

  it('refuses an HTTP 200 carrying an empty body, which no status code reports', async () => {
    const { impl } = recordingFetch((url) => (url.includes('audit-service') ? response('') : response(specYaml(url))))
    await expect(loadRemoteSources({ ref: 'abc123', fetchImpl: impl })).rejects.toThrow(
      /empty spec body from .*audit-service\/openapi\.yaml \(0 bytes, no document\)/,
    )
  })

  it('raises SpecSourceError for every failure, so callers map one type to their exit code', async () => {
    const { impl } = recordingFetch(() => response('', { ok: false, status: 500 }))
    await expect(loadRemoteSources({ fetchImpl: impl })).rejects.toBeInstanceOf(SpecSourceError)
  })

  it('names the FIRST failing service in id order, not whichever request lost the race', async () => {
    // `accounts` is first in SERVICE_IDS and `spend` is last. Resolving spend's
    // rejection sooner must not change which one the message names.
    const slowFirst = (url: string) =>
      url.includes('accounts-service')
        ? new Promise((resolve) => setTimeout(() => resolve(response('nope', { ok: false, status: 404 })), 25))
        : url.includes('spend-service')
          ? response('nope', { ok: false, status: 404 })
          : response(specYaml(url))
    const { impl } = recordingFetch(slowFirst)

    await expect(loadRemoteSources({ ref: 'abc123', fetchImpl: impl })).rejects.toThrow(
      /fetch failed for .*accounts-service\/openapi\.yaml: HTTP 404/,
    )
  })

  it('settles every request before rejecting, so nothing is still in flight at exit', async () => {
    // The crash this guards against is a process.exit() on a live event loop:
    // Promise.all rejects with ten sockets still open. Observable here as every
    // request having been both issued and completed by the time we see the
    // rejection.
    let completed = 0
    const { calls, impl } = recordingFetch(async (url) => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      completed += 1
      return url.includes('audit-service') ? response('nope', { ok: false, status: 404 }) : response(specYaml(url))
    })

    await expect(loadRemoteSources({ fetchImpl: impl })).rejects.toThrow(/HTTP 404/)
    expect(calls).toHaveLength(SERVICE_IDS.length)
    expect(completed).toBe(SERVICE_IDS.length)
  })
})

describe('loadSpecSources routing', () => {
  it('--source remote reaches the network at the requested ref', async () => {
    const { calls, impl } = recordingFetch()
    const loaded = await loadSpecSources({
      repoRoot: REPO_ROOT,
      argv: ['--source', 'remote', '--ref', 'abc123'],
      fetchImpl: impl,
    })

    expect(loaded.source).toBe('remote')
    expect(loaded.ref).toBe('abc123')
    expect(calls).toHaveLength(SERVICE_IDS.length)
    expect(loaded.sources).toHaveLength(SERVICE_IDS.length)
  })

  it('the default (local) run never reaches the network, which is the other half of the same claim', async () => {
    const root = checkout()
    const { calls, impl } = recordingFetch()
    const loaded = await loadSpecSources({ repoRoot: REPO_ROOT, argv: [root], fetchImpl: impl })

    expect(loaded.source).toBe('local')
    expect(calls).toEqual([])
    expect(loaded.sources).toHaveLength(SERVICE_IDS.length)
  })

  it('both sources yield the same ids in the same order, which is what makes the two paths comparable', async () => {
    const root = checkout()
    const local = await loadSpecSources({ repoRoot: REPO_ROOT, argv: [root] })
    const { impl } = recordingFetch()
    const remote = await loadSpecSources({
      repoRoot: REPO_ROOT,
      argv: ['--source', 'remote', '--ref', 'abc123'],
      fetchImpl: impl,
    })

    // Assert the selection, not only the sameness: two EMPTY source lists
    // would also be "identical", and that is the shape this pair must not pass.
    expect(local.sources.length).toBe(SERVICE_IDS.length)
    expect(remote.sources.length).toBe(SERVICE_IDS.length)
    expect(remote.sources.map((s) => s.id)).toEqual(local.sources.map((s) => s.id))
  })

  it('propagates a flag error rather than falling back to a default source', async () => {
    const { calls, impl } = recordingFetch()
    await expect(
      loadSpecSources({ repoRoot: REPO_ROOT, argv: ['--source', 'gitlab'], fetchImpl: impl }),
    ).rejects.toThrow(/--source must be "local" or "remote"/)
    expect(calls).toEqual([])
  })
})
