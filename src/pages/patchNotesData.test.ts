/**
 * Sanity checks over the patch notes data (src/pages/patchNotesData.ts).
 * The page renders this structure directly, so malformed entries are
 * user-visible: duplicate tags break React keys, unknown groups render no
 * header, and non-contiguous groups render duplicate headers.
 */
import { describe, it, expect } from 'vitest'
import { GROUP_META, VERSIONS } from './patchNotesData'

describe('patch notes data', () => {
  it('has at least one entry and unique version tags', () => {
    expect(VERSIONS.length).toBeGreaterThan(0)
    const tags = VERSIONS.map((v) => v.tag)
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('uses well-formed tags and ISO dates on every entry', () => {
    for (const version of VERSIONS) {
      expect(version.tag, version.tag).toMatch(/^v\d+\.\d+(\.\d+)?(-v\d+\.\d+(\.\d+)?)?$/)
      expect(version.date, version.tag).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(version.date)), version.tag).toBe(false)
    }
  })

  it('has non-empty label, summary, and highlight items on every entry', () => {
    for (const version of VERSIONS) {
      expect(version.label.trim(), version.tag).not.toBe('')
      expect(version.summary.trim(), version.tag).not.toBe('')
      expect(version.highlights.length, version.tag).toBeGreaterThan(0)
      for (const highlight of version.highlights) {
        expect(highlight.heading.trim(), version.tag).not.toBe('')
        expect(highlight.items.length, version.tag).toBeGreaterThan(0)
        for (const item of highlight.items) {
          expect(item.trim(), version.tag).not.toBe('')
        }
      }
    }
  })

  it('references only groups that exist in GROUP_META', () => {
    for (const version of VERSIONS) {
      if (version.group) {
        expect(GROUP_META[version.group], `${version.tag} group ${version.group}`).toBeDefined()
      }
    }
  })

  it('keeps each group contiguous so the page renders one header per group', () => {
    const seen = new Set<string>()
    let current: string | undefined
    for (const version of VERSIONS) {
      if (version.group !== current) {
        if (version.group) {
          expect(seen.has(version.group), `group ${version.group} appears twice non-contiguously`).toBe(false)
          seen.add(version.group)
        }
        current = version.group
      }
    }
  })

  it('records the v1.16 consolidated release and all four v1.17 playground milestones', () => {
    const byTag = new Map(VERSIONS.map((v) => [v.tag, v]))
    for (const tag of ['v1.16', 'v1.17.1', 'v1.17.2', 'v1.17.3', 'v1.17.4']) {
      const entry = byTag.get(tag)
      expect(entry, tag).toBeDefined()
      expect(entry!.date, tag).toMatch(/^2026-07-1[89]$/)
    }
    expect(byTag.get('v1.16')!.group).toBe('v1.16')
    expect(byTag.get('v1.17.4')!.group).toBe('v1.17')
    expect(GROUP_META['v1.17'].label).toBe('Interactive API Playground')
    // Newest first: the wrap-up milestone leads the list.
    expect(VERSIONS[0].tag).toBe('v1.17.4')
  })
})
