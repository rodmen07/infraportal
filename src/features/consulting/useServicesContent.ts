import { useEffect, useState } from 'react'
import type { ServicesContent } from '../../types'

const DEFAULT: ServicesContent = {
  intro: 'End-to-end cloud engineering for startups that need to move fast without accumulating infrastructure debt.',
  services: [],
}

export function useServicesContent(baseUrl: string): ServicesContent {
  const [content, setContent] = useState<ServicesContent>(DEFAULT)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}content/services.json`)
        if (!res.ok) return
        const payload = (await res.json()) as ServicesContent
        setContent(payload)
      } catch {
        // noop - error loading services
      }
    }
    void load()
  }, [baseUrl])

  return content
}
