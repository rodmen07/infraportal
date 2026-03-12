import { useState, useEffect } from 'react'
import { MONITORING_URL } from '../../config'

export type BuildStatusItem = {
  repo: string
  display_status: 'green' | 'yellow' | 'red' | 'unknown'
  run_at: string
  html_url: string
  cached: boolean
}

export type BuildStatusState =
  | { phase: 'disabled' }
  | { phase: 'loading' }
  | { phase: 'ready'; items: BuildStatusItem[] }
  | { phase: 'error' }

export function useBuildStatus(): BuildStatusState {
  const [state, setState] = useState<BuildStatusState>(
    MONITORING_URL ? { phase: 'loading' } : { phase: 'disabled' }
  )

  useEffect(() => {
    if (!MONITORING_URL) return

    let timer: ReturnType<typeof setInterval>
    let controller: AbortController

    const load = async () => {
      controller = new AbortController()
      try {
        const res = await fetch(`${MONITORING_URL}/api/builds`, {
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const items: BuildStatusItem[] = await res.json()
        setState({ phase: 'ready', items })
      } catch {
        setState({ phase: 'error' })
      }
    }

    load()
    timer = setInterval(load, 60_000)

    return () => {
      clearInterval(timer)
      controller?.abort()
    }
  }, [])

  return state
}
