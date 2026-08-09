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

/**
 * True when a decoded payload is shaped like `CaseStudiesContent`.
 *
 * The sibling of the `usePricingContent` guard (QA 2026-08-01, L-015: a
 * typed-decode defect is never singular). `as CaseStudiesContent` is a claim
 * about untrusted bytes, not a check: a valid-JSON body missing `others` or
 * `featured` replaced the default wholesale, and `CaseStudiesPage`'s
 * `others.length` / `featured.title` then threw into the root error boundary.
 * `contentContract.test.ts` guards the COMMITTED file; this guards what the
 * browser is actually handed at runtime.
 */
function isCaseStudiesContent(payload: unknown): payload is CaseStudiesContent {
  if (typeof payload !== 'object' || payload === null) return false
  const candidate = payload as CaseStudiesContent
  return Array.isArray(candidate.others) && typeof candidate.featured === 'object' && candidate.featured !== null
}

export function useCaseStudiesContent(baseUrl: string): CaseStudiesContent {
  const [content, setContent] = useState<CaseStudiesContent>(DEFAULT)

  // The `active` lifetime flag (v1.23.3, D-13; the `usePricingContent`
  // template): a response arriving after unmount, or after `baseUrl` changed
  // and this effect instance was cleaned up, cannot write state, so a stale
  // response can never overwrite fresher content. Guarded by
  // useContentHooks.test.ts.
  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}content/case_studies.json`)
        if (!res.ok) return
        const payload: unknown = await res.json()
        if (active && isCaseStudiesContent(payload)) setContent(payload)
      } catch {
        // noop - error loading case studies
      }
    }
    void load()

    return () => {
      active = false
    }
  }, [baseUrl])

  return content
}
