/**
 * Hand-rolled-wait guard (QA, ASPECEXPLORER-WAITFOR-1, 2026-08-08).
 *
 * THE CLASS. PR #138 gave this repo ONE measured, guarded liveness bound: the
 * per-test timeout in `vitest.config.ts`, floor-asserted against the runner's
 * own `ctx.task.timeout` by `testTimeoutBudget.test.ts`. That fix is worth
 * nothing to a suite that quietly carries a SECOND, tighter bound of its own,
 * and one did: `ApiSpecExplorer.test.ts` waited for a lazily `import()`ed spec
 * chunk with `for (let attempt = 0; attempt < 40; attempt++)` around a 10ms
 * sleep. Its nominal 400ms ceiling sat BELOW every contended measurement of the
 * thing it was bounding (458-1801ms across a 3x-parallel run, versus 128-184ms
 * idle), so the required "Unit Tests" context went red at random — twice in two
 * days, on PR #140 and PR #141, in diffs that never touched `src/features/apiDocs/`.
 * Raising the global timeout could never have helped: nothing about the 20s
 * budget is visible to a loop counting to 40.
 *
 * WHAT THIS ASSERTS. Every `src/**\/*.test.ts(x)` is glob-discovered and parsed
 * with the TypeScript AST (never a source regex — L-031: a regex cannot tell a
 * loop from the word "for" in a doc comment, and a guard that reports garbage
 * gets deleted), then failed if any LOOP body awaits a timer-backed sleep. That
 * is the syntactic definition of a hand-rolled polling wait. The sanctioned one
 * is `src/lib/waitForSelector.ts`, whose budget is a share of `ctx.task.timeout`
 * and therefore moves with the policy `testTimeoutBudget.test.ts` guards.
 *
 * WHY THERE IS NO ALLOWLIST. The tree contains exactly zero offenders after the
 * fix, so an exemption list would have no first entry — and v1.23 D-12 deleted
 * this repo's last exemption mechanism precisely because an empty one is an
 * invitation. A test that genuinely needs to poll calls the helper.
 *
 * WHAT THIS DOES NOT PROVE. The detector is anchored on the TIMER, so a future
 * loop awaiting some other stalling primitive (a bare `await tick()`, a
 * `MessageChannel` turn) is invisible here; the third fixture below pins that
 * blind spot rather than letting it be discovered later. It also says nothing
 * about the helper's budget being big ENOUGH — that is
 * `src/lib/waitForSelector.test.ts`, which runs both bounds against the same
 * probe stream and the same injected clock.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

/** The one sanctioned polling implementation, by path. */
const SANCTIONED_HELPER = 'src/lib/waitForSelector.ts'

interface ModuleSource {
  file: string
  source: string
}

/** Every `.test.ts`/`.test.tsx` under `src/`. */
function testFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...testFiles(rel))
    else if (/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found.sort()
}

function parseModule({ file, source }: ModuleSource): ts.SourceFile {
  // Script kind must follow the extension: parsing a .ts file as TSX would
  // misread `<T>value` type assertions as JSX.
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
}

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  )
}

