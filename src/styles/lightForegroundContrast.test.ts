/**
 * v1.26.1 (ROADMAP.md D-22): the six sub-2:1 light-mode foregrounds stay fixed.
 *
 * This app is authored dark-first. Light is not a second authored theme, it is
 * a patch: src/index.css carries ~200 `[data-theme="light"]` override rules and
 * zero `[data-theme="dark"]` ones, so every dark-authored Tailwind palette
 * utility needs a hand-written light twin. `opacityColorThemeCoverage.test.ts`
 * checks a third of that surface and checks it by RULE EXISTENCE; six
 * foregrounds fell through both gaps and rendered between 1.02:1 and 1.74:1 on
 * this repo's own light card fill - `text-zinc-50` on AuditPage's empty-state
 * heading was a literally invisible `<h3>`.
 *
 * Why this file computes contrast instead of checking that an override exists,
 * which is the whole of D-22: rule existence is wrong in BOTH directions. Three
 * of the uncovered foregrounds in the same v1.26 measurement (`text-zinc-600`
 * 7.28:1, `placeholder-zinc-500` 4.55:1, `text-zinc-900` 16.68:1) need nothing
 * at all, so existence would demand three pointless overrides against a ratchet
 * with no headroom - while an override that EXISTS but is wrong (a pastel
 * replaced by another pastel) passes existence and still ships an unreadable
 * heading. A ratio catches both.
 *
 * Nothing here is transcribed from ROADMAP.md's measurement table, and that is
 * deliberate - that table is a 2026-08-08 snapshot, and a guard that inherits
 * its numbers proves only that someone could copy. Everything is derived:
 *
 *   - the surface it measures against comes from src/styles/tokens.css's real
 *     `[data-theme="light"]` block, composited (--surface-2 is translucent, so
 *     the naive #f8f8f8 reading of it is wrong by itself);
 *   - the colour a class resolves to comes from src/index.css's override sheet
 *     when a rule exists, and otherwise from the Tailwind palette;
 *   - the palette is imported from the installed `tailwindcss` package, never
 *     a hand-copied hex table, so this file cannot disagree with what Tailwind
 *     actually compiles;
 *   - the consumer list is discovered by scanning src/**\/*.tsx on disk.
 *
 * The six are named explicitly because they are this slice's scope, not its
 * evidence. Widening the scan to every colour-bearing utility is v1.26.3
 * (D-21/D-22/D-23/D-25) and deliberately lands AFTER v1.26.2 retires the JS
 * theming path, because `text-amber-600` in PricingFaq.tsx is light-AUTHORED
 * and would redden a repo-wide sweep run today. The pure helpers below are
 * exported so that widening can reuse this exact arithmetic rather than write
 * a second, subtly different copy of it - two scanners with two scopes is
 * precisely how NotificationBell's chip got its fill checked and its text not.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import colors from 'tailwindcss/colors.js'

const ROOT = process.cwd()
const INDEX_CSS = stripCssComments(readFileSync(path.join(ROOT, 'src/index.css'), 'utf-8'))
const TOKENS_CSS = stripCssComments(readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf-8'))

/** WCAG AA for normal-size text. Every class in this file's scope is body copy,
 * a heading, or a badge label, never a >=24px/>=18.66px-bold large-text case. */
const AA_NORMAL_TEXT = 4.5

/**
 * The six foregrounds v1.26.1 owns, with the route each one took.
 *
 * `token` is the Tailwind class as it appears in JSX, variant prefix included -
 * `hover:text-amber-200`, never `text-amber-200`, because Tailwind compiles a
 * variant to a different selector entirely and collapsing them is exactly the
 * silent-pass bug opacityColorThemeCoverage.test.ts was rewritten to fix.
 *
 * `route` records WHY each landed where it did and is asserted, not decorative:
 * 'token' classes must have left the repo (a semantic text token carries both
 * themes, so re-introducing the raw class re-introduces the defect), 'override'
 * classes must still resolve above the bar in light.
 */
const V1_26_1_FOREGROUNDS = [
  { token: 'text-zinc-50', route: 'token', landedOn: 'text-primary' },
  { token: 'hover:text-amber-200', route: 'token', landedOn: 'accent-text' },
  { token: 'hover:text-emerald-300', route: 'token', landedOn: 'success' },
  { token: 'text-cyan-300', route: 'override', landedOn: null },
  { token: 'text-purple-300', route: 'override', landedOn: null },
  { token: 'text-violet-300', route: 'override', landedOn: null },
] as const

