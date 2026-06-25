import { useState, useEffect } from 'react'

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
}

type GhRunsResponse = {
  workflow_runs: GhRun[]
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

async function fetchRepo(owner: string, repo: string): Promise<GhBuildItem> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`,
    {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    },
  )
  if (!res.ok) {
    return { repo, display_status: 'unknown', run_at: '', html_url: '' }
  }
  const data: GhRunsResponse = await res.json()
  const run = data.workflow_runs[0]
  return {
    repo,
    display_status: mapStatus(run),
    run_at: run?.created_at ?? '',
    html_url: run?.html_url ?? '',
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
