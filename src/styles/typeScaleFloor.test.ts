/**
 * Type-scale 12px floor (v1.18.4, D5).
 *
 * Finding F10 of the v1.18 UX audit (docs/design/V1_18_UX_THEME.md section
 * 2): the UI was dominated by 163 arbitrary `text-[10px]`/`text-[11px]`
 * occurrences across 44 files - undersized interface text with no named
 * step, sitting under a body default that had been raised to 18px to
 * compensate. This milestone returns the root size to 16px (src/index.css)
 * and raises real interface content onto `text-scale-xs` (var(--text-xs),
 * 0.75rem - exactly 12px at the new 16px root).
 *
 * This gate is the mechanism that keeps it fixed: a future arbitrary
 * `text-[10px]`/`text-[11px]` on real content is exactly F10 recurring one
 * component at a time. A tiny, explicit, commented allowlist covers the
 * handful of fixed-diameter decorative glyphs (a notification-count badge
 * capped at "9+", three single-character avatar-initial circles) where the
 * information is redundant with adjacent text and a 12px floor would not
 * fit the circle - matching the design doc's own "a small allowlist may
 * keep decorative kickers" allowance.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SIZE_PATTERN = /text-\[(10|11)px\]/g

/**
 * Files exempt from this gate, each with a reason a reviewer can check
 * without re-deriving it:
 *
 * - CrmAdminPage.tsx: explicitly fenced off from this milestone (2187 lines;
 *   docs/design/V1_18_UX_THEME.md section 8 names it as a scope-creep risk,
 *   and the v1.18.4 task scope confirms it must not be touched here).
 */
const EXEMPT_FILES = new Set(['src/pages/CrmAdminPage.tsx'])

/**
 * `file:line` locations deliberately kept below the floor: fixed-diameter
 * circular glyphs where the information is redundant with text right next
 * to them (an aria-label, a name, a strike-through state, a message
 * bubble's own side/colour), so growing the font would only risk overflow
 * without adding new information. Each site carries its own explanatory
 * comment; this is the enforceable half of that pair.
 */
const ALLOWLISTED_SITES = new Set([
  'src/features/notifications/NotificationBell.tsx:92', // 16px count badge, capped "9+", redundant with the button's aria-label
  'src/pages/PortalPage.tsx:513', // 16px checkbox glyph, redundant with strike-through + StatusBadge
  'src/pages/PortalPage.tsx:604', // 20px avatar-initial fallback, redundant with the adjacent name
  'src/pages/PortalPage.tsx:684', // 24px chat-avatar initial, redundant with the message bubble's side/colour
])

function allComponentFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allComponentFiles(relPath))
    else if (entry.name.endsWith('.tsx')) found.push(relPath)
  }
  return found.sort()
}

const COMPONENT_FILES = allComponentFiles().filter((f) => !EXEMPT_FILES.has(f))

/** Strips JS comments so a docstring's illustrative, backtick-quoted class
 * name (e.g. Badge.tsx's history note) is never mistaken for live usage.
 * The `(?<!:)` guard keeps `https://...` URLs inside string literals intact
 * - this codebase's line comments never themselves follow a `:`. A block
 * comment's newlines are kept (only its non-newline characters are erased)
 * so every line's number still matches the original file - collapsing a
 * multi-line `{/* ... *\/}` comment to '' would shift every later offender's
 * reported line number, which is exactly what corrupted this test's own
 * ALLOWLISTED_SITES line numbers on first write. */
function stripJsComments(source: string): string {
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
  return noBlockComments.replace(/(?<!:)\/\/.*$/gm, '')
}

describe('type-scale 12px floor: no arbitrary text-[10px]/text-[11px] on real content', () => {
  it('finds components to scan', () => {
    expect(COMPONENT_FILES.length).toBeGreaterThan(40)
  })

  it.each(COMPONENT_FILES)('%s uses no unlisted text-[10px]/text-[11px]', (relPath) => {
    const source = stripJsComments(readFileSync(path.join(ROOT, relPath), 'utf-8'))
    const lines = source.split('\n')
    const offenders: string[] = []
    lines.forEach((line, i) => {
      if (!SIZE_PATTERN.test(line)) return
      const site = `${relPath}:${i + 1}`
      if (!ALLOWLISTED_SITES.has(site)) offenders.push(site)
    })
    SIZE_PATTERN.lastIndex = 0
    expect(offenders).toEqual([])
  })

  it('every allowlisted site still exists and still needs the exemption', () => {
    // Guards the allowlist itself: a site that moved or was fixed should
    // drop out of ALLOWLISTED_SITES, or this test would pass vacuously
    // while quietly protecting a stale entry forever.
    for (const site of ALLOWLISTED_SITES) {
      const [relPath, lineStr] = site.split(':')
      const lineNo = Number(lineStr)
      const source = readFileSync(path.join(ROOT, relPath), 'utf-8').split('\n')
      const line = source[lineNo - 1] ?? ''
      expect(line, `${site} no longer contains an arbitrary 10/11px class - remove it from ALLOWLISTED_SITES`).toMatch(
        /text-\[(10|11)px\]/,
      )
    }
  })

  it('html root size returns to 16px (D5) so --text-xs resolves to exactly 12px', () => {
    const indexCss = readFileSync(path.join(ROOT, 'src/index.css'), 'utf-8')
    expect(/html\s*\{[^}]*font-size:\s*16px/.test(indexCss)).toBe(true)
  })
})