/* -------------------------------------------------------------------------
   Pure colour arithmetic. Exported for v1.26.3's widened scanner.
   ------------------------------------------------------------------------- */

export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

export type Rgba = readonly [number, number, number, number]

/** `#rgb`, `#rrggbb`, `rgb(...)` and `rgba(...)` - every form these two
 * stylesheets actually use. Anything else throws rather than defaulting to a
 * colour, because a silently-substituted black would PASS this test on a light
 * surface and hide the exact defect it exists to catch. */
export function parseCssColor(value: string): Rgba {
  const v = value.trim()
  const hex6 = /^#([0-9a-f]{6})$/i.exec(v)
  if (hex6) {
    const n = parseInt(hex6[1], 16)
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 1]
  }
  const hex3 = /^#([0-9a-f]{3})$/i.exec(v)
  if (hex3) {
    const [r, g, b] = hex3[1].split('')
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), 1]
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(v)
  if (fn) {
    const parts = fn[1].split(',').map((p) => Number(p.trim()))
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) {
      throw new Error(`unparseable rgb()/rgba() colour: "${value}"`)
    }
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
  }
  throw new Error(`unparseable CSS colour: "${value}"`)
}

/** Source-over composite of a (possibly translucent) colour onto an opaque
 * backdrop. Both light surface tokens here are translucent, so skipping this
 * step measures against a colour that never reaches a screen. */
