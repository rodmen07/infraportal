/**
 * Build-badge honesty guard (BADGE-BRANCH-1, QA increment 2026-07-26).
 *
 * `useGitHubBuildStatus` shipped 2026-03-12 (`aa36f3e`, "case study CI badges
 * now call GitHub API directly, no backend needed") and its only coverage,
 * added 2026-04-12 (`1a2fdfb`), tested `mapStatus` and nothing else. The QUERY
 * and the RUN SELECTION -- the two halves that decide what the public badge
 * claims -- were live and untested for 136 days, and both were wrong from the
 * first commit (the unfiltered `actions/runs?per_page=1` URL is byte-identical
 * in `aa36f3e`). That is the born-broken shape L-014 predicts.
 *
 * The fixtures below are REAL API payloads captured on 2026-07-26 from
 * `gh api repos/rodmen07/<repo>/actions/runs`, trimmed to the fields the code
 * reads, not hand-invented shapes.
 *
 * The `mapStatus` suite is unchanged from the original file: this increment
 * fixes the query and the selection around that primitive, and its behaviour
 * staying identical is part of the evidence.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_BRANCH,
  RUNS_PER_PAGE,
  defaultBranchRunsUrl,
  mapStatus,
  summarizeRepoRuns,
} from './useGitHubBuildStatus'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

describe('mapStatus', () => {
  it('returns unknown for missing run', () => {
    expect(mapStatus(undefined)).toBe('unknown')
  })

  it('maps queued and in_progress to yellow', () => {
    expect(
      mapStatus({
        status: 'queued',
        conclusion: null,
        html_url: '',
        created_at: '',
      }),
    ).toBe('yellow')

    expect(
      mapStatus({
        status: 'in_progress',
        conclusion: null,
        html_url: '',
        created_at: '',
      }),
    ).toBe('yellow')
  })

  it('maps completed success/skipped to green', () => {
    expect(
      mapStatus({
        status: 'completed',
        conclusion: 'success',
        html_url: '',
        created_at: '',
      }),
    ).toBe('green')

    expect(
      mapStatus({
        status: 'completed',
        conclusion: 'skipped',
        html_url: '',
        created_at: '',
      }),
    ).toBe('green')
  })

  it('maps completed failures to red', () => {
    expect(
      mapStatus({
        status: 'completed',
        conclusion: 'failure',
        html_url: '',
        created_at: '',
      }),
    ).toBe('red')
  })
})

// ---------------------------------------------------------------------------
// Real captured payloads (gh api, 2026-07-26)
// ---------------------------------------------------------------------------

/**
 * auth-service. Commit `e550e24` fanned out to three workflows recorded at the
 * SAME second, one of which failed. This is defect (3): `per_page=1` returned an
 * arbitrary one of the three.
 */
const AUTH_RUN_CI = {
  status: 'completed',
  conclusion: 'success',
  event: 'push',
  created_at: '2026-06-25T15:40:27Z',
  head_sha: 'e550e24',
  html_url: 'https://github.com/rodmen07/auth-service/actions/runs/28182076973',
}
const AUTH_RUN_DEPLOY_FLY = {
  status: 'completed',
  conclusion: 'failure',
  event: 'push',
  created_at: '2026-06-25T15:40:27Z',
  head_sha: 'e550e24',
  html_url: 'https://github.com/rodmen07/auth-service/actions/runs/28182076921',
}
const AUTH_RUN_DEPLOY_CLOUD_RUN = {
  status: 'completed',
  conclusion: 'success',
  event: 'push',
  created_at: '2026-06-25T15:40:27Z',
  head_sha: 'e550e24',
  html_url: 'https://github.com/rodmen07/auth-service/actions/runs/28182076911',
}
/** An OLDER commit, which must not influence the badge. */
const AUTH_RUN_PREVIOUS_COMMIT = {
  status: 'completed',
  conclusion: 'failure',
  event: 'push',
  created_at: '2026-06-24T21:26:27Z',
  head_sha: '45b927c',
  html_url: 'https://github.com/rodmen07/auth-service/actions/runs/28130674379',
}

/** The two orderings the live API actually returned for the same three runs. */
const ORDER_FILTERED_QUERY = [
  AUTH_RUN_DEPLOY_FLY,
  AUTH_RUN_CI,
  AUTH_RUN_DEPLOY_CLOUD_RUN,
  AUTH_RUN_PREVIOUS_COMMIT,
]
const ORDER_UNFILTERED_QUERY = [
  AUTH_RUN_CI,
  AUTH_RUN_DEPLOY_FLY,
  AUTH_RUN_DEPLOY_CLOUD_RUN,
  AUTH_RUN_PREVIOUS_COMMIT,
]

/**
 * infraportal. Dependabot's dependency-update jobs carry `event: 'dynamic'` and
 * sit ON `main`, so the branch filter alone does not remove them. This is
 * defect (2).
 */
