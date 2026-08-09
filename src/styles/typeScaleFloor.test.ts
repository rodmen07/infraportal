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
/**
 * Deliberately NOT global. A `g` regex's `lastIndex` persists across
 * `.test()` calls on DIFFERENT strings, so after a successful match the next
 * line's scan starts at the previous match's end offset and a real offender
 * at an earlier column on the very next line is silently skipped (filed
 * 2026-07-20, fixed 2026-07-26). The "scanner regression" block below locks
 * both the flag and the behavior.
 */
const SIZE_PATTERN = /text-\[(10|11)px\]/

/**
 * Files exempt from this gate, each with a reason a reviewer can check
 * without re-deriving it:
 *
 * - CrmAdminPage.tsx: explicitly fenced off from this milestone (2187 lines;
 *   docs/design/V1_18_UX_THEME.md section 8 names it as a scope-creep risk,
 *   and the v1.18.4 task scope confirms it must not be touched here).
 * - features/crm/{ui,LiveFeedTab,ProjectsTab}.tsx: hold the sub-12px classes
 *   moved verbatim out of CrmAdminPage.tsx by the behavior-preserving CRM
 *   admin split. The exemption follows the relocated code unchanged - these
 *   are the same fenced-off lines, not new content, so the same v1.18.4
 *   scope-creep fence still applies to them.
 */
const EXEMPT_FILES = new Set([
  'src/pages/CrmAdminPage.tsx',
  'src/features/crm/ui.tsx',
  'src/features/crm/LiveFeedTab.tsx',
  'src/features/crm/ProjectsTab.tsx',
])

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
  'src/features/portal/projectDetail.tsx:218', // 16px checkbox glyph, redundant with strike-through + StatusBadge
  'src/features/portal/projectDetail.tsx:309', // 20px avatar-initial fallback, redundant with the adjacent name
  // Was :389 until v1.25.2 (PR for D-19) added the `onSend: Promise<boolean>`
  // contract docstring above MessageThread, shifting this site down 10 lines.
  // The allowlist is keyed by file:line, so a fix in the same FILE moves it —
  // this entry belongs to whichever commit moves the disk, not to a later one.
  'src/features/portal/projectDetail.tsx:399', // 24px chat-avatar initial, redundant with the message bubble's side/colour
])

/**
 * `.tsx` plus non-test `.ts` (SWEEP-TSX-ONLY-1; was `.tsx`-only until
 * 2026-08-08). An undersized text class in a plain-.ts class registry (the
 * src/features/crm/vocabulary.ts consumption pattern) reaches rendered text
 * exactly as a component's own literal does, so "rendered text" is not a
 * JSX-scoped subject. Measured at widening time: zero sub-floor sizes in any
 * non-test `.ts` file, so this changes findings by nothing today and exists
 * to keep the registry pattern visible tomorrow.
 */
function allSourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allSourceFiles(relPath))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(relPath)
  }
  return found.sort()
}

const SOURCE_FILES = allSourceFiles().filter((f) => !EXEMPT_FILES.has(f))

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
  it('finds source files to scan, including the non-test .ts half', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(40)
    // The widened half's own non-vacuity floor (SWEEP-TSX-ONLY-1, mirroring
    // colorThemeCoverage.test.ts): a filter edit that silently drops plain
    // .ts modules must fail here, not narrow the sweep quietly.
    expect(SOURCE_FILES.filter((rel) => rel.endsWith('.ts')).length).toBeGreaterThan(0)
  })

  it.each(SOURCE_FILES)('%s uses no unlisted text-[10px]/text-[11px]', (relPath) => {
    const source = stripJsComments(readFileSync(path.join(ROOT, relPath), 'utf-8'))
    const lines = source.split('\n')
    const offenders: string[] = []
    lines.forEach((line, i) => {
      if (!SIZE_PATTERN.test(line)) return
      const site = `${relPath}:${i + 1}`
      if (!ALLOWLISTED_SITES.has(site)) offenders.push(site)
    })
    expect(offenders).toEqual([])
  })

  describe('scanner regression: the per-line pattern must not carry the g flag', () => {
    /**
     * Filed 2026-07-20, fixed 2026-07-26: SIZE_PATTERN was declared with /g
     * and reused across `.test()` calls inside the per-file line loop. On a
     * global regex, `.test()` starts at `lastIndex` and advances it past
     * each match, and `lastIndex` carries over between calls on DIFFERENT
     * strings - so after any successful match, the next line was scanned
     * from the previous match's end offset, and an offender at an earlier
     * column there returned false and was silently dropped. The old
     * `SIZE_PATTERN.lastIndex = 0` after the loop only protected the next
     * FILE, never the next line. The riskiest real shape: an offender on
     * the line directly after an ALLOWLISTED site (whose match also
     * advanced lastIndex) was invisible to this gate.
     *
     * Fixture: line 0 matches near column 110; line 1 is shorter than that
     * offset and carries a real offender at an early column.
     */
    const CONSECUTIVE_OFFENDER_LINES = [
      '<span className="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">',
      '<em className="text-[11px] uppercase">kicker</em>',
    ]

    it('documents the defect: the retired /g pattern misses the offender on the line after a match', () => {
      const retiredPattern = /text-\[(10|11)px\]/g
      const caught: number[] = []
      CONSECUTIVE_OFFENDER_LINES.forEach((line, i) => {
        if (retiredPattern.test(line)) caught.push(i)
      })
      expect(
        caught,
        'the retired global pattern should catch line 0 and then silently miss line 1 - if this fails, the fixture no longer reproduces the defect',
      ).toEqual([0])
    })

    it('the live pattern catches both consecutive offenders', () => {
      const caught: number[] = []
      CONSECUTIVE_OFFENDER_LINES.forEach((line, i) => {
        if (SIZE_PATTERN.test(line)) caught.push(i)
      })
      expect(
        caught,
        'SIZE_PATTERN missed a consecutive-line offender - the g flag (or equivalent shared state) is back',
      ).toEqual([0, 1])
    })

    it('SIZE_PATTERN is not global, so .test() cannot carry state between lines', () => {
      expect(
        SIZE_PATTERN.global,
        'SIZE_PATTERN must not use the g flag: .test() on a global regex resumes from lastIndex and skips offenders on subsequent lines',
      ).toBe(false)
    })
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
