/**
 * Runner-bounded DOM polling for tests (ASPECEXPLORER-WAITFOR-1, measured
 * 2026-08-08).
 *
 * THE DEFECT THIS REPLACES. `ApiSpecExplorer.test.ts` waited for a lazily
 * `import()`ed spec chunk with its own loop:
 *
 *   for (let attempt = 0; attempt < 40; attempt++) {
 *     const found = container.querySelector(selector)
 *     if (found) return found
 *     await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
 *   }
 *   throw new Error(`timed out waiting for ${selector}`)
 *
 * That is a SECOND liveness bound, invisible to the one this repo actually
 * measured and guards (`vitest.config.ts` testTimeout, floor-asserted by
 * `src/features/site/testTimeoutBudget.test.ts`, shipped for SPECWALK-TIMEOUT-1
 * in PR #138). It failed twice in two consecutive dev runs, on PR #140 and
 * PR #141, always as `timed out waiting for details[data-op-card="listContacts"]`
 * — always in CI-green PRs that never touched `src/features/apiDocs/`.
 *
 * WHAT THE MEASUREMENT ACTUALLY SHOWED, and why the old bound was mis-stated
 * as "a ~400ms budget" (40 probes x a 10ms sleep). The sleep is a real timer on
 * a shared event loop, so its wall cost is ELASTIC: instrumenting the helper
 * with `attempts` and `elapsedMs` and running the suite 3x in parallel gave
 *
 *   wait                             attempts used   wall elapsed
 *   accounts chunk, idle                    1            184ms
 *   contacts chunk, idle                    1            128ms
 *   accounts chunk, 3x parallel           1-8         625-1801ms
 *   contacts chunk, 3x parallel           1-3         458-1063ms
 *
 * So EVERY contended observation of the quantity the loop was bounding already
 * exceeded the nominal 400ms, and the waits survived only because the probe
 * count — the real bound — stretched its own wall clock along with the load.
 * The loop therefore fails in exactly the case it was least expected to: when
 * the worker's own event loop is IDLE (so the 10ms sleeps really cost 10ms)
 * while the vite-node module fetch is stalled somewhere else, spending all 40
 * probes inside ~400ms of wall time against a fetch measured at up to 1801ms.
 *
 * THE FIX. Bound the wait by TIME, and take that time from the budget the
 * RUNNER is enforcing on the calling test rather than from a local constant, so
 * this repo has one liveness policy instead of two and the tighter one cannot
 * hide. `ctx.task.timeout` is what the runner enforces right now, which is why
 * `testTimeoutBudget.test.ts` reads it too (L-033: a config value is an
 * existence claim; the enforced value is a fact).
 */

/**
 * Share of the runner's per-test budget one wait may consume.
 *
 * Half, not all: a wait that loses must still leave the test room to report its
 * own failure instead of dying as a bare `Test timed out in 20000ms`, which is
 * the message that tells a reader nothing. At the committed 20s budget this is
 * 10000ms — 5.5x the worst contended observation above, and 54x the worst idle
 * one. It is deliberately NOT tuned to the measurement: the point of deriving
 * it is that the number moves when the guarded policy moves.
 */
export const POLL_BUDGET_FRACTION = 0.5

/** Nominal gap between probes. Real cost is whatever the event loop allows. */
export const POLL_INTERVAL_MS = 10

export interface WaitForSelectorOptions {
  /**
   * The per-test timeout the runner is enforcing — pass `ctx.task.timeout`
   * from the test's own context, never a literal.
   */
  testTimeoutMs: number
  /**
   * Awaited between probes. The caller supplies it because the flush is
   * framework-specific: React tests pass an `act`-wrapped sleep so pending
   * state updates are applied before the next probe.
   */
  tick: () => Promise<void>
  /** Injectable clock, so the budget is testable without real waiting. */
  now?: () => number
}

/**
 * The wall-clock budget one wait gets, derived from the runner's own.
 *
 * Throws rather than defaulting when the runner's budget is unavailable: a
 * silent fallback would reintroduce exactly the invisible local constant this
 * module exists to delete, and an unusable `ctx.task.timeout` (a vitest API
 * change) must fail loudly instead of being read as "no budget known, use mine".
 */
export function pollBudgetMs(testTimeoutMs: number): number {
  if (!Number.isFinite(testTimeoutMs) || testTimeoutMs <= 0) {
    throw new Error(
      `waitForSelector needs the runner's per-test timeout (ctx.task.timeout); got ` +
        `${String(testTimeoutMs)}. Do not substitute a local constant — that is ` +
        'ASPECEXPLORER-WAITFOR-1.',
    )
  }
  return Math.floor(testTimeoutMs * POLL_BUDGET_FRACTION)
}

/**
 * Polls `container` until `selector` matches, bounded by the runner's budget.
 *
 * The returned error names the budget and the probe count, which is what the
 * two recorded sightings of this flake did not have: `timed out waiting for X`
 * alone cannot distinguish "the wait was too short" from "the element never
 * renders", and that ambiguity is why the bug sat open across two runs.
 */
export async function waitForSelector(
  container: ParentNode,
  selector: string,
  options: WaitForSelectorOptions,
): Promise<Element> {
  const now = options.now ?? Date.now
  const budget = pollBudgetMs(options.testTimeoutMs)
  const startedAt = now()
  const deadline = startedAt + budget

  for (let probes = 1; ; probes++) {
    const found = container.querySelector(selector)
    if (found) return found
    if (now() >= deadline) {
      throw new Error(
        `timed out waiting for ${selector} after ${String(now() - startedAt)}ms ` +
          `(budget ${String(budget)}ms = ${String(POLL_BUDGET_FRACTION)} of the runner's ` +
          `${String(options.testTimeoutMs)}ms, ${String(probes)} probes). Either the element ` +
          'never renders, or the budget is now below what this wait costs — measure ' +
          'before raising anything (ASPECEXPLORER-WAITFOR-1).',
      )
    }
    await options.tick()
  }
}