const INFRAPORTAL_BOT_METADATA = {
  status: 'completed',
  conclusion: 'success',
  event: 'dynamic',
  created_at: '2026-07-26T05:03:05Z',
  head_sha: 'a74cd8e',
  html_url: 'https://github.com/rodmen07/infraportal/actions/runs/30188746639',
}
const INFRAPORTAL_REAL_CI = {
  status: 'completed',
  conclusion: 'success',
  event: 'push',
  created_at: '2026-07-26T05:01:44Z',
  head_sha: 'a74cd8e',
  html_url: 'https://github.com/rodmen07/infraportal/actions/runs/30188708724',
}

/** The pre-fix selection, reproduced verbatim so the DEFECT stays locked. */
const preFixSelection = (body: { workflow_runs: unknown[] }) =>
  mapStatus(body.workflow_runs[0] as Parameters<typeof mapStatus>[0])

describe('defaultBranchRunsUrl (defect 1: the query asked the wrong question)', () => {
  it('filters to the default branch, so a PR branch can never colour the badge', () => {
    const url = new URL(defaultBranchRunsUrl('rodmen07', 'infraportal'))
    expect(url.searchParams.get('branch')).toBe(DEFAULT_BRANCH)
  })

  it('is NOT the unfiltered query that shipped in aa36f3e', () => {
    const url = defaultBranchRunsUrl('rodmen07', 'infraportal')
    expect(url).not.toContain('actions/runs?per_page=1')
    expect(url).toContain('branch=')
  })

  it('reads a page wide enough to hold every workflow of one commit', () => {
    const url = new URL(defaultBranchRunsUrl('rodmen07', 'auth-service'))
    expect(Number(url.searchParams.get('per_page'))).toBe(RUNS_PER_PAGE)
    // auth-service's newest commit alone fired three runs.
    expect(RUNS_PER_PAGE).toBeGreaterThanOrEqual(3)
  })

  it('targets the requested owner and repository', () => {
    const url = new URL(defaultBranchRunsUrl('rodmen07', 'microservices'))
    expect(url.origin).toBe('https://api.github.com')
    expect(url.pathname).toBe('/repos/rodmen07/microservices/actions/runs')
  })

  it('encodes owner and repository rather than interpolating them raw', () => {
    const url = defaultBranchRunsUrl('own er', 're/po')
    expect(url).toContain('own%20er')
    expect(url).toContain('re%2Fpo')
  })

  it('accepts a branch override for a repository that does not use main', () => {
    const url = new URL(defaultBranchRunsUrl('rodmen07', 'legacy', 'master'))
    expect(url.searchParams.get('branch')).toBe('master')
  })
})

describe('summarizeRepoRuns (defect 3: one commit, many workflows)', () => {
  it('reports RED when any workflow of the newest commit failed', () => {
    const item = summarizeRepoRuns('auth-service', { workflow_runs: ORDER_FILTERED_QUERY })
    expect(item.display_status).toBe('red')
  })

  it('gives the same answer whichever order the API returns the runs in', () => {
    const a = summarizeRepoRuns('auth-service', { workflow_runs: ORDER_FILTERED_QUERY })
    const b = summarizeRepoRuns('auth-service', { workflow_runs: ORDER_UNFILTERED_QUERY })
    expect(a.display_status).toBe(b.display_status)
    expect(a.display_status).toBe('red')
  })

  it('the pre-fix selection flipped its answer on those same two orderings', () => {
    // The defect, locked in: identical data, contradictory public claims.
    expect(preFixSelection({ workflow_runs: ORDER_FILTERED_QUERY })).toBe('red')
    expect(preFixSelection({ workflow_runs: ORDER_UNFILTERED_QUERY })).toBe('green')
  })

  it('links "Failed" to the run that actually failed', () => {
    const item = summarizeRepoRuns('auth-service', { workflow_runs: ORDER_FILTERED_QUERY })
    expect(item.html_url).toBe(AUTH_RUN_DEPLOY_FLY.html_url)
  })

  it('reports the newest commit time, not an older run', () => {
    const item = summarizeRepoRuns('auth-service', { workflow_runs: ORDER_FILTERED_QUERY })
    expect(item.run_at).toBe('2026-06-25T15:40:27Z')
  })

  it('ignores runs belonging to older commits', () => {
    const item = summarizeRepoRuns('repo', {
      workflow_runs: [AUTH_RUN_PREVIOUS_COMMIT, AUTH_RUN_CI, AUTH_RUN_DEPLOY_CLOUD_RUN],
    })
    // Newest commit e550e24 is all-success; the older failing commit must not leak.
    expect(item.display_status).toBe('green')
  })

  it('reports GREEN when every workflow of the newest commit passed', () => {
    const item = summarizeRepoRuns('repo', {
      workflow_runs: [AUTH_RUN_CI, AUTH_RUN_DEPLOY_CLOUD_RUN],
    })
    expect(item.display_status).toBe('green')
  })

  it('prefers a known failure over a still-running workflow', () => {
    const inFlight = { ...AUTH_RUN_CI, status: 'in_progress', conclusion: null }
    const item = summarizeRepoRuns('repo', {
      workflow_runs: [inFlight, AUTH_RUN_DEPLOY_FLY],
    })
    expect(item.display_status).toBe('red')
  })

  it('reports YELLOW while the newest commit is still building', () => {
    const inFlight = { ...AUTH_RUN_CI, status: 'in_progress', conclusion: null }
    const item = summarizeRepoRuns('repo', {
      workflow_runs: [inFlight, AUTH_RUN_DEPLOY_CLOUD_RUN],
    })
    expect(item.display_status).toBe('yellow')
  })
})

