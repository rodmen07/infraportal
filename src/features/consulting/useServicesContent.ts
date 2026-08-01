import { useEffect, useState } from 'react'
import type { ServicesContent } from '../../types'

const DEFAULT: ServicesContent = {
  intro: 'End-to-end cloud engineering for startups that need to move fast without accumulating infrastructure debt.',
  services: [],
}

/**
 * True when a decoded payload is shaped like `ServicesContent`. The third of
 * the typed-decode siblings (QA 2026-08-01, L-015): without it a valid-JSON
 * body missing `services` replaced the default wholesale and `ServicesPage`'s
 * `services.length` threw into the root error boundary.
 */
function isServicesContent(payload: unknown): payload is ServicesContent {
  return typeof payload === 'object' && payload !== null && Array.isArray((payload as ServicesContent).services)
}

export function useServicesContent(baseUrl: string): ServicesContent {
  const [content, setContent] = useState<ServicesContent>(DEFAULT)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}content/services.json`)
        if (!res.ok) return
        const payload: unknown = await res.json()
        if (isServicesContent(payload)) setContent(payload)
      } catch {
        // noop - error loading services
      }
    }
    void load()
  }, [baseUrl])

  return content
}