export function compositeOver(top: Rgba, backdrop: Rgba): Rgba {
  const a = top[3]
  return [
    top[0] * a + backdrop[0] * (1 - a),
    top[1] * a + backdrop[1] * (1 - a),
    top[2] * a + backdrop[2] * (1 - a),
    1,
  ]
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG 2.x contrast ratio, 1:1 to 21:1. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/* -------------------------------------------------------------------------
   Reading this repo's real stylesheets.
   ------------------------------------------------------------------------- */

/** The body of tokens.css's `:root, [data-theme="dark"]` or
 * `[data-theme="light"]` custom-property block.
 *
 * The selector must be matched at the START OF A LINE: tokens.css's header
 * prose mentions `[data-theme="light"]` several times, and an indexOf that
 * ignores that lands inside the comment and then slices out the DARK block -
 * which reads as a plausible result (every token resolves, every ratio is
 * high) while measuring the wrong theme entirely. Comments are stripped above,
 * and the extracted block is sanity-checked by the caller. */
function tokenBlock(theme: 'light' | 'dark'): string {
  const pattern = theme === 'light' ? /^\[data-theme="light"\]\s*\{/m : /^:root,\s*\n?\[data-theme="dark"\]\s*\{/m
  const match = pattern.exec(TOKENS_CSS)
  if (match === null) throw new Error(`tokens.css has no ${theme}-theme custom-property block`)
  const start = match.index
  const end = TOKENS_CSS.indexOf('\n}', start)
  if (end === -1) throw new Error(`tokens.css's ${theme} block is unterminated`)
  return TOKENS_CSS.slice(start, end)
}

const THEME_BLOCKS = { light: tokenBlock('light'), dark: tokenBlock('dark') } as const

export function cssVariable(theme: 'light' | 'dark', name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(THEME_BLOCKS[theme])
  if (match === null) throw new Error(`tokens.css's ${theme} block does not define --${name}`)
  return match[1].trim()
}

/** The colour a card/panel fill actually presents to the eye in `theme`:
 * --surface-2 (the elevated panel/modal fill, which is what AuditPage's
 * `surface-card-strong` empty state uses) composited onto the opaque page
 * background --surface-0. */
export function surfaceBackdrop(theme: 'light' | 'dark'): Rgba {
  return compositeOver(parseCssColor(cssVariable(theme, 'surface-2')), parseCssColor(cssVariable(theme, 'surface-0')))
}

const VARIANT_SELECTOR_SUFFIX: Record<string, string> = { hover: ':hover', focus: ':focus', open: '[open]' }

/** The exact selector src/index.css must declare to override `token` in light,
 * matching opacityColorThemeCoverage.test.ts's construction so the two files
 * cannot disagree about what "has an override" means. */
function lightOverrideSelectorFor(token: string): string {
  const lastColon = token.lastIndexOf(':')
  const variant = lastColon === -1 ? null : token.slice(0, lastColon)
  let suffix = ''
  if (variant !== null) {
    const known = VARIANT_SELECTOR_SUFFIX[variant]
    if (known === undefined) {
      throw new Error(
        `lightForegroundContrast.test.ts does not know how Tailwind compiles the "${variant}:" variant ` +
          `(used by "${token}"). Add it to VARIANT_SELECTOR_SUFFIX here and to the matching map in ` +
          'opacityColorThemeCoverage.test.ts - guessing is how a prior fix silently no-opped for every ' +
          'real hover:-only consumer of a class.',
      )
    }
    suffix = known
  }
  const escaped = token.replace(/:/g, '\\:').replace(/\//g, '\\/')
  return `[data-theme="light"] .${escaped}${suffix}`
}

/** The `color:` src/index.css declares for `token` in light, or null when no
 * such rule exists. */
export function lightOverrideColor(token: string): string | null {
  const selector = lightOverrideSelectorFor(token)
  let from = 0
  for (;;) {
    const idx = INDEX_CSS.indexOf(selector, from)
    if (idx === -1) return null
    const next = INDEX_CSS[idx + selector.length]
    // Reject a prefix match: `.text-cyan-3` must not satisfy `.text-cyan-300`.
    if (next === undefined || !/[\w-]/.test(next)) {
      const open = INDEX_CSS.indexOf('{', idx)
      const close = INDEX_CSS.indexOf('}', open)
      const declared = /(?:^|;)\s*color:\s*([^;!}]+)/.exec(INDEX_CSS.slice(open + 1, close))
      if (declared !== null) return declared[1].trim()
    }
    from = idx + 1
  }
}

/** The raw Tailwind palette value behind a `{variant:}{prefix}-{palette}-{shade}`
 * class, read from the installed tailwindcss package. */
export function paletteColorFor(token: string): string {
  const bare = token.slice(token.lastIndexOf(':') + 1)
  const match = /^[a-z]+(?:-[a-z]+)*?-([a-z]+)-([0-9]{2,3})$/.exec(bare)
  if (match === null) throw new Error(`"${token}" is not a {prefix}-{palette}-{shade} utility`)
  const [, family, shade] = match
  const scale = (colors as unknown as Record<string, Record<string, string>>)[family]
  if (scale === undefined || scale[shade] === undefined) {
    throw new Error(`tailwindcss's palette has no ${family}-${shade} (from "${token}")`)
  }
  return scale[shade]
}

/** The colour `token` ACTUALLY resolves to in light mode: the override's value
 * where index.css declares one, the raw palette value where it does not. This
 * is the whole of D-22 - "covered" is a measured ratio, never a rule that
 * happens to exist. */
export function lightResolvedColor(token: string): Rgba {
  return parseCssColor(lightOverrideColor(token) ?? paletteColorFor(token))
}

/* -------------------------------------------------------------------------
   Discovering consumers on disk.
   ------------------------------------------------------------------------- */

/** Every .tsx under src/, sorted. Mirrors tokens.test.ts and
 * opacityColorThemeCoverage.test.ts so all three sweeps see one file set.
 * `.tsx` only, so this suite's own `.test.ts` class-name literals are never
 * mistaken for a component using the class. */
function allComponentFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allComponentFiles(rel))
    else if (entry.name.endsWith('.tsx')) found.push(rel)
  }
  return found.sort()
}

const COMPONENT_FILES = allComponentFiles()
const COMPONENT_SOURCES = COMPONENT_FILES.map((rel) => ({
  rel,
  source: readFileSync(path.join(ROOT, rel), 'utf-8'),
}))

/** Files whose className strings use `token` as a whole class token. Matched on
 * word boundaries so `text-cyan-300` never matches `text-cyan-300/40`, which
 * Tailwind compiles to a different selector and which therefore needs its own
 * override, exactly like a variant does. */
