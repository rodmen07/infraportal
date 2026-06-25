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
  const monitoringUrl = MONITORING_URL.replace(/\/$/, '')

  useEffect(() => {
    if (!monitoringUrl) return

    let active = true
    let inFlightController: AbortController | null = null
    const timer = setInterval(() => {
      void load()
    }, 60_000)

    const load = async () => {
      inFlightController?.abort()
      const controller = new AbortController()
      inFlightController = controller
      try {
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(`${monitoringUrl}/api/builds`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        clearTimeout(timeoutId)

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const items: BuildStatusItem[] = await res.json()
        if (active) setState({ phase: 'ready', items })
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ phase: 'error' })
        }
      }
    }

    void load()

    return () => {
      active = false
      clearInterval(timer)
      inFlightController?.abort()
    }
  }, [monitoringUrl])

  return state
}
