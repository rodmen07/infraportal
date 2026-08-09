/**
 * Guard: `react-hooks/set-state-in-effect` is an ERROR for every file (D-12).
 *
 * History, shortest form. PR #105 (eslint 10 + react-hooks 7.1) held the rule
 * at "warn" globally, which in practice switched it off: `npm run lint` is
 * `eslint .` with no `--max-warnings`, so a warning has never failed the
 * Linting gate. The 2026-08-01 ratchet scoped the hold to a shrinking path
 * list in eslint.config.js (eight files at its last measurement); v1.23.1
 * (PR #124) took the list to three; v1.23.2 migrated the last three admin
 * pages onto `src/features/crm/useResource.ts` and DELETED the exemption
 * mechanism outright, per D-12's default. The retired constant's name and its
 * former entries are recorded in ROADMAP.md's v1.23.2 entry (this guard
 * forbids the string in the config, so the config cannot carry the record).
 *
 * What this file now asserts is the mechanism's ABSENCE: the rule resolves to
 * "error" for every source file, a violating component errors (never warns) at
 * each formerly exempted path, and the config carries no exemption list to
 * come back through. Everything semantic goes through the real ESLint API
 * rather than reading the file, because a rule's effective severity is the
 * product of the whole config cascade and not of the line that mentions it.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ESLint } from 'eslint'

const ROOT = process.cwd()
const RULE = 'react-hooks/set-state-in-effect'
const CONFIG_PATH = path.join(ROOT, 'eslint.config.js')
const CONFIG_SOURCE = readFileSync(CONFIG_PATH, 'utf-8')

const toPosix = (value: string) => value.replace(/\\/g, '/')

/**
 * The files the retired exemption mechanism held at "warn", as measured on
 * 2026-08-01 (11 sites across these eight). This set is HISTORICAL, fixed and
 * closed - hand-enumerating it is deliberate (the L-031 falsifier case): no
 * future change can add to what the mechanism exempted before it was deleted.
 * `lintText` treats each entry as a virtual path, so a later rename of the
 * real file cannot invalidate the history being asserted against.
 */
const FORMER_LEGACY_PATHS = [
  'src/features/crm/AccountsTab.tsx',
  'src/features/crm/ContactsTab.tsx',
  'src/features/crm/OpportunitiesTab.tsx',
  'src/features/crm/ProjectsTab.tsx',
  'src/features/crm/SpendTab.tsx',
  'src/pages/AuditPage.tsx',
  'src/pages/PortalPage.tsx',
  'src/pages/ReportsPage.tsx',
]

/** A path no exemption ever covered: the severity floor for brand-new code. */
const NEW_PATH = 'src/features/site/NeverExempted.tsx'

/** A component that violates the rule in the simplest possible way. */
const VIOLATING_SOURCE = `
import { useEffect, useState } from 'react'
export function Fixture() {
  const [n, setN] = useState(0)
  useEffect(() => { setN(1) }, [])
  return <p>{n}</p>
}
`

const eslint = new ESLint({ cwd: ROOT })

/**
 * Every assertion below drives the real ESLint API, which loads
 * typescript-eslint and the react plugins on its first call. That cold load
 * alone exceeds vitest's 5s default while the rest of the suite is running,
 * so each ESLint-touching case carries its own budget rather than failing as
 * a timeout that reads like a config error.
 */
const ESLINT_TIMEOUT = 180_000

const ruleMessages = (results: ESLint.LintResult[]) =>
  results.flatMap((r) => r.messages.filter((m) => m.ruleId === RULE))

/**
 * `calculateConfigForFile` normalises severities to numbers, `lintText`
 * reports them the same way, and a hand-written config uses the strings.
 * Compare on one vocabulary so the assertion cannot pass by accident.
 */
const severityName = (value: unknown): string => {
  const level = Array.isArray(value) ? value[0] : value
  if (level === 2 || level === 'error') return 'error'
  if (level === 1 || level === 'warn') return 'warn'
  if (level === 0 || level === 'off') return 'off'
  return `unknown(${String(level)})`
}

/**
 * Glob-discovered, never hand-enumerated (L-031): the set of files the
 * severity contract ranges over is whatever is on disk at test time, with a
 * zero-match hard failure so a broken walk cannot pass as a clean one.
 */
const discoverSourceFiles = (): string[] => {
  const names = readdirSync(path.join(ROOT, 'src'), { recursive: true }) as string[]
  const files = names
    .filter((name) => /\.(ts|tsx)$/.test(name))
    .map((name) => toPosix(path.join('src', name)))
  if (files.length === 0) {
    throw new Error('source discovery returned zero files - the directory walk is broken')
  }
  return files
}

describe('set-state-in-effect is an error everywhere (D-12)', () => {
  describe('contract A: the rule resolves to "error" for every source file', () => {
    it('leaves no file, anywhere, below "error"', async () => {
      const files = discoverSourceFiles()
      // The repo carries a few hundred source files; a walk that suddenly
      // returns a handful found something other than this repo.
      expect(files.length).toBeGreaterThan(100)
      const belowError: Array<[string, string]> = []
      for (const file of files) {
        const config = await eslint.calculateConfigForFile(path.join(ROOT, file))
        const severity = severityName(config.rules?.[RULE])
        if (severity !== 'error') belowError.push([file, severity])
      }
      expect(belowError).toEqual([])
    }, ESLINT_TIMEOUT)
  })

  describe('contract B: a violating component ERRORS where the mechanism once only warned', () => {
    // The point of v1.23.2, encoded permanently: this same source at these
    // same paths produced severity-1 warnings (and an exit code of 0) while
    // the exemption list existed. If any exemption comes back for one of
    // them, its case flips from error to warn and reddens here.
    it.each([...FORMER_LEGACY_PATHS, NEW_PATH])(
      'errors on a violating %s',
      async (virtualPath) => {
        const results = await eslint.lintText(VIOLATING_SOURCE, {
          filePath: path.join(ROOT, virtualPath),
        })
        const messages = ruleMessages(results)
        expect(messages.length).toBeGreaterThan(0)
        expect(messages.every((m) => m.severity === 2)).toBe(true)
        expect(results.some((r) => r.errorCount > 0)).toBe(true)
      },
      ESLINT_TIMEOUT,
    )
  })

  describe('contract C: the exemption mechanism stays deleted', () => {
    it('the retired constant does not reappear in the config', () => {
      // Not even in a comment: the historical record lives in ROADMAP.md's
      // v1.23.2 entry, so a mention here is a resurrection attempt.
      expect(/SET_STATE_IN_EFFECT_LEGACY/.test(CONFIG_SOURCE)).toBe(false)
    })

    it('the config never names the rule outside comments', () => {
      // The severity comes from the react-hooks recommended set; any explicit
      // mention in live config code is an override asking for review. Strip
      // comments first so the pointer comment documenting this guard stays
      // legal.
      const stripped = CONFIG_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
      expect(stripped.includes('set-state-in-effect')).toBe(false)
    })
  })
})
