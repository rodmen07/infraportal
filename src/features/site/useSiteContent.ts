import { useEffect, useState } from 'react'
import type { SiteContent } from '../../types'

export function useSiteContent(baseUrl: string): SiteContent {
  const [content, setContent] = useState<SiteContent>({
    title: 'R.M. Cloud Consulting',
    subtitle: 'Clean cloud architectures for early-stage startups.',
  })

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch(`${baseUrl}content/site.json`)
        if (!response.ok) return

        const payload = (await response.json()) as SiteContent
        setContent({
          title: payload.title || 'R.M. Cloud Consulting',
          subtitle: payload.subtitle || '',
        })
      } catch {
      }
    }

    void loadContent()
  }, [baseUrl])

  useEffect(() => {
    if (content.title.trim()) {
      document.title = content.title
    }
  }, [content.title])

  return content
}
