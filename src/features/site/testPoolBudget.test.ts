/**
 * Worker-pool budget guard (QA, COVERAGE-UNDERRUN-1, 2026-08-11).
 *
 * The suite runs on vitest's forks pool, so every worker is a child process.
 * With `maxWorkers` unset the pool is sized `availableParallelism() - 1`, which
 * is 11 on the development box, and under machine load a share of those eleven
 * child processes never answer their start handshake. Vitest routes that into a
 * trailing unhandled-error block and still prints the files it did manage to
 * run as a complete green summary. Observed on this tree, uncapped, 2026-08-11:
 *
 *   Test Files  75 passed (75)
 *   Tests       2471 passed (2471)
 *   Errors      23 errors
 *   Error: [vitest-pool]: Failed to start forks worker for test files <path>
 *   Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond
 *
 * 75 + 23 = 98, the whole corpus, and `npm run check-test-discovery` named all
 * 23 files that never ran. That is COVERAGE-UNDERRUN-1, five sightings deep.
 *
 * Why this file has two contracts rather than one. `VITEST_MAX_WORKERS` in the
 * environment overwrites the resolved value after config resolution
 * (node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js:380), and that variable
 * is set machine-wide on the box this repo is developed on. So a guard that
 * only reads the value the runner resolved cannot tell a cap this repo COMMITTED
 * from one it merely INHERITED from whoever launched the process: delete the
 * config key and the environment keeps the assertion green while every other
 * checkout, and CI, runs uncapped. Contract A is the one that observes reality;
 * contract B is the one that proves the reality is ours.
 */

import { describe, expect, it } from 'vitest'
import vitestConfig from '../../../vitest.config'

/**
 * Ceiling, not the configured value: the guard must fail when the cap is lost,
 * not churn every time it is retuned. The committed value is 3, which is also
 * what the 4-vCPU CI runner resolves on its own.
 */
const MAX_POOL_WORKERS = 4

/**
 * What an uncapped pool resolves to on the development box this bug was
 * observed on: `availableParallelism()` is 12 there, and vitest uses one less.
 */
const UNCAPPED_WORKERS_ON_DEV_BOX = 11

type WorkerStateView = {
  config?: {
    maxWorkers?: unknown
    pool?: unknown
  }
}

function workerState(): WorkerStateView | undefined {
  return (globalThis as unknown as { __vitest_worker__?: WorkerStateView }).__vitest_worker__
}

describe('worker-pool budget (COVERAGE-UNDERRUN-1)', () => {
  it('contract A: the runner is enforcing a capped pool on this run', () => {
    const effective = workerState()?.config?.maxWorkers

    expect(
      typeof effective,
      'globalThis.__vitest_worker__.config.maxWorkers is missing, so this guard ' +
        'can no longer observe the pool size the runner resolved and must be ' +
        'rewritten against the current vitest API rather than left passing ' +
        'vacuously',
    ).toBe('number')

    const workers = effective as number

    expect(
      workers,
      `the runner resolved a pool of ${String(workers)} workers. Above ` +
        `${MAX_POOL_WORKERS} the forks pool starts more child processes than a ` +
        'loaded machine answers in time, and the files whose workers time out ' +
        'are reported as a green summary rather than as failures ' +
        '(COVERAGE-UNDERRUN-1).',
    ).toBeLessThanOrEqual(MAX_POOL_WORKERS)

    expect(workers).toBeGreaterThanOrEqual(1)
  })

  it('contract B: the cap is committed in vitest.config.ts, not inherited from the environment', () => {
    const declared = vitestConfig.test?.maxWorkers

    expect(
      declared,
      'vitest.config.ts declares no maxWorkers, so the pool size is whatever the ' +
        'host offers minus one for every checkout and for CI. Contract A can ' +
        'still pass here purely because VITEST_MAX_WORKERS is set in this ' +
        "process's environment, which is exactly the case this contract exists " +
        'to separate.',
    ).toBeTypeOf('number')

    expect(declared as number).toBeLessThanOrEqual(MAX_POOL_WORKERS)
    expect(declared as number).toBeGreaterThanOrEqual(1)
  })

  it('contract C: the ceiling this guard enforces is below the pool size it exists to reject', () => {
    // Vacuity check: raising MAX_POOL_WORKERS to or above the uncapped default
    // would leave contracts A and B green while the whole failure mode is back.
    expect(MAX_POOL_WORKERS).toBeLessThan(UNCAPPED_WORKERS_ON_DEV_BOX)
  })
})
