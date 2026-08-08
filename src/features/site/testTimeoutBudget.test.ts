/**
 * Per-test timeout budget guard (QA, SPECWALK-TIMEOUT-1, 2026-08-07).
 *
 * The apiDocs "walk every operation of all 11 committed specs" suites render
 * real React under jsdom per operation. Idle they cost 167-558ms; under a
 * 3x-parallel run of this same suite they cost 3489-5454ms. Vitest's implicit
 * default ceiling is 5000ms and no config ever overrode it, so those three
 * tests straddled the cliff and the REQUIRED "Unit Tests" context failed at
 * random whenever the machine was busy.
 *
 * Observed both directions before the fix (this is the flake, not a story
 * about it):
 *
 *   8 sequential `npm run test:coverage` runs -> run 6 red:
 *     FAIL src/features/apiDocs/specCatalog.test.ts > committed spec catalog >
 *       renders a Try it panel state for every operation when a serviceId is
 *       provided (v1.17.2)
 *     Error: Test timed out in 5000ms.
 *
 *   3 parallel runs -> 1 red, same test, and the same three tests measured at
 *   4204/4698/5454ms, 3798/4098/4645ms and 3489/3531/3573ms.
 *
 * Why this file asserts the RUNNER's value rather than the config file's
 * (L-033): a timeout written in `vitest.config.ts` is an existence claim that a
 * stray CLI flag, a workspace project override, or a future config refactor can
 * silently stop delivering, and a comment can restate it while nothing applies
 * it. `ctx.task.timeout` is the number the runner is enforcing on THIS test at
 * THIS moment, which no comment and no doc string can fake. Contract A is
 * therefore the load-bearing one; contract B exists only so the value cannot
 * arrive from a transient invocation flag instead of the committed config.
 *
 * Behaviour difference (L-001): on the pre-fix config contract A reads 5000 and
 * reddens; it is the same 5000 that appears in the timeout message above.
 */

import { describe, expect, it } from 'vitest'
import vitestConfig from '../../../vitest.config'

/**
 * Floor, not the configured value: the guard must fail when the budget is lost,
 * not churn every time it is retuned. Set below the committed 20000 and well
 * above both the 5000 default that caused the flake and the 5454ms worst
 * contended observation, so no setting that reintroduces the cliff can pass.
 */
const MIN_TEST_TIMEOUT_MS = 15_000

/** The implicit vitest default this budget exists to stop inheriting. */
const VITEST_DEFAULT_TIMEOUT_MS = 5_000

describe('per-test timeout budget (SPECWALK-TIMEOUT-1)', () => {
  it('contract A: the runner actually enforces the raised budget on this test', (ctx) => {
    const effective = ctx.task.timeout

    expect(
      typeof effective,
      'ctx.task.timeout is missing, so this guard can no longer observe what the ' +
        'runner enforces and must be rewritten against the current vitest API ' +
        'rather than left passing vacuously',
    ).toBe('number')

    expect(
      effective,
      `the effective per-test timeout is ${String(effective)}ms. At or below ` +
        `${VITEST_DEFAULT_TIMEOUT_MS}ms the apiDocs walk-every-operation suites ` +
        'straddle the ceiling under load and the required "Unit Tests" context ' +
        'fails at random (SPECWALK-TIMEOUT-1).',
    ).toBeGreaterThanOrEqual(MIN_TEST_TIMEOUT_MS)
  })

  it('contract B: the budget is committed in vitest.config.ts, not passed at invocation', () => {
    const configured = vitestConfig.test?.testTimeout

    expect(
      configured,
      'vitest.config.ts declares no testTimeout, so the suite is back on the ' +
        'implicit default for anyone who runs it without the flag that made ' +
        'contract A pass',
    ).toBeTypeOf('number')

    expect(configured).toBeGreaterThanOrEqual(MIN_TEST_TIMEOUT_MS)
  })

  it('contract C: the floor this guard enforces is above the default it exists to reject', () => {
    // Vacuity check: a future edit that lowers MIN_TEST_TIMEOUT_MS to or below
    // the vitest default would leave contracts A and B green while the flake
    // class is fully reintroduced.
    expect(MIN_TEST_TIMEOUT_MS).toBeGreaterThan(VITEST_DEFAULT_TIMEOUT_MS)
  })
})