/** Does this subtree CALL a timer scheduler? */
function schedulesATimer(node: ts.Node): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (found) return
    if (ts.isCallExpression(n)) {
      const callee = ts.isIdentifier(n.expression)
        ? n.expression.text
        : ts.isPropertyAccessExpression(n.expression)
          ? n.expression.name.text
          : null
      if (callee === 'setTimeout' || callee === 'setInterval') {
        found = true
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/**
 * A hand-rolled polling wait: a loop whose body awaits something that schedules
 * a timer. The `await` matters — a loop that merely REGISTERS timers (a fixture
 * seeding fake timers, say) is not a wait and is none of this guard's business.
 */
function handRolledWaits({ file, source }: ModuleSource): string[] {
  const sf = parseModule({ file, source })
  const offences: string[] = []

  const inspectLoop = (loop: ts.Node): void => {
    const visit = (n: ts.Node): void => {
      // Do not descend into a nested loop; it reports itself.
      if (n !== loop && isLoop(n)) {
        inspectLoop(n)
        return
      }
      if (ts.isAwaitExpression(n) && schedulesATimer(n)) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
        offences.push(`${file}:${String(line)} awaits a timer sleep inside a loop`)
        return
      }
      ts.forEachChild(n, visit)
    }
    ts.forEachChild(loop, visit)
  }

  const walk = (n: ts.Node): void => {
    if (isLoop(n)) {
      inspectLoop(n)
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return offences
}

// ---------------------------------------------------------------------------
// Fixtures. DEFECT_LOOP is the replaced helper VERBATIM from
// `git show 397bcfe:src/features/apiDocs/ApiSpecExplorer.test.ts` lines 38-47,
// so the analyzer is proven against the real defect and not a sketch of it.
// ---------------------------------------------------------------------------

const DEFECT_LOOP: ModuleSource = {
  file: 'fixture/ApiSpecExplorer.test.ts',
  source: `
async function waitFor(selector: string): Promise<Element> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const found = container.querySelector(selector)
    if (found) return found
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  throw new Error(\`timed out waiting for \${selector}\`)
}
`,
}

const DEFECT_WHILE: ModuleSource = {
  file: 'fixture/while.test.ts',
  source: `
async function spin(): Promise<void> {
  while (!done()) {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
`,
}

/** The shipped shape: the timer lives in a callback, not in a loop. */
const HEALTHY_HELPER_CALL: ModuleSource = {
  file: 'fixture/adopted.test.ts',
  source: `
async function waitFor(ctx: Ctx, selector: string): Promise<Element> {
  return waitForSelector(container, selector, {
    testTimeoutMs: ctx.task.timeout,
    tick: () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }),
  })
}
`,
}

/** The documented blind spot: a loop that waits on something that is not a timer. */
const BLIND_SPOT: ModuleSource = {
  file: 'fixture/blindSpot.test.ts',
  source: `
async function legacyWaitFor(tick: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    await tick()
  }
}
`,
}

/** A loop that registers a timer without awaiting it: not a wait. */
const HEALTHY_REGISTRATION: ModuleSource = {
  file: 'fixture/registration.test.ts',
  source: `
function seed(): void {
  for (const ms of [10, 20, 30]) {
    setTimeout(() => fire(ms), ms)
  }
}
`,
}

describe('hand-rolled polling waits (ASPECEXPLORER-WAITFOR-1)', () => {
  it('fires on the loop that actually flaked, and on its while-shaped twin', () => {
    expect(handRolledWaits(DEFECT_LOOP)).toEqual([
      'fixture/ApiSpecExplorer.test.ts:6 awaits a timer sleep inside a loop',
    ])
    expect(handRolledWaits(DEFECT_WHILE)).toHaveLength(1)
  })

  it('stays silent on the shipped shape and on a plain timer registration', () => {
    expect(handRolledWaits(HEALTHY_HELPER_CALL)).toEqual([])
    expect(handRolledWaits(HEALTHY_REGISTRATION)).toEqual([])
  })

  it('records its own blind spot rather than implying it has none', () => {
    // A loop awaiting a non-timer primitive is NOT detected. Stated as an
    // assertion so the day it starts being detected, this line fails and gets
    // rewritten, instead of the doc comment quietly going stale (L-026).
    expect(handRolledWaits(BLIND_SPOT)).toEqual([])
  })

  it('no test file under src/ hand-rolls a polling wait', () => {
    const files = testFiles()

    expect(
      files.length,
      'the glob discovered no test files at all, so this guard is scanning ' +
        'nothing and would pass on any tree (L-031 zero-match hard failure)',
    ).toBeGreaterThan(50)

    const offences = files.flatMap((file) =>
      handRolledWaits({ file, source: readFileSync(path.join(ROOT, file), 'utf8') }),
    )

    expect(
      offences,
      `these tests carry their own liveness bound, invisible to the per-test ` +
        `timeout that testTimeoutBudget.test.ts guards. Use ${SANCTIONED_HELPER}, ` +
        'whose budget is a share of ctx.task.timeout:\n' +
        offences.join('\n'),
    ).toEqual([])
  })

  it('the sanctioned helper exists and is what the suite imports', () => {
    const helper = readFileSync(path.join(ROOT, SANCTIONED_HELPER), 'utf8')
    expect(helper).toContain('export async function waitForSelector')
    expect(helper).toContain('ctx.task.timeout')

    const adopted = readFileSync(
      path.join(ROOT, 'src/features/apiDocs/ApiSpecExplorer.test.ts'),
      'utf8',
    )
    expect(adopted).toContain("from '../../lib/waitForSelector'")
    expect(adopted).toContain('ctx.task.timeout')
  })
})
