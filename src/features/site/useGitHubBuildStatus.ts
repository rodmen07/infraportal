import { useState, useEffect } from 'react'

/**
 * Live CI status for the public case-study badges.
 *
 * WHAT WENT WRONG (BADGE-BRANCH-1, found 2026-07-26 by a QA adversarial review
 * of the proof surfaces, fixed here). The badge renders "Live CI/CD ... Passing
 * / Failed" per repository on `#/case-studies/microservices`, but the query
 * feeding it asked GitHub for `actions/runs?per_page=1` with NO filters, which
 * returns the newest run in the repository across every branch, every workflow
 * and every trigger. Three distinct ways that answers a different question than
 * the badge asks, all three observed live on 2026-07-26:
 *
 *   1. PULL-REQUEST BRANCHES. `infraportal`'s newest run belonged to
 *      `dependabot/github_actions/codecov/codecov-action-7`, and at 03:29:04Z
 *      the newest run in the whole repository was a FAILURE on
 *      `dependabot/npm_and_yarn/vitest/coverage-v8-4.1.10`. The public page
 *      would have told a visitor that this very site's build had failed while
 *      `main` was green and deployed. Fixed by the `branch` filter below.
 *
 *   2. BOT METADATA RUNS. Dependabot's own dependency-update jobs are attributed
 *      to the `dynamic` event and are recorded ON THE DEFAULT BRANCH, so a
 *      branch filter alone does not remove them. `observaboard`'s newest run was
 *      one of these. They are not CI and must never colour the badge.
 *
 *   3. ARBITRARY WORKFLOW. One push fans out to every workflow, and those runs
 *      share a `created_at` to the second. `auth-service`'s newest commit
 *      (`e550e24`) produced CI=success, Deploy Cloud Run=success and Deploy
 *      Fly=FAILURE at the same instant; `per_page=1` returned a different one of
 *      the three depending on which query was issued, so the badge was a coin
 *      flip between "Passing" and "Failed" on identical data.
 *
 * The fix answers the question the badge actually asks -- "is the default branch
 * healthy?" -- by reading a page of default-branch runs, discarding bot
 * metadata, and aggregating every workflow that ran for the newest COMMIT.
 * Where the answer cannot be established it is `unknown`, never a guess: the
 * same principle `useLiveServices` adopted for the home-page service count,
 * because a confidently wrong badge is worse than an honest blank one.
 */

export type GhBuildItem = {
  repo: string
  display_status: 'green' | 'yellow' | 'red' | 'unknown'
  run_at: string
  html_url: string
}

export type GhBuildState =
  | { phase: 'loading' }
  | { phase: 'ready'; items: GhBuildItem[] }
  | { phase: 'error' }

type GhRun = {
  status: string
  conclusion: string | null
  html_url: string
  created_at: string
  /** Present on every real API response; optional so older fixtures still type. */
  event?: string
  head_sha?: string
}

type GhRunsResponse = {
  workflow_runs: GhRun[]
}

/**
 * The branch whose health the badge claims to report. Verified 2026-07-26 with
 * `gh api repos/rodmen07/<repo> --jq .default_branch` for all seven repositories
 * the microservices case study names: every one is `main`.
 */
export const DEFAULT_BRANCH = 'main'

/**
 * Runs read per repository. The newest commit fans out to one run per workflow
 * (auth-service fires three), and Dependabot interleaves metadata runs on the
 * same branch, so a page of ten finds every run belonging to the newest commit
 * without costing a second request.
 */
export const RUNS_PER_PAGE = 10

/** GitHub's event name for a bot's internal dependency-update job. Not CI. */
const BOT_METADATA_EVENT = 'dynamic'

const unknownItem = (repo: string): GhBuildItem => ({
  repo,
  display_status: 'unknown',
  run_at: '',
  html_url: '',
})

/**
 * The API query for a repository's default-branch CI history.
 *
 * The `branch` parameter is the half of the fix GitHub can enforce for us;
 * `dynamic` runs still have to be dropped client-side (see `summarizeRepoRuns`)
 * because they carry the default branch as their own `head_branch`.
 */
export function defaultBranchRunsUrl(
  owner: string,
  repo: string,
  branch: string = DEFAULT_BRANCH,
): string {
  const query = new URLSearchParams({ branch, per_page: String(RUNS_PER_PAGE) })
  return (
    `https://api.github.com/repos/${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/actions/runs?${query.toString()}`
  )
}

export function mapStatus(run: GhRun | undefined): GhBuildItem['display_status'] {
  if (!run) return 'unknown'
  if (run.status === 'queued' || run.status === 'in_progress') return 'yellow'
  if (run.status === 'completed') {
    if (run.conclusion === 'success' || run.conclusion === 'skipped') return 'green'
    return 'red'
  }
  return 'unknown'
}

const startedAt = (run: GhRun): number => {
  const parsed = Date.parse(run?.created_at ?? '')
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Reduce a raw `actions/runs` payload to one honest badge.
 *
 * Pure, so the half that was live and untested for 136 days is testable without
 * a network or a DOM. Never throws: the previous code indexed
 * `data.workflow_runs[0]` directly, so any 200 response that was not the
 * expected shape threw inside `Promise.all` and hid EVERY badge in the section,
 * not just the offending repository's.
 */
export function summarizeRepoRuns(repo: string, body: unknown): GhBuildItem {
  const runs = (body as GhRunsResponse | null | undefined)?.workflow_runs
  if (!Array.isArray(runs)) return unknownItem(repo)

  const ciRuns = runs.filter(
    (run): run is GhRun =>
      !!run && typeof run === 'object' && run.event !== BOT_METADATA_EVENT,
  )
  if (ciRuns.length === 0) return unknownItem(repo)

  const newest = ciRuns.reduce((a, b) => (startedAt(b) > startedAt(a) ? b : a))

  // Every workflow triggered by the same commit, so a green CI run can no
  // longer mask a failed deploy that fired at the same second.
  const commitRuns = newest.head_sha
    ? ciRuns.filter((run) => run.head_sha === newest.head_sha)
    : [newest]

  const statuses = commitRuns.map((run) => mapStatus(run))
  const display_status: GhBuildItem['display_status'] = statuses.includes('red')
    ? 'red'
    : statuses.includes('yellow')
      ? 'yellow'
      : statuses.includes('green')
        ? 'green'
        : 'unknown'

  // Link to the run that decided the colour, so "Failed" opens the failure.
  const decisive = commitRuns.find((run) => mapStatus(run) === display_status) ?? newest

  return {
    repo,
    display_status,
    run_at: newest.created_at ?? '',
    html_url: decisive.html_url ?? '',
  }
}

async function fetchRepo(owner: string, repo: string): Promise<GhBuildItem> {
  try {
    const res = await fetch(defaultBranchRunsUrl(owner, repo), {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return unknownItem(repo)
    return summarizeRepoRuns(repo, await res.json())
  } catch {
    // One unreachable or malformed repository degrades to `unknown` on its own
    // badge instead of rejecting Promise.all and blanking the whole section.
    return unknownItem(repo)
  }
}

export function useGitHubBuildStatus(owner: string, repos: string[]): GhBuildState {
  const reposKey = repos.join(',')
  const [state, setState] = useState<GhBuildState>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState({ phase: 'loading' })
      try {
        const items = await Promise.all(repos.map((r) => fetchRepo(owner, r)))
        if (!cancelled) setState({ phase: 'ready', items })
      } catch {
        if (!cancelled) setState({ phase: 'error' })
      }
    }

    load()
    const timer = setInterval(load, 120_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, reposKey])

  return state
}
