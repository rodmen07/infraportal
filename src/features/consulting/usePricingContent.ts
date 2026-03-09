import { useEffect, useState } from 'react'
import type { PricingContent } from '../../types'

const DEFAULT: PricingContent = {
  note: 'All engagements start with a free 30-minute discovery call.',
  tiers: [],
}

export function usePricingContent(baseUrl: string): PricingContent {
  const [content, setContent] = useState<PricingContent>(DEFAULT)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}content/pricing.json`)
        if (!res.ok) return
        const payload = (await res.json()) as PricingContent
        setContent(payload)
      } catch {
      }
    }
    void load()
  }, [baseUrl])

  return content
}
