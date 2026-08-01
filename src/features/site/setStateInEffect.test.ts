/**
 * Guard for the `react-hooks/set-state-in-effect` legacy ratchet
 * (DEP-MAJ-2 follow-up, 2026-08-01).
 *
 * PR #105 adopted eslint 10 + react-hooks 7.1, whose recommended set enables
 * `set-state-in-effect` at "error". Seventeen existing effects violated it, so
 * the rule was held at "warn" GLOBALLY to keep the toolchain major
 * behaviour-preserving. That hold was doing nothing for new code either:
 * `npm run lint` is `eslint .` with no `--max-warnings`, so a warning has
 * never failed the Linting gate. The rule was, in practice, off.
 *
 * The hold is now a path list (`SET_STATE_IN_EFFECT_LEGACY` in
 * eslint.config.js) instead of a global setting, so the rule gates every file
 * that is not on it. This file asserts the two halves that a source scan
 * cannot: that the config really resolves to "error" off the list and "warn"
 * on it, and that no entry has gone stale. Both are checked against the REAL
 * flat config through the ESLint API rather than by reading the file, because
 * a rule's effective severity is the product of the whole config cascade
 * (recommended sets, later blocks, `extends`) and not of the line that
 * mentions it.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ESLint } from 'eslint'

const ROOT = process.cwd()
const RULE = 'react-hooks/set-state-in-effect'
const CONFIG_PATH = path.join(ROOT, 'eslint.config.js')
const CONFIG_SOURCE = readFileSync(CONFIG_PATH, 'utf-8')

/**
 * The exemption list, read out of the config SOURCE rather than imported, so
 * the assertions below run against the literal a reviewer sees in
 * eslint.config.js. Every other contract here goes through the ESLint API, so
 * the two halves cross-check each other: the list says what is exempt, the
 * resolved config says what actually is.
 */
const SET_STATE_IN_EFFECT_LEGACY: string[] = (() => {
  const block = /const SET_STATE_IN_EFFECT_LEGACY = \[([\s\S]*?)\]/.exec(CONFIG_SOURCE)
  if (!block) throw new Error('SET_STATE_IN_EFFECT_LEGACY not found in eslint.config.js')
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
})()

const toPosix = (value: string) => value.replace(/\\/g, '/')

/**
 * The ceiling. Lower it when a file is fixed and removed from the list; it may
 * never be raised. Twelve is where the triage PR left it, after fixing the two
 * portal auth pages that parsed their URL inside a mount effect.
 */
const LEGACY_CEILING = 12

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

describe('set-state-in-effect legacy ratchet', () => {
  describe('contract A: the list is real and bounded', () => {
    it('is a non-empty list of repo-relative paths', () => {
      expect(SET_STATE_IN_EFFECT_LEGACY.length).toBeGreaterThan(0)
      for (const entry of SET_STATE_IN_EFFECT_LEGACY) {
        expect(entry.startsWith('src/')).toBe(true)
        // A glob would let the exemption spread silently to files nobody
        // triaged; every entry names one file.
        expect(entry.includes('*')).toBe(false)
      }
    })

    it('is wired into a config block rather than merely declared', () => {
      expect(CONFIG_SOURCE).toContain('files: SET_STATE_IN_EFFECT_LEGACY')
    })

    it('never grows past the ceiling', () => {
      expect(SET_STATE_IN_EFFECT_LEGACY.length).toBeLessThanOrEqual(LEGACY_CEILING)
    })

    it('holds no duplicates', () => {
      expect(new Set(SET_STATE_IN_EFFECT_LEGACY).size).toBe(SET_STATE_IN_EFFECT_LEGACY.length)
    })

    it('names only files that exist', () => {
      const missing = SET_STATE_IN_EFFECT_LEGACY.filter(
        (entry) => !existsSync(path.join(ROOT, entry)),
      )
      expect(missing).toEqual([])
    })
  })

  describe('contract B: the config resolves to the severities the ratchet claims', () => {
    it('reports the rule as an error for a file that is not on the list', async () => {
      const config = await eslint.calculateConfigForFile(
        path.join(ROOT, 'src/pages/PortalRegisterPage.tsx'),
      )
      expect(severityName(config.rules?.[RULE])).toBe('error')
    }, ESLINT_TIMEOUT)

    it('reports the rule as a warning for every file on the list', async () => {
      const severities = await Promise.all(
        SET_STATE_IN_EFFECT_LEGACY.map(async (entry) => {
          const config = await eslint.calculateConfigForFile(path.join(ROOT, entry))
          return [entry, severityName(config.rules?.[RULE])] as const
        }),
      )
      expect(severities.filter(([, severity]) => severity !== 'warn')).toEqual([])
    }, ESLINT_TIMEOUT)
  })

  describe('contract C: the behaviour difference between on and off', () => {
    // The point of the increment: before it, this same source produced a
    // warning anywhere in the repo and `eslint .` still exited 0.
    it('fails a new component that calls setState in an effect', async () => {
      const results = await eslint.lintText(VIOLATING_SOURCE, {
        filePath: path.join(ROOT, 'src/features/site/NotOnTheList.tsx'),
      })
      const messages = ruleMessages(results)
      expect(messages.length).toBeGreaterThan(0)
      expect(messages.every((m) => m.severity === 2)).toBe(true)
      expect(results.some((r) => r.errorCount > 0)).toBe(true)
    }, ESLINT_TIMEOUT)

    it('only warns for the identical source at a listed path', async () => {
      const results = await eslint.lintText(VIOLATING_SOURCE, {
        filePath: path.join(ROOT, SET_STATE_IN_EFFECT_LEGACY[0]),
      })
      const messages = ruleMessages(results)
      expect(messages.length).toBeGreaterThan(0)
      expect(messages.every((m) => m.severity === 1)).toBe(true)
    }, ESLINT_TIMEOUT)
  })

  describe('contract D: no entry has gone stale', () => {
    // A file that no longer violates must leave the list, or the exemption
    // outlives the problem and quietly re-opens the hole for that path.
    it('still finds a violation in every listed file', async () => {
      const results = await eslint.lintFiles(SET_STATE_IN_EFFECT_LEGACY)
      const clean = results
        .filter((r) => r.messages.every((m) => m.ruleId !== RULE))
        .map((r) => toPosix(path.relative(ROOT, r.filePath)))
      expect(clean).toEqual([])
    }, ESLINT_TIMEOUT)
  })
})
