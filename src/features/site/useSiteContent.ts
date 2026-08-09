import { useEffect, useState } from 'react'
import type { SiteContent } from '../../types'

export function useSiteContent(baseUrl: string): SiteContent {
  const [content, setContent] = useState<SiteContent>({
    title: 'R.M. Cloud Consulting',
    subtitle: 'Clean cloud architectures for early-stage startups.',
    heroTagline: 'AI + Cloud Launchpad',
  })

  // The `active` lifetime flag (v1.23.3, D-13; the `usePricingContent`
  // template): a response arriving after unmount, or after `baseUrl` changed
  // and this effect instance was cleaned up, must not write state. Without it
  // a stale response can overwrite fresher content - and for THIS hook the
  // write is doubly live, because the title effect below then pushes the stale
  // title into `document.title`. Guarded by useContentHooks.test.ts.
  useEffect(() => {
    let active = true

    const loadContent = async () => {
      try {
        const response = await fetch(`${baseUrl}content/site.json`)
        if (!response.ok) return

        const payload = (await response.json()) as SiteContent
        if (!active) return
        setContent({
          title: payload.title || 'R.M. Cloud Consulting',
          subtitle: payload.subtitle || '',
          heroTagline: payload.heroTagline || 'AI + Cloud Launchpad',
        })
      } catch {
        // noop - error loading site content
      }
    }

    void loadContent()

    return () => {
      active = false
    }
  }, [baseUrl])

  useEffect(() => {
    if (content.title.trim()) {
      document.title = content.title
    }
  }, [content.title])

  return content
}
