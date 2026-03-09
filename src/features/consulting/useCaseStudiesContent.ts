import { useEffect, useState } from 'react'
import type { CaseStudiesContent } from '../../types'

const DEFAULT: CaseStudiesContent = {
  intro: 'Real systems, shipped to production.',
  featured: {
    title: '',
    subtitle: '',
    description: '',
    techStack: [],
    highlights: [],
  },
  others: [],
}

export function useCaseStudiesContent(baseUrl: string): CaseStudiesContent {
  const [content, setContent] = useState<CaseStudiesContent>(DEFAULT)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}content/case_studies.json`)
        if (!res.ok) return
        const payload = (await res.json()) as CaseStudiesContent
        setContent(payload)
      } catch {
      }
    }
    void load()
  }, [baseUrl])

  return content
}
