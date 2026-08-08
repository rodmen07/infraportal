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

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: TEST_TIMEOUT_MS,
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
