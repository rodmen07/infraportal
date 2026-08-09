import { useEffect, useState } from 'react'
import type { HomeSectionsContent } from '../../types'

const DEFAULT_HOME_SECTIONS: HomeSectionsContent = {
  title: 'What I help with',
  cards: [
    {
      heading: 'Cloud Architecture',
      body: 'Right-sized AWS and GCP setups with Terraform-first infrastructure and Databricks-ready data patterns, plus Azure-ready expansion paths. No over-engineering, no vendor lock-in.',
    },
  ],
}

function resolveMediaUrl(baseUrl: string, value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  return `${normalizedBase}${normalizedPath}`
}

export function useHomeSectionsContent(baseUrl: string): HomeSectionsContent {
  const [content, setContent] = useState<HomeSectionsContent>(DEFAULT_HOME_SECTIONS)

  // The `active` lifetime flag (v1.23.3, D-13; the `usePricingContent`
  // template): a response arriving after unmount, or after `baseUrl` changed
  // and this effect instance was cleaned up, cannot write state, so a stale
  // response can never overwrite fresher content. Guarded by
  // useContentHooks.test.ts.
  useEffect(() => {
    let active = true

    const loadContent = async () => {
      try {
        const response = await fetch(`${baseUrl}content/home_sections.json`)
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as HomeSectionsContent
        if (!active) return
        setContent({
          title: payload.title || DEFAULT_HOME_SECTIONS.title,
          cards: Array.isArray(payload.cards)
            ? payload.cards
                .filter((card) => card && card.heading && card.body)
                .map((card) => ({
                  heading: card.heading,
                  body: card.body,
                  image: resolveMediaUrl(baseUrl, card.image),
                  link: card.link ?? undefined,
                }))
            : DEFAULT_HOME_SECTIONS.cards,
        })
      } catch {
        // noop - error loading home sections
      }
    }

    void loadContent()

    return () => {
      active = false
    }
  }, [baseUrl])

  return content
}
