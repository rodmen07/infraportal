import { defineConfig } from 'vitest/config'

/**
 * Per-test timeout budget (SPECWALK-TIMEOUT-1, measured 2026-08-07).
 *
 * This suite is dominated by sub-millisecond pure-model tests, but the apiDocs
 * "walk every operation of all 11 committed specs" suites render real React
 * under jsdom for every operation and are two to three orders of magnitude
 * slower than the rest. Measured on this repo:
 *
 *   test                                                    idle    3x-parallel
 *   specCatalog "renders a Try it panel state for every op"   175ms   4204-5454ms
 *   specCatalog "renders snippets and a copy-link ..."        167ms   3798-4645ms
 *   specCatalog "renders every service view ... (smoke)"      558ms   3489-3573ms
 *
 * Nothing ever chose vitest's implicit 5000ms default, and under load those
 * three land on both sides of it, so the required "Unit Tests" context was a
 * coin flip whenever the machine was busy (observed: 1 timeout in 8 sequential
 * coverage runs, and 1 in 3 parallel ones).
 *
 * 20s is ~3.7x the worst contended observation and ~36x the worst idle one. It
 * relaxes a liveness bound only: no assertion is weakened, a genuinely hung
 * test still fails (20s later, against a 13s suite), and vitest's default
 * 300ms slowTestThreshold still flags these in the reporter, so real slowness
 * stays visible. Guarded by src/features/site/testTimeoutBudget.test.ts.
 */
const TEST_TIMEOUT_MS = 20_000

/**
 * Worker-pool ceiling (COVERAGE-UNDERRUN-1, measured 2026-08-11).
 *
 * With `maxWorkers` unset, vitest sizes the pool from the host:
 * `resolveMaxWorkers` (node_modules/vitest/dist/chunks/cli-api.BK8pd4xc.js,
 * the `availableParallelism() - 1` branch) returns 11 on this 12-thread
 * development box and 3 on the 4-vCPU ubuntu runner CI uses. So this constant
 * is what CI already resolves to on its own, and it changes only the local run.
 *
 * The pool is FORKS, not threads, and that was measured rather than read:
 * inside a worker `globalThis.__vitest_worker__.config.pool` is `forks` and
 * `worker_threads.isMainThread` is true in a process whose pid differs from its
 * parent, i.e. every worker is a real child process. (Two default assignments
 * disagree in vitest 4.1.10's own dist -- `resolved.pool ??= "forks"` at
 * coverage.DM_a_rWm.js:180 and `resolved.pool ??= "threads"` at :378 -- and the
 * earlier one wins, so reading the later line alone gives the wrong answer.)
 *
 * Eleven concurrently starting child processes is what COVERAGE-UNDERRUN-1 is
 * made of. Observed on this tree at 2026-08-11 with the pool uncapped, while
 * the machine was busy:
 *
 *   Test Files  75 passed (75)          <- a green summary
 *   Tests       2471 passed (2471)
 *   Errors      23 errors               <- and 75 + 23 = the 98 files on disk
 *   Duration    221.23s
 *   Error: [vitest-pool]: Failed to start forks worker for test files <path>
 *   Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond
 *
 * Twenty-three files never ran and the summary still said "passed". Capping the
 * pool removes eight of the eleven simultaneous process starts that time out.
 * It is a liveness bound only: no test is skipped, excluded or weakened, the
 * same 98 files run, and `npm run check-test-discovery` still fails the run if
 * any of them silently does not.
 *
 * Guarded by src/features/site/testPoolBudget.test.ts. Note `VITEST_MAX_WORKERS`
 * overrides this value at resolution time (coverage.DM_a_rWm.js:380), which is
 * why that guard checks both what the runner resolved AND what this file
 * declares.
 */
const MAX_WORKERS = 3

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: TEST_TIMEOUT_MS,
    maxWorkers: MAX_WORKERS,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.d.ts'
      ]
    },
    env: {
      VITE_API_URL: 'http://localhost:3000',
      VITE_AUTH_SERVICE_URL: 'http://localhost:8000',
      VITE_PROJECTS_API_BASE_URL: 'http://localhost:3015',
      VITE_CONTACTS_API_BASE_URL: 'http://localhost:3011',
      VITE_ACCOUNTS_API_BASE_URL: 'http://localhost:3010',
      VITE_OPPORTUNITIES_API_BASE_URL: 'http://localhost:3012',
      VITE_ACTIVITIES_API_BASE_URL: 'http://localhost:3013',
      VITE_AUTOMATION_API_BASE_URL: 'http://localhost:3014',
      VITE_INTEGRATIONS_API_BASE_URL: 'http://localhost:3016',
      VITE_AUDIT_API_BASE_URL: 'http://localhost:3017',
      VITE_EVENT_STREAM_URL: 'http://localhost:8085',
      VITE_SEARCH_API_BASE_URL: 'http://localhost:8083',
      VITE_REPORTING_API_BASE_URL: 'http://localhost:8086',
      VITE_OBSERVABOARD_URL: 'https://observaboard-rodmen07.fly.dev',
      VITE_SPEND_API_BASE_URL: 'http://localhost:3020',
      VITE_ADMIN_KEY: 'dev-admin',
      VITE_GATEWAY_URL: 'http://localhost:8080',
    },
  },
})
