import { useEffect, useState } from 'react'
import type { SiteContent } from '../../types'

function toBaseAwareHref(href: string, baseUrl: string): string {
  if (!href) {
    return `${baseUrl}admin/`
  }

  if (/^https?:\/\//.test(href)) {
    return href
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedHref = href.startsWith('/') ? href.slice(1) : href
  return `${normalizedBase}${normalizedHref}`
}

export function useSiteContent(baseUrl: string): SiteContent {
  const [content, setContent] = useState<SiteContent>({
    title: 'TaskForge',
    subtitle: 'Loading content from CMS…',
    ctaLabel: 'Open CMS',
    ctaHref: `${baseUrl}admin/`,
  })

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch(`${baseUrl}content/site.json`)
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as SiteContent
        setContent({
          ...payload,
          ctaHref: toBaseAwareHref(payload.ctaHref, baseUrl),
        })
      } catch {
      }
    }

    loadContent()
  }, [baseUrl])

  useEffect(() => {
    if (content.title.trim()) {
      document.title = content.title
    }
  }, [content.title])

  return content
}
