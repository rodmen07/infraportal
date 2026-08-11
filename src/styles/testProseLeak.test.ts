/**
 * v1.28.1 (ROADMAP.md D-31/D-32): test prose leaves the bundle.
 *
 * Tailwind's extractor reads RAW TEXT, not code. It has no parser, no notion of
 * a string literal and no notion of a comment: any token that looks like a
 * utility becomes a candidate, wherever it appears. `vitest.config.ts` puts 99
 * test files under `src/`, and those files are 500 KB of prose ABOUT class
 * names — assertion messages, regexes, doc comments explaining which utility a
 * milestone retired. Every one of those names emitted a live rule into the
 * production stylesheet for an element that does not exist.
 *
 * That is not a hypothesis. Measured on `10a4353` (= `origin/main`), whose
 * build is byte-identical to the live deploy (sha256 `31eda5c0…b2c7667`, 67458
 * bytes): adding `'!./src/**\/*.test.{ts,tsx}'` to the content glob removed 17
 * utilities and nothing else — `shrink`, `grow`, `border-amber-400`,
 * `bg-zinc-700/60`, `bg-zinc-950`, `via-orange-300`, `to-amber-200`,
 * `text-emerald-100`, `text-green-400/70`, `text-red-100/90`, `text-zinc-400`,
 * `text-zinc-50`, `text-zinc-500`, `ring-amber-300`, `hover:text-amber-200`,
 * `hover:text-emerald-300`, `lg:hidden` — each independently re-verified at
 * ZERO whole-token occurrences across the 173 non-test sources. Several are
 * classes an earlier milestone deliberately evicted and a test resurrected:
 * `text-zinc-50` is the exact rule v1.26.1 (PR #147) removed, brought back by
 * two test files naming it.
 *
 * THE CONVENTION THIS REPLACES, and why it had to be replaced (D-32). Until
 * now the rule was "compose class names from parts in tests", which is why
 * files like focusSpelling.test.ts write `<v>:border-<hue>-400/50` instead of
 * the real token. It is a correct technique and it was actively maintained —
 * and it still leaked 17 rules, because it must be remembered in every new
 * sentence of every new test, forever, by everyone. Five separate increments
 * (#145, #146 twice, #147, #152, #153) each caught a fresh leak by hand-running
 * a bundle diff. A convention that needs perfect recall per sentence is not a
 * fix; the glob is. Whole class names are safe to write in NEW tests from here;
 * the existing composed files stay as they are, because rewriting them is churn
 * with no behaviour change.
 *
 * WHAT THIS FILE GUARDS. The glob is one line and nothing would notice it being
 * dropped, widened, or reordered — a build stays green either way and the only
 * symptom is bytes nobody looks at. So this suite runs the REAL committed
 * config through the REAL Tailwind, over a corpus that mirrors this repo's own
 * file paths, and asserts BOTH directions (L-001): every file vitest runs is
 * outside the extractor's corpus, and every non-test source is inside it. The
 * second half is not decoration — it is what stops the first from passing
 * vacuously. `'!./src/**\/*.ts'` would satisfy contract A perfectly while
 * silently deleting most of the app's styling, and contract B is the only
 * assertion here that would notice.
 *
 * WHY A MIRRORED CORPUS RATHER THAN THE REAL TREE. The property is about which
 * files the extractor reads, so the corpus has to carry this repo's real
 * relative paths — a synthetic `src/Probe.test.ts` proves nothing about a test
 * living somewhere the negation does not reach. But planting probe tokens in
 * the real tree would mean writing into `src/` during a test run, which races
 * `npm run check-test-discovery` and leaves debris behind on a crash. So the
 * paths are real and glob-discovered (L-031, hard failure on zero matches), the
 * file CONTENTS are a unique arbitrary-value token per path, and the whole
 * thing lives in a temp directory that is removed afterwards.
 *
 * NEGATIVE CONTROL, run before this shipped and quoted in the PR body: with the
 * negation deleted from tailwind.config.js, contract A reddens naming all 99
 * leaked files; with it widened to `'!./src/**\/*.ts'`, contract B reddens
 * naming the sources that fell out of the corpus. The perturbation is the
 * committed config — the SUBJECT of the guard — while the expectation (which
 * paths are tests) comes from the file names on disk, so the two sides move
 * independently and the control is falsifiable (L-054).
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { discoverTestFilesOnDisk } from '../../scripts/lib/testDiscovery.mjs'

/** Repo root. This file is `src/styles/`, so two levels up. */
const ROOT = path.resolve(__dirname, '..', '..')

/**
 * Every source file the extractor could conceivably read, and the split the
 * negation is supposed to make. `.test.tsx` is in the vocabulary even though
 * zero such files exist today: the config names both extensions so the leak
 * class cannot reappear through a new file kind, and a guard that only knew
 * about `.ts` would not notice if it did.
 */
const IS_TEST_FILE = /\.test\.(ts|tsx)$/

const toPosix = (p: string): string => p.replace(/\\/g, '/')

interface Corpus {
  /** Temp directory mirroring this repo's relative paths. */
  dir: string
  /** Repo-relative path -> the unique token planted in its stand-in file. */
  tokens: Map<string, string>
  testFiles: string[]
  sourceFiles: string[]
  /** The utilities layer Tailwind generated from the mirrored corpus. */
  css: string
}

let corpus: Corpus

/**
 * Discover the two halves, refusing to proceed on an empty set either way
 * (L-031): "no test files matched" and "the negation works" are the same
 * observation downstream, and the first one would make contract A pass while
 * measuring nothing at all.
 */