describe('summarizeRepoRuns (defect 2: bot metadata runs are not CI)', () => {
  it('ignores Dependabot dynamic runs even though they sit on main', () => {
    const item = summarizeRepoRuns('infraportal', {
      workflow_runs: [INFRAPORTAL_BOT_METADATA, INFRAPORTAL_REAL_CI],
    })
    expect(item.html_url).toBe(INFRAPORTAL_REAL_CI.html_url)
    expect(item.run_at).toBe(INFRAPORTAL_REAL_CI.created_at)
  })

  it('the pre-fix selection reported the bot run as the build status', () => {
    expect(
      preFixSelection({ workflow_runs: [INFRAPORTAL_BOT_METADATA, INFRAPORTAL_REAL_CI] }),
    ).toBe('green')
    // ...and it was reading a dependency-update job, not a build:
    expect(INFRAPORTAL_BOT_METADATA.event).toBe('dynamic')
  })

  it('reports unknown when a repository has only bot metadata runs', () => {
    const item = summarizeRepoRuns('repo', { workflow_runs: [INFRAPORTAL_BOT_METADATA] })
    expect(item.display_status).toBe('unknown')
  })
})

describe('summarizeRepoRuns is total (a bad payload must not blank the section)', () => {
  // Pre-fix, `data.workflow_runs[0]` threw on each of these, and the throw
  // rejected Promise.all, so ONE malformed repository hid EVERY badge.
  it.each([
    ['null body', null],
    ['undefined body', undefined],
    ['empty object', {}],
    ['a string', 'not json'],
    ['workflow_runs null', { workflow_runs: null }],
    ['workflow_runs not an array', { workflow_runs: { 0: {} } }],
    ['an API error object', { message: 'API rate limit exceeded' }],
  ])('degrades %s to unknown without throwing', (_label, body) => {
    const item = summarizeRepoRuns('repo', body)
    expect(item).toEqual({ repo: 'repo', display_status: 'unknown', run_at: '', html_url: '' })
  })

  it('the pre-fix indexing threw on the same payload', () => {
    expect(() => preFixSelection({ message: 'x' } as never)).toThrow()
  })

  it('reports unknown for a repository with no runs at all', () => {
    expect(summarizeRepoRuns('repo', { workflow_runs: [] }).display_status).toBe('unknown')
  })

  it('survives null entries inside the runs array', () => {
    const item = summarizeRepoRuns('repo', {
      workflow_runs: [null, AUTH_RUN_CI],
    })
    expect(item.display_status).toBe('green')
  })
})

/**
 * L-003 drift half: the hook's status vocabulary and the two components that
 * render it must agree. Each badge component keys three class/label maps by
 * `display_status`; a value the maps do not carry silently renders as
 * "Unknown", which is exactly the kind of silent degradation this increment
 * exists to remove. Reads BOTH sources rather than reconciling them once.
 */
describe('status vocabulary stays in sync with both badge components', () => {
  const HOOK_SRC = read('src/features/site/useGitHubBuildStatus.ts')

  const unionMembers = (): string[] => {
    const match = HOOK_SRC.match(/display_status:\s*((?:'[a-z]+'\s*\|\s*)*'[a-z]+')/)
    expect(match, 'display_status union not found in the hook source').toBeTruthy()
    return [...match![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  }

  const mapKeys = (src: string, name: string): string[] => {
    const start = src.indexOf(`const ${name}: Record<string, string> = {`)
    expect(start, `${name} not found`).toBeGreaterThan(-1)
    const body = src.slice(start, src.indexOf('\n}', start))
    return [...body.matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1])
  }

  // BuildStatusSection.tsx was the second consumer of this vocabulary until
  // v1.21.1 deleted it (D-4): it read the dead monitoring variable, not this
  // hook's GitHub data, and rendered null for every visitor. The assertion is
  // narrowed to the surviving consumer rather than dropped, so the hook's
  // display_status union and the badge maps still have to agree.
  const COMPONENTS = ['BuildStatusBadges.tsx'] as const
  const MAPS = ['DOT_CLASS', 'STATUS_TEXT', 'STATUS_CLASS'] as const

  it('the hook declares the four statuses the badges know how to render', () => {
    expect(unionMembers().sort()).toEqual(['green', 'red', 'unknown', 'yellow'])
  })

  it.each(COMPONENTS.flatMap((file) => MAPS.map((map) => [file, map] as const)))(
    '%s %s covers every status the hook can emit',
    (file, map) => {
      const keys = mapKeys(read(`src/features/site/${file}`), map)
      expect(keys.sort()).toEqual(unionMembers().sort())
    },
  )
})
