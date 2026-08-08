/**
 * Behaviour difference for the runner-bounded wait (ASPECEXPLORER-WAITFOR-1).
 *
 * Both shapes run here against the SAME fake container, the SAME probe stream
 * and the SAME injected clock, so the only variable is the bound itself:
 * `LEGACY_PROBE_BOUND` probes versus a share of the runner's per-test budget.
 * The values are not invented — they are the measurement recorded in
 * `waitForSelector.ts`, taken by instrumenting the real helper with `attempts`
 * and `elapsedMs` and running the suite 3x in parallel (L-050: a test that
 * exercises a numeric bound picks its values from the observed distribution,
 * not from a comment).
 *
 * The clock is injected rather than real on purpose: a test that proves a
 * timeout by actually waiting is itself load-sensitive, which is the defect.
 */
import { describe, expect, it } from 'vitest'
import {
  POLL_BUDGET_FRACTION,
  POLL_INTERVAL_MS,
  pollBudgetMs,
  waitForSelector,
} from './waitForSelector'

/** The bound the old hand-rolled loop in ApiSpecExplorer.test.ts used. */
const LEGACY_PROBE_BOUND = 40

/**
 * Worst wall time a single cold spec-chunk wait was measured at under a
 * 3x-parallel run of this suite (accounts chunk, 2026-08-08). The old loop's
 * nominal ceiling was LEGACY_PROBE_BOUND * POLL_INTERVAL_MS = 400ms, i.e.
 * BELOW this, which is the defect in one line.
 */
const WORST_CONTENDED_WAIT_MS = 1801

/** Worst wall time the same wait cost with the machine idle. */
const WORST_IDLE_WAIT_MS = 184

/** A container whose selector starts matching only on the nth probe. */
function containerYieldingAtProbe(nth: number): ParentNode {
  let probes = 0
  const element = { tagName: 'DETAILS' } as unknown as Element
  return {
    querySelector: () => {
      probes += 1
      return probes >= nth ? element : null
    },
  } as unknown as ParentNode
}

/** A clock that only moves when a probe interval is awaited. */
function fakeClock(stepMs = POLL_INTERVAL_MS) {
  let millis = 0
  return {
    now: () => millis,
    tick: async () => {
      millis += stepMs
    },
  }
}

/**
 * The replaced shape, reproduced verbatim in structure so the control is the
 * real thing rather than a description of it. It awaits the injected `tick`
 * instead of a `setTimeout` sleep purely so this control is not itself a
 * hand-rolled polling wait under `pollBudgetGuard.test.ts` — the bound, which
 * is what the control is about, is unchanged.
 */
async function legacyWaitFor(
  container: ParentNode,
  selector: string,
  tick: () => Promise<void>,
): Promise<Element> {
  for (let attempt = 0; attempt < LEGACY_PROBE_BOUND; attempt++) {
    const found = container.querySelector(selector)
    if (found) return found
    await tick()
  }
  throw new Error(`timed out waiting for ${selector}`)
}

/** Probes needed to cover a wall duration at the nominal probe interval. */
function probesFor(durationMs: number): number {
  return Math.ceil(durationMs / POLL_INTERVAL_MS) + 1
}

describe('waitForSelector budget (ASPECEXPLORER-WAITFOR-1)', () => {
  it('the legacy probe bound loses the worst wait that was actually measured', async () => {
    const yieldsAt = probesFor(WORST_CONTENDED_WAIT_MS)
    expect(
      yieldsAt,
      'the control must need MORE probes than the legacy bound allowed, or it ' +
        'proves nothing about the bound',
    ).toBeGreaterThan(LEGACY_PROBE_BOUND)

    const clock = fakeClock()
    await expect(
      legacyWaitFor(containerYieldingAtProbe(yieldsAt), 'details[data-op-card]', clock.tick),
    ).rejects.toThrow('timed out waiting for details[data-op-card]')
  })

  it('the runner-derived budget covers that same wait', async (ctx) => {
    const yieldsAt = probesFor(WORST_CONTENDED_WAIT_MS)
    const clock = fakeClock()

    const found = await waitForSelector(
      containerYieldingAtProbe(yieldsAt),
      'details[data-op-card]',
      { testTimeoutMs: ctx.task.timeout, tick: clock.tick, now: clock.now },
    )

    expect(found).toBeTruthy()
    // The wait cost more wall time than the legacy ceiling and still fits.
    expect(clock.now()).toBeGreaterThan(LEGACY_PROBE_BOUND * POLL_INTERVAL_MS)
    expect(clock.now()).toBeLessThan(pollBudgetMs(ctx.task.timeout))
  })

  it('takes its budget from the runner, with real headroom over the measurement', (ctx) => {
    const budget = pollBudgetMs(ctx.task.timeout)

    expect(budget).toBe(Math.floor(ctx.task.timeout * POLL_BUDGET_FRACTION))
    expect(
      budget,
      `the derived budget is ${String(budget)}ms against a worst contended ` +
        `observation of ${String(WORST_CONTENDED_WAIT_MS)}ms`,
    ).toBeGreaterThan(WORST_CONTENDED_WAIT_MS)
    // Never the whole budget: the test must outlive its own wait to report.
    expect(budget).toBeLessThan(ctx.task.timeout)
  })

  it('still fails, and reasonably fast, when the element genuinely never renders', async (ctx) => {
    const clock = fakeClock()
    const never = { querySelector: () => null } as unknown as ParentNode

    await expect(
      waitForSelector(never, 'details[data-op-card="nope"]', {
        testTimeoutMs: ctx.task.timeout,
        tick: clock.tick,
        now: clock.now,
      }),
    ).rejects.toThrow(/timed out waiting for details\[data-op-card="nope"\].*probes/s)

    expect(clock.now()).toBeGreaterThanOrEqual(pollBudgetMs(ctx.task.timeout))
  })

  it('refuses to invent a budget when the runner does not supply one', () => {
    // A silent fallback here would restore the invisible local constant, so the
    // absence of `ctx.task.timeout` must be loud, not defaulted (L-049).
    expect(() => pollBudgetMs(undefined as unknown as number)).toThrow(/ctx\.task\.timeout/)
    expect(() => pollBudgetMs(0)).toThrow(/ctx\.task\.timeout/)
    expect(() => pollBudgetMs(Number.NaN)).toThrow(/ctx\.task\.timeout/)
  })

  it('vacuity: the constants keep this guard capable of failing', () => {
    expect(POLL_BUDGET_FRACTION).toBeGreaterThan(0)
    expect(POLL_BUDGET_FRACTION).toBeLessThan(1)
    // If the legacy ceiling had covered even the IDLE cost with margin the flake
    // story would not hold; it covered idle at ~2x and lost contention outright.
    expect(LEGACY_PROBE_BOUND * POLL_INTERVAL_MS).toBeGreaterThan(WORST_IDLE_WAIT_MS)
    expect(LEGACY_PROBE_BOUND * POLL_INTERVAL_MS).toBeLessThan(WORST_CONTENDED_WAIT_MS)
  })
})
