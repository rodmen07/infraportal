/**
 * Unit tests for the spec snapshot pipeline shared by npm run sync-specs and
 * npm run check-spec-drift (scripts/lib/specSnapshot.mjs): deterministic
 * snapshot builds, and the byte-compare that powers cross-repo drift
 * detection, exercised against real fixture directories on disk.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  MANIFEST_FILE_NAME,
  MANIFEST_NOTE,
  SERVICE_IDS,
  buildSnapshotFiles,
  compareSnapshotDirs,
  formatComparisonReport,
  specFileName,
  type SnapshotBuild,
} from '../../scripts/lib/specSnapshot.mjs'

function specYaml(title: string, description = `${title} does things. More detail here.`): string {
  return [
    'openapi: 3.0.3',
    'info:',
    `  title: ${title}`,
    '  version: 1.0.0',
    `  description: ${description}`,
    'tags:',
    '  - name: Health',
    '  - name: Things',
    'paths:',
    '  /health:',
    '    get:',
    '      operationId: health',
    '      responses:',
    "        '200':",
    '          description: ok',
    '  /api/v1/things:',
    '    parameters: []',
    '    get:',
    '      operationId: listThings',
    '      responses:',
    "        '200':",
    '          description: ok',
    '    post:',
    '      operationId: createThing',
    '      responses:',
    "        '201':",
    '          description: created',
    '',
  ].join('\n')
}

describe('buildSnapshotFiles', () => {
  it('emits one JSON file per service plus a manifest, with the expected shape', () => {
    const build = buildSnapshotFiles([
      { id: 'accounts', text: specYaml('accounts-service API') },
      { id: 'contacts', text: specYaml('contacts-service API') },
    ])

    expect([...build.files.keys()]).toEqual([
      'accounts-service.json',
      'contacts-service.json',
      MANIFEST_FILE_NAME,
    ])

    const manifest = JSON.parse(build.files.get(MANIFEST_FILE_NAME)!)
    expect(manifest.note).toBe(MANIFEST_NOTE)
    expect(manifest.openapiVersion).toBe('3.0.3')
    expect(manifest.services).toHaveLength(2)
    expect(manifest.services[0]).toEqual({
      id: 'accounts',
      name: 'Accounts',
      title: 'accounts-service API',
      version: '1.0.0',
      summary: 'accounts-service API does things.',
      operationCount: 3,
      tags: ['Health', 'Things'],
    })
    expect(build.totalOperations).toBe(6)
  })

  it('counts only HTTP methods as operations (path-level keys ignored)', () => {
    const build = buildSnapshotFiles([{ id: 'accounts', text: specYaml('a') }])
    // /health get + /api/v1/things get+post; the path-level `parameters` key
    // must not count.
    expect(build.services[0].operationCount).toBe(3)
  })

  it('is deterministic: same sources produce byte-identical files', () => {
    const sources = [
      { id: 'accounts', text: specYaml('accounts-service API') },
      { id: 'contacts', text: specYaml('contacts-service API') },
    ]
    const first = buildSnapshotFiles(sources)
    const second = buildSnapshotFiles(sources)
    expect(Object.fromEntries(second.files)).toEqual(Object.fromEntries(first.files))
  })

  it('orders services canonically regardless of input order', () => {
    const build = buildSnapshotFiles([
      { id: 'contacts', text: specYaml('c') },
      { id: 'accounts', text: specYaml('a') },
    ])
    expect(build.services.map((s) => s.id)).toEqual(['accounts', 'contacts'])
  })

  it('rejects a document that is not OpenAPI 3.x, naming the source', () => {
    expect(() =>
      buildSnapshotFiles([{ id: 'accounts', text: 'swagger: "2.0"\n', label: 'somewhere/openapi.yaml' }]),
    ).toThrow('somewhere/openapi.yaml is not an OpenAPI 3.x document')
  })

  it('knows all 11 canonical service ids', () => {
    expect(SERVICE_IDS).toHaveLength(11)
    expect(specFileName(SERVICE_IDS[0])).toBe('accounts-service.json')
  })
})

describe('compareSnapshotDirs', () => {
  let freshDir: string
  let committedDir: string

  function writeSnapshot(dir: string, build: SnapshotBuild): void {
    for (const [name, content] of build.files) {
      writeFileSync(join(dir, name), content, 'utf8')
    }
  }

  function makeBuild(overrides: Partial<Record<string, string>> = {}): SnapshotBuild {
    return buildSnapshotFiles([
      { id: 'accounts', text: overrides.accounts ?? specYaml('accounts-service API') },
      { id: 'contacts', text: overrides.contacts ?? specYaml('contacts-service API') },
    ])
  }

  beforeEach(() => {
    freshDir = mkdtempSync(join(tmpdir(), 'spec-drift-fresh-'))
    committedDir = mkdtempSync(join(tmpdir(), 'spec-drift-committed-'))
  })

  afterEach(() => {
    rmSync(freshDir, { recursive: true, force: true })
    rmSync(committedDir, { recursive: true, force: true })
  })

  it('reports clean when both dirs are byte-identical', () => {
    const build = makeBuild()
    writeSnapshot(freshDir, build)
    writeSnapshot(committedDir, build)

    const report = compareSnapshotDirs(freshDir, committedDir)
    expect(report.clean).toBe(true)
    expect(report.entries.map((e) => e.file)).toEqual([
      'accounts-service.json',
      'contacts-service.json',
      'manifest.json',
    ])
    for (const entry of report.entries) {
      expect(entry.status).toBe('match')
      expect(entry.freshBytes).toBeGreaterThan(0)
      expect(entry.committedBytes).toBe(entry.freshBytes)
    }
  })

  it('reports drift per file when committed bytes differ, with byte counts', () => {
    writeSnapshot(freshDir, makeBuild())
    writeSnapshot(committedDir, makeBuild({ contacts: specYaml('contacts-service API', 'Changed upstream. Yes.') }))

    const report = compareSnapshotDirs(freshDir, committedDir)
    expect(report.clean).toBe(false)

    const byFile = Object.fromEntries(report.entries.map((e) => [e.file, e]))
    expect(byFile['accounts-service.json'].status).toBe('match')
    // The changed description shows up in both the service snapshot and the
    // manifest summary.
    expect(byFile['contacts-service.json'].status).toBe('drift')
    expect(byFile['manifest.json'].status).toBe('drift')
    expect(byFile['contacts-service.json'].freshBytes).not.toBe(byFile['contacts-service.json'].committedBytes)
  })

  it('reports a regenerated file with no committed counterpart as missing', () => {
    writeSnapshot(freshDir, makeBuild())
    writeSnapshot(committedDir, makeBuild())
    rmSync(join(committedDir, 'contacts-service.json'))

    const report = compareSnapshotDirs(freshDir, committedDir)
    expect(report.clean).toBe(false)
    const entry = report.entries.find((e) => e.file === 'contacts-service.json')!
    expect(entry.status).toBe('missing')
    expect(entry.committedBytes).toBeNull()
    expect(entry.freshBytes).toBeGreaterThan(0)
  })

  it('reports a committed file no longer generated from source as stale', () => {
    writeSnapshot(freshDir, makeBuild())
    writeSnapshot(committedDir, makeBuild())
    writeFileSync(join(committedDir, 'retired-service.json'), '{}\n', 'utf8')

    const report = compareSnapshotDirs(freshDir, committedDir)
    expect(report.clean).toBe(false)
    const entry = report.entries.find((e) => e.file === 'retired-service.json')!
    expect(entry.status).toBe('stale')
    expect(entry.freshBytes).toBeNull()
  })

  it('treats CRLF materialized by a Windows autocrlf checkout as the same content', () => {
    // git stores the snapshots with LF; core.autocrlf can materialize CRLF in
    // a Windows working tree. That is not drift: the bytes in git are equal.
    const build = makeBuild()
    writeSnapshot(freshDir, build)
    for (const [name, content] of build.files) {
      writeFileSync(join(committedDir, name), content.replace(/\n/g, '\r\n'), 'utf8')
    }

    const report = compareSnapshotDirs(freshDir, committedDir)
    expect(report.clean).toBe(true)
    for (const entry of report.entries) {
      expect(entry.status).toBe('match')
      expect(entry.committedBytes).toBe(entry.freshBytes)
    }
  })

  it('ignores non-JSON files and subdirectories (src/api-specs holds index.ts)', () => {
    const build = makeBuild()
    writeSnapshot(freshDir, build)
    writeSnapshot(committedDir, build)
    writeFileSync(join(committedDir, 'index.ts'), 'export {}\n', 'utf8')
    mkdirSync(join(committedDir, 'nested'))

    const report = compareSnapshotDirs(freshDir, committedDir)
    expect(report.clean).toBe(true)
    expect(report.entries.map((e) => e.file)).not.toContain('index.ts')
  })

  it('formats a CI-friendly report with one line per file and a summary', () => {
    writeSnapshot(freshDir, makeBuild())
    writeSnapshot(committedDir, makeBuild({ contacts: specYaml('contacts-service API', 'Changed. Yes.') }))
    rmSync(join(committedDir, 'accounts-service.json'))
    writeFileSync(join(committedDir, 'retired-service.json'), '{}\n', 'utf8')

    const lines = formatComparisonReport(compareSnapshotDirs(freshDir, committedDir))
    expect(lines.some((l) => l.includes('MISSING') && l.includes('accounts-service.json'))).toBe(true)
    expect(lines.some((l) => l.includes('DRIFT') && l.includes('contacts-service.json'))).toBe(true)
    expect(lines.some((l) => l.includes('STALE') && l.includes('retired-service.json'))).toBe(true)
    expect(lines[lines.length - 1]).toMatch(/^FAIL: 4 of 4 snapshot files differ/)

    const clean = makeBuild()
    rmSync(committedDir, { recursive: true, force: true })
    mkdirSync(committedDir)
    writeSnapshot(committedDir, clean)
    rmSync(freshDir, { recursive: true, force: true })
    mkdirSync(freshDir)
    writeSnapshot(freshDir, clean)
    const okLines = formatComparisonReport(compareSnapshotDirs(freshDir, committedDir))
    expect(okLines[okLines.length - 1]).toMatch(/^OK: all 3 committed snapshot files are in sync/)
  })
})