export function consumersOf(token: string): string[] {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|[\\s'"\`])${escaped}(?=[\\s'"\`]|$)`, 'm')
  return COMPONENT_SOURCES.filter(({ source }) => pattern.test(source)).map(({ rel }) => rel)
}

/* -------------------------------------------------------------------------
   The guards.
   ------------------------------------------------------------------------- */

describe('v1.26.1 - the light theme has no invisible foregrounds left (D-22)', () => {
  it('reads a real repo: components, both token blocks, and a composited light surface', () => {
    // Vacuity guards. Every assertion below is quantified over one of these
    // three, so a silently-empty file sweep, a mis-sliced token block, or an
    // unparsed surface would turn the whole suite green while checking nothing.
    expect(COMPONENT_FILES.length).toBeGreaterThan(40)

    const lightBackdrop = surfaceBackdrop('light')
    const darkBackdrop = surfaceBackdrop('dark')
    // The light card must actually be light and the dark one dark - this is the
    // assertion that catches slicing the wrong `[data-theme]` block, which
    // otherwise reads as a perfectly plausible run.
    expect(relativeLuminance(lightBackdrop)).toBeGreaterThan(0.5)
    expect(relativeLuminance(darkBackdrop)).toBeLessThan(0.1)
  })

  it.each(V1_26_1_FOREGROUNDS)(
    '$token resolves above 4.5:1 on the light card wherever it is still used',
    ({ token }) => {
      const consumers = consumersOf(token)
      if (consumers.length === 0) return // took the token route; the next test owns it

      const resolved = lightResolvedColor(token)
      const ratio = contrastRatio(resolved, surfaceBackdrop('light'))
      expect(
        ratio,
        `"${token}" resolves to ${lightOverrideColor(token) ?? paletteColorFor(token)} in light mode and lands at ` +
          `${ratio.toFixed(2)}:1 on --surface-2, below AA's ${AA_NORMAL_TEXT}:1. Used by: ${consumers.join(', ')}. ` +
          'Either migrate those consumers onto a semantic text token (text-text-primary/secondary/muted/subtle, ' +
          'text-accent-text, text-success/warning/danger/caution/info-text - each carries both themes), or add a ' +
          `[data-theme="light"] .${token} rule to src/index.css whose colour clears the bar.`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    },
  )

  it.each(V1_26_1_FOREGROUNDS.filter((f) => f.route === 'token'))(
    '$token stayed retired - its consumers moved to the $landedOn token',
    ({ token, landedOn }) => {
      // A semantic token carries BOTH themes, so re-introducing the raw class
      // re-introduces the defect. The test above cannot catch that on its own:
      // it passes vacuously the moment a class has no consumers, so without
      // this one, deleting the last consumer would silently retire the guard.
      expect(
        consumersOf(token),
        `"${token}" is back in a component. v1.26.1 removed it because it renders at ` +
          `${contrastRatio(parseCssColor(paletteColorFor(token)), surfaceBackdrop('light')).toFixed(2)}:1 in light ` +
          `mode with no override. Use text-${landedOn} (or hover:text-${landedOn}), which carries both themes.`,
      ).toEqual([])
    },
  )

  it.each(
    [...new Set(V1_26_1_FOREGROUNDS.filter((f) => f.landedOn !== null).map((f) => f.landedOn as string))].map(
      (name) => ({ name }),
    ),
  )('the --$name token this slice migrated onto is legible in BOTH themes', ({ name }) => {
    // The migration is only a fix if the landing colour holds up on both
    // surfaces. Checking light alone would let a "fix" ship that repaired the
    // light theme by breaking the dark one - the same one-theme blindness in
    // the opposite direction.
    for (const theme of ['light', 'dark'] as const) {
      const ratio = contrastRatio(parseCssColor(cssVariable(theme, name)), surfaceBackdrop(theme))
      expect(
        ratio,
        `--${name} is ${cssVariable(theme, name)} in ${theme}, ${ratio.toFixed(2)}:1 on that theme's --surface-2.`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    }
  })

  it('the criterion itself rejects: all six raw dark-authored values fail in light', () => {
    // The permanent negative control. Every assertion above is a "must pass",
    // and a bar that nothing can fail is not a bar - if `surfaceBackdrop` or
    // `contrastRatio` ever regressed toward returning something generous, the
    // whole suite would stay green while measuring nothing. These are the six
    // values as Tailwind ships them, which is what a re-introduced raw class
    // would render, and every one of them must still be judged a failure.
    const backdrop = surfaceBackdrop('light')
    const measured = V1_26_1_FOREGROUNDS.map(({ token }) => ({
      token,
      hex: paletteColorFor(token),
      ratio: Number(contrastRatio(parseCssColor(paletteColorFor(token)), backdrop).toFixed(2)),
    }))
    for (const { token, ratio } of measured) {
      expect(ratio, `${token} raw palette value now measures ${ratio}:1, which no longer fails AA`).toBeLessThan(
        AA_NORMAL_TEXT,
      )
      // Not merely "below AA": every one of these was invisible-grade, and a
      // helper that had drifted to returning ~4:1 for everything would satisfy
      // a bare toBeLessThan while measuring nothing real.
      expect(ratio).toBeLessThan(2)
    }
  })
})