function splitSources(): { testFiles: string[]; sourceFiles: string[] } {
  const all = globSync('src/**/*.{ts,tsx}', { cwd: ROOT }).map(toPosix).sort()
  if (all.length === 0) {
    throw new Error(
      `src/**/*.{ts,tsx} matched no files under ${ROOT} — refusing to report a ` +
        'clean result from an empty corpus',
    )
  }
  const testFiles = all.filter((f) => IS_TEST_FILE.test(f))
  const sourceFiles = all.filter((f) => !IS_TEST_FILE.test(f))
  if (testFiles.length === 0) throw new Error('no test files discovered under src/')
  if (sourceFiles.length === 0) throw new Error('no non-test sources discovered under src/')
  return { testFiles, sourceFiles }
}

/**
 * Rebase the committed content globs onto the mirrored corpus, preserving
 * their order and their `!` negations. Order is load-bearing to Tailwind: a
 * negation only narrows the positive globs that precede it.
 */
function rebase(globs: readonly string[], dir: string): string[] {
  return globs.map((glob) => {
    const negated = glob.startsWith('!')
    const body = (negated ? glob.slice(1) : glob).replace(/^\.\//, '')
    return `${negated ? '!' : ''}${dir}/${body}`
  })
}

beforeAll(async () => {
  const { testFiles, sourceFiles } = splitSources()

  // The committed config, loaded at runtime rather than statically imported so
  // this suite reads exactly what PostCSS reads at build time.
  const configModule: { default?: unknown } = await import(
    pathToFileURL(path.join(ROOT, 'tailwind.config.js')).href
  )
  const config = configModule.default as { content?: unknown } | undefined
  if (!config || !Array.isArray(config.content) || config.content.length === 0) {
    throw new Error(
      'tailwind.config.js exposes no `content` array — this guard can no longer ' +
        'observe the extractor corpus and must be rewritten rather than left ' +
        'passing vacuously',
    )
  }
  const contentGlobs = config.content as string[]

  const dir = toPosix(mkdtempSync(path.join(os.tmpdir(), 'infraportal-tw-leak-')))
  const tokens = new Map<string, string>()
  let nth = 0
  // An arbitrary-value utility, so no theme key has to be invented and the
  // token cannot collide with anything the real config already emits.
  const plant = (rel: string): void => {
    const token = `mt-[${1000 + nth}px]`
    nth += 1
    tokens.set(rel, token)
    const abs = path.join(dir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, `"${token}"\n`)
  }
  for (const rel of [...testFiles, ...sourceFiles]) plant(rel)
  plant('index.html')

  const { css } = await postcss([
    tailwindcss({ ...config, content: rebase(contentGlobs, dir) }),
  ]).process('@tailwind utilities;', { from: undefined })

  corpus = { dir, tokens, testFiles, sourceFiles, css }
})

afterAll(() => {
  if (corpus?.dir) rmSync(corpus.dir, { recursive: true, force: true })
})

/** Did the mirrored corpus emit the rule for this path's planted token? */
const emitted = (rel: string): boolean => {
  const token = corpus.tokens.get(rel)
  if (!token) throw new Error(`no token was planted for ${rel}`)
  // `mt-[1042px]` compiles to `.mt-\[1042px\]{margin-top:1042px}`; the bracketed
  // value is unique per path and appears nowhere else in the generated layer.
  return corpus.css.includes(token.slice('mt-['.length, -1))
}

describe('test prose leaves the bundle (TAILWIND-TESTPROSE-LEAK-1, v1.28.1 D-31)', () => {
  it('contract A: no file vitest runs is inside the extractor corpus', () => {
    const leaked = corpus.testFiles.filter(emitted)

    expect(
      leaked,
      `${leaked.length} of ${corpus.testFiles.length} test files are still read by ` +
        "Tailwind's extractor, so any utility they name by hand ships a dead rule " +
        'to production (TAILWIND-TESTPROSE-LEAK-1). Check the `!` negation in ' +
        `tailwind.config.js's content array. Leaking: ${leaked.slice(0, 10).join(', ')}`,
    ).toEqual([])
  })

  it('contract B: every non-test source IS inside the extractor corpus', () => {
    const dropped = corpus.sourceFiles.filter((rel) => !emitted(rel))

    expect(
      dropped,
      `${dropped.length} of ${corpus.sourceFiles.length} non-test sources are NOT read ` +
        'by the extractor, so the classes they use would not be compiled and the ' +
        'app would ship unstyled. The exclusion glob is too broad. Missing: ' +
        `${dropped.slice(0, 10).join(', ')}`,
    ).toEqual([])
  })

  it('contract C: index.html is still in the corpus', () => {
    // The entry document carries the pre-hydration shell's classes. It sits in
    // the same content array, so a rewrite of that array can drop it silently.
    expect(emitted('index.html'), 'index.html is no longer read by the extractor').toBe(true)
  })

  it('contract D: every file vitest runs is classified as a test file here', () => {
    // Drift guard across two sources (L-003): vitest decides what a test file
    // is via `vitest.config.ts`'s include, mirrored in testDiscovery.mjs; the
    // Tailwind negation decides it via a filename pattern. If those two
    // vocabularies ever diverge, a file vitest runs would fall into contract
    // B's set and be REQUIRED to leak, which is the opposite of the intent.
    const runByVitest = discoverTestFilesOnDisk(ROOT)
    const unclassified = runByVitest.filter((rel) => !IS_TEST_FILE.test(rel))

    expect(
      unclassified,
      "vitest runs files this guard does not recognise as tests, so Tailwind's " +
        'negation does not cover them either. Reconcile vitest.config.ts\'s ' +
        "include with tailwind.config.js's exclusion: " +
        unclassified.slice(0, 10).join(', '),
    ).toEqual([])

    expect(
      runByVitest.length,
      'discoverTestFilesOnDisk returned nothing, so contract D compared two empty sets',
    ).toBeGreaterThan(0)
  })
})
