/**
 * Light-theme colour resolution and contrast arithmetic, shared by every
 * theme-coverage guard in src/styles/ (v1.26.3, ROADMAP.md D-21/D-22).
 *
 * WHY IT LIVES IN scripts/lib/ AND NOT IN src/. It is test support, not shipped
 * code: nothing in the app imports it, and it imports `tailwindcss` (a
 * devDependency) to read the real palette. Putting it under src/ made
 * src/features/site/dependencyAuditGate.test.ts fail, correctly - that guard
 * treats every non-test file under src/ as bundled into the app, and a bundled
 * import of a devDependency is invisible to the required `npm audit --omit=dev`
 * step. Moving the module here answers the guard's premise instead of arguing
 * with it, and follows the convention this repo already had: a test importing
 * shared logic from `scripts/lib/` (see src/features/consulting/checkoutTier
 * .test.ts, which imports checkoutRedirect.mjs the same way). It is TypeScript
 * rather than the `.mjs` + hand-written `.d.mts` pair its neighbours use because
 * nothing executes it with bare node - only vitest imports it, and one typed
 * source beats two artifacts that must agree. It stays fully type-checked:
 * tsconfig's `include` names entry points, and an imported file joins the
 * program regardless of where it sits.
 *
 * This app is authored dark-first. Light is not a second authored theme, it is
 * a patch: src/index.css carries ~200 `[data-theme="light"]` override rules and
 * zero `[data-theme="dark"]` ones, so every dark-authored Tailwind palette
 * utility needs a hand-written light twin, and something has to check that the
 * twin exists AND is right.
 *
 * Why this is a module rather than helpers inside one suite: v1.26.1 shipped
 * this arithmetic inside lightForegroundContrast.test.ts and said in its own
 * docstring that the widening should "reuse this exact arithmetic rather than
 * write a second, subtly different copy of it - two scanners with two scopes is
 * precisely how NotificationBell's chip got its fill checked and its text not."
 * Importing one .test.ts from another would re-register its describes into the
 * importer's collection and run every one of its tests twice, so the shared
 * half moved here instead. One definition of "what colour does this class
 * actually paint in light mode", used by every guard.
 *
 * THE FILE SET IS `.tsx` PLUS NON-TEST `.ts`, AND THAT IS THE POINT (v1.26.3).
 * Every sweep in this repo scanned `src/**\/*.tsx` only. This repo also keeps
 * class-name REGISTRIES in plain `.ts` - src/features/crm/vocabulary.ts maps
 * each integration provider to a chip's class string - so those classes were
 * invisible to all of them. That is not hypothetical: the v1.26 definition pass
 * measured one of that file's fills as having "no consumer in any form" and
 * slated its light override for deletion; deleting it would have broken the AWS
 * integration chip in light mode. `.test.ts`/`.test.tsx` stay excluded on
 * purpose, so a class name written as a negative-control argument is never
 * mistaken for a component using it.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import colors from 'tailwindcss/colors.js'

export const ROOT = process.cwd()

export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** src/index.css exactly as authored. Kept beside the comment-stripped form
 * because the D-34 discovery below hands it to a real CSS parser, which does
 * its own comment handling - and does it correctly, which is the point. */
export const RAW_INDEX_CSS = readFileSync(path.join(ROOT, 'src/index.css'), 'utf-8')

export const INDEX_CSS = stripCssComments(RAW_INDEX_CSS)
const TOKENS_CSS = stripCssComments(readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf-8'))

/** WCAG AA for normal-size text. Everything this repo paints with a palette
 * foreground utility is body copy, a heading, a chip label or a link. */
export const AA_NORMAL_TEXT = 4.5

/* -------------------------------------------------------------------------
 * Pure colour arithmetic.
 * ---------------------------------------------------------------------- */

export type Rgba = readonly [number, number, number, number]

/** `#rgb`, `#rrggbb`, `rgb(...)` and `rgba(...)` - every form these two
 * stylesheets actually use. Anything else throws rather than defaulting to a
 * colour, because a silently-substituted black would PASS on a light surface
 * and hide the exact defect this file exists to catch. */
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
 * backdrop. Both light surface tokens here are translucent, and so is every
 * opacity-suffixed utility, so skipping this step measures a colour that never
 * reaches a screen. */
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
 * Reading this repo's real stylesheets.
 * ---------------------------------------------------------------------- */

/** The body of tokens.css's `:root, [data-theme="dark"]` or
 * `[data-theme="light"]` custom-property block.
 *
 * The selector must be matched at the START OF A LINE: tokens.css's header
 * prose names both blocks several times, and an indexOf that ignores that lands
 * inside the comment and then slices out the DARK block - which reads as a
 * plausible result (every token resolves, every ratio is high) while measuring
 * the wrong theme entirely. Comments are stripped above, and callers
 * sanity-check the extracted block by luminance. */
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

/** The three surface fills a colour in this app can sit on, page background
 * first. Exported as data rather than re-listed per test because v1.27 gates a
 * focus indicator against ALL of them: an indicator painted on a modal
 * (--surface-2) and one painted on the bare page (--surface-0) meet different
 * backdrops, and the page background is the darkest of the three in light, so
 * measuring only the card fill measures the easy case. */
export const SURFACE_NAMES = ['surface-0', 'surface-1', 'surface-2'] as const
export type SurfaceName = (typeof SURFACE_NAMES)[number]

/** The colour a surface fill actually presents to the eye in `theme`: the named
 * fill composited onto the opaque page background --surface-0.
 *
 * Defaults to --surface-2 (the elevated panel/modal fill), which is what every
 * caller before v1.27 wanted and what the foreground suites still measure
 * against. --surface-0 composited onto itself is itself, so the general form is
 * correct for the page background too. */
export function surfaceBackdrop(theme: 'light' | 'dark', surface: SurfaceName = 'surface-2'): Rgba {
  return compositeOver(parseCssColor(cssVariable(theme, surface)), parseCssColor(cssVariable(theme, 'surface-0')))
}

/* -------------------------------------------------------------------------
 * The class vocabulary.
 * ---------------------------------------------------------------------- */

/**
 * Every colour-bearing Tailwind prefix this repo can use, mapped to the CSS
 * property it lands on and to what the colour is FOR.
 *
 * `kind` is what decides the criterion, and the boundary is drawn where the
 * property stops applying rather than by an allowlist (D-23's move):
 *
 *   foreground - ink on a surface. Contrast against that surface is the whole
 *                of its legibility, so it is gated at AA (D-22).
 *   hairline   - a border, ring, outline or divider. Contrast against the
 *                surface is measurable but the right BAR is not settled here:
 *                measured 2026-08-08, 72 of this repo's 76 hairline utilities
 *                sit below 3:1, most of them because index.css deliberately
 *                overrides them to a faint rgba(0,0,0,0.08-0.16) in light. A
 *                blanket 3:1 would demand redesigning every border in the app,
 *                so hairlines keep the long-standing RULE-EXISTENCE criterion
 *                here and the bar is an open decision (ROADMAP.md v1.26.4).
 *   fill       - a background, gradient stop, shadow or SVG fill. A fill has no
 *                contrast of its own; its legibility is a property of the
 *                foreground sitting on it, which the foreground rule gates.
 *
 * Listing the prefixes here rather than in a test keeps one vocabulary: a
 * prefix that is not in this map is not a colour utility as far as any guard is
 * concerned, and adding one automatically puts it under the right criterion.
 */
export const COLOR_PREFIXES = {
  text: { property: 'color', kind: 'foreground' },
  placeholder: { property: 'color', kind: 'foreground' },
  caret: { property: 'caret-color', kind: 'foreground' },
  decoration: { property: 'text-decoration-color', kind: 'foreground' },
  border: { property: 'border-color', kind: 'hairline' },
  divide: { property: 'border-color', kind: 'hairline' },
  ring: { property: '--tw-ring-color', kind: 'hairline' },
  outline: { property: 'outline-color', kind: 'hairline' },
  bg: { property: 'background-color', kind: 'fill' },
  from: { property: null, kind: 'fill' },
  via: { property: null, kind: 'fill' },
  to: { property: null, kind: 'fill' },
  shadow: { property: null, kind: 'fill' },
  fill: { property: 'fill', kind: 'fill' },
  stroke: { property: 'stroke', kind: 'fill' },
  accent: { property: 'accent-color', kind: 'fill' },
} as const satisfies Record<string, { property: string | null; kind: 'foreground' | 'hairline' | 'fill' }>

export type ColorPrefix = keyof typeof COLOR_PREFIXES
export type ColorKind = (typeof COLOR_PREFIXES)[ColorPrefix]['kind']

/** The hue vocabulary is read from the INSTALLED tailwindcss package, never a
 * hand-copied list, so this file cannot disagree with what Tailwind actually
 * compiles. `inherit`/`current`/`transparent` are keywords, not scales; the
 * deprecated aliases tailwind still exports resolve to real scales and are
 * harmless to keep. */
export const PALETTE_HUES = Object.keys(colors).filter(
  (name) => !['inherit', 'current', 'transparent'].includes(name),
)

const HUES = new Set(PALETTE_HUES)

export interface ColorUtility {
  /** The class exactly as written in source, variant prefix included. */
  readonly token: string
  readonly prefix: ColorPrefix
  readonly kind: ColorKind
  readonly hue: string
  readonly shade: string
  /** The `/NN` opacity modifier as a number in 0..1, or null when bare. */
  readonly alpha: number | null
}

/**
 * Parse a class token into a colour utility, or null when it is not one.
 *
 * The variant prefix is KEPT (`hover:` + a border colour, never the bare form):
 * Tailwind compiles a variant to a different selector entirely, and collapsing
 * them is the exact silent-pass bug the opacity scanner was rewritten to fix.
 * A trailing `/NN` is kept too, for the same reason - Tailwind emits the
 * opacity-suffixed class as its own selector, so a bare override gives it no
 * protection.
 *
 * The shade is required to be numeric, which is what separates a palette
 * utility from one of this repo's own semantic tokens: those read as
 * prefix + role + word (a surface index, a text role, a status role), never
 * prefix + hue + number.
 */
export function parseColorUtility(token: string): ColorUtility | null {
  const bare = token.slice(token.lastIndexOf(':') + 1)
  const segments = bare.split('-')
  if (segments.length !== 3) return null
  const [prefix, hue, shadeAndAlpha] = segments
  if (!Object.prototype.hasOwnProperty.call(COLOR_PREFIXES, prefix)) return null
  if (!HUES.has(hue)) return null
  const match = /^([0-9]{2,3})(?:\/([0-9]{1,3}))?$/.exec(shadeAndAlpha)
  if (match === null) return null
  const entry = COLOR_PREFIXES[prefix as ColorPrefix]
  return {
    token,
    prefix: prefix as ColorPrefix,
    kind: entry.kind,
    hue,
    shade: match[1],
    alpha: match[2] === undefined ? null : Number(match[2]) / 100,
  }
}

/* -------------------------------------------------------------------------
 * Reading the override sheet.
 * ---------------------------------------------------------------------- */

/** Tailwind variants (as they appear in a `variant:` class prefix) this repo
 * uses with colour classes, mapped to the exact suffix Tailwind appends after
 * the escaped class name in the compiled selector. `hover:`/`focus:` compile to
 * a trailing pseudo-class; `open:` (the `<details>`/`<dialog>` state variant)
 * compiles to a trailing ATTRIBUTE selector, not a pseudo-class - getting this
 * wrong is exactly how a prior "fix" silently no-opped for every real
 * hover-only consumer of a class: the override it wrote could never match the
 * real compiled selector. src/index.css's "Variant-state ... overrides" section
 * must stay in sync with this map. */
export const VARIANT_SELECTOR_SUFFIX: Record<string, string> = {
  hover: ':hover',
  focus: ':focus',
  open: '[open]',
}

/** The exact `[data-theme="light"] .selector` string index.css must declare for
 * `token` to be overridden, accounting for the literal backslash Tailwind (and
 * every existing override in that file) uses to escape `:` and `/` in a CSS
 * class selector.
 *
 * An unrecognised variant is a HARD FAILURE, not a silent "uncovered": it means
 * no guard knows how to check that class at all, which is worse than reporting
 * it as covered. Keep this behaviour. */
export function lightOverrideSelectorFor(token: string): string {
  const lastColon = token.lastIndexOf(':')
  const variant = lastColon === -1 ? null : token.slice(0, lastColon)
  let suffix = ''
  if (variant !== null) {
    const known = VARIANT_SELECTOR_SUFFIX[variant]
    if (known === undefined) {
      throw new Error(
        `src/styles/themeContrast.ts does not know how Tailwind compiles the "${variant}:" variant to a CSS ` +
          `selector (used by "${token}"). Add it to VARIANT_SELECTOR_SUFFIX here, and add the matching override ` +
          'to src/index.css\'s "Variant-state ... overrides" section - guessing wrong (or not checking at all) ' +
          'here is exactly how a prior fix silently no-opped for every real hover-only consumer of a class.',
      )
    }
    suffix = known
  }
  const escaped = token.replace(/:/g, '\\:').replace(/\//g, '\\/')
  return `[data-theme="light"] .${escaped}${suffix}`
}

/** The value src/index.css declares for `property` on `token`'s light override,
 * or null when no such rule (or no such declaration in it) exists.
 *
 * Plain substring search for the selector, with a following-character check so
 * a shorter class can never satisfy a longer one, then a property lookup inside
 * that rule's body. */
export function lightOverrideValue(token: string, property: string): string | null {
  const selector = lightOverrideSelectorFor(token)
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
  let from = 0
  for (;;) {
    const idx = INDEX_CSS.indexOf(selector, from)
    if (idx === -1) return null
    const next = INDEX_CSS[idx + selector.length]
    if (next === undefined || !/[\w-]/.test(next)) {
      const open = INDEX_CSS.indexOf('{', idx)
      const close = INDEX_CSS.indexOf('}', open)
      const declared = new RegExp(`(?:^|;)\\s*${escapedProperty}:\\s*([^;!}]+)`).exec(
        INDEX_CSS.slice(open + 1, close),
      )
      if (declared !== null) return declared[1].trim()
    }
    from = idx + 1
  }
}

/** True when src/index.css declares ANY light override rule for `token`. This
 * is the long-standing rule-EXISTENCE criterion, kept for fills and hairlines
 * (see COLOR_PREFIXES). */
export function hasLightOverride(token: string): boolean {
  const selector = lightOverrideSelectorFor(token)
  let from = 0
  for (;;) {
    const idx = INDEX_CSS.indexOf(selector, from)
    if (idx === -1) return false
    const next = INDEX_CSS[idx + selector.length]
    if (next === undefined || !/[\w-]/.test(next)) return true
    from = idx + 1
  }
}

/** The `color:` src/index.css declares for `token` in light, or null. Kept as a
 * named helper because it is the one property every foreground prefix in
 * COLOR_PREFIXES lands on. */
export function lightOverrideColor(token: string): string | null {
  return lightOverrideValue(token, 'color')
}

/** The raw Tailwind palette value behind a colour class, read from the
 * installed tailwindcss package rather than a hand-copied hex table. */
export function paletteColorFor(token: string): string {
  const utility = parseColorUtility(token)
  if (utility === null) throw new Error(`"${token}" is not a {prefix}-{hue}-{shade} utility`)
  const scale = (colors as unknown as Record<string, Record<string, string>>)[utility.hue]
  if (scale === undefined || scale[utility.shade] === undefined) {
    throw new Error(`tailwindcss's palette has no ${utility.hue}-${utility.shade} (from "${token}")`)
  }
  return scale[utility.shade]
}

/**
 * The colour `token` ACTUALLY resolves to in light mode: the override's value
 * where index.css declares one, otherwise the raw palette value carrying the
 * class's own `/NN` opacity modifier.
 *
 * This is the whole of D-22 - "covered" is a measured ratio, never a rule that
 * happens to exist. Rule existence is wrong in both directions: three of this
 * repo's un-overridden foregrounds clear AA comfortably and need nothing, while
 * an override that EXISTS but is wrong (a pastel replaced by another pastel)
 * passes existence and still ships an unreadable heading.
 *
 * The opacity modifier is applied only on the palette path. An override
 * declares a finished colour for that exact selector - opacity suffix included,
 * because the suffixed class is its own selector - so re-applying the modifier
 * to it would measure a colour that never reaches a screen.
 */
export function lightResolvedColor(token: string, property = 'color'): Rgba {
  const override = lightOverrideValue(token, property)
  if (override !== null) return parseCssColor(override)
  const utility = parseColorUtility(token)
  if (utility === null) throw new Error(`"${token}" is not a {prefix}-{hue}-{shade} utility`)
  const base = parseCssColor(paletteColorFor(token))
  return utility.alpha === null ? base : [base[0], base[1], base[2], utility.alpha]
}

/** The contrast `token` achieves against the light card fill, composited. */
export function lightContrastRatio(token: string, property = 'color'): number {
  const backdrop = surfaceBackdrop('light')
  return contrastRatio(compositeOver(lightResolvedColor(token, property), backdrop), backdrop)
}

/* -------------------------------------------------------------------------
 * Discovering consumers on disk.
 * ---------------------------------------------------------------------- */

/**
 * Every non-test source file under src/ that can carry a class name: `.tsx`
 * components AND plain `.ts` modules, sorted.
 *
 * See the file header for why `.ts` is included - a class-name registry in a
 * `.ts` file was invisible to every sweep in this repo, and a live chip fill
 * was measured as orphaned because of it. Test files stay excluded so a class
 * written as a negative-control argument is never counted as a consumer.
 */
export function allSourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allSourceFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found.sort()
}

export const SOURCE_FILES = allSourceFiles()
export const SOURCE_ENTRIES = SOURCE_FILES.map((rel) => ({
  rel,
  source: readFileSync(path.join(ROOT, rel), 'utf-8'),
}))

/**
 * Every colour-utility class token referenced in a source file's string or
 * template literals, variant prefix and opacity modifier both kept whole.
 *
 * A token pulled from inside a template literal's `${...}` substitution carries
 * the nested string literal's own quote at its edge, because the backtick
 * alternative below captures the whole template literal as ONE match and
 * whitespace-splitting then leaves a stray quote attached. Stripping those is
 * what recovers ternary-inside-template-literal className usages, three of
 * which once evaded this sweep entirely and had to be found by hand. A quote
 * only ever appears at a class token's delimiter edge, never inside a class
 * name, so stripping cannot corrupt a real class.
 */
export function colorUtilitiesIn(source: string): ColorUtility[] {
  const found = new Map<string, ColorUtility>()
  for (const token of classTokensIn(source)) {
    const utility = parseColorUtility(token)
    if (utility !== null) found.set(token, utility)
  }
  return [...found.values()]
}

/**
 * Every whitespace-delimited token in a source file's string or template
 * literals, edge quotes stripped, deduplicated. This is the tokenization half
 * of colorUtilitiesIn, exported on its own (v1.27.3) because the focus-
 * indicator criterion needs the RAW tokens: an arbitrary-value utility
 * (`outline-[var(...)]`) or a semantic-token class (`ring-accent`) is not a
 * palette utility, so parseColorUtility discards it - yet a focus indicator
 * can be spelled as either, and a criterion that only sees palette utilities
 * silently skips the two spellings this repo actually uses most.
 */
export function classTokensIn(source: string): string[] {
  const found = new Set<string>()
  const literalPattern = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g
  let match: RegExpExecArray | null
  while ((match = literalPattern.exec(source)) !== null) {
    const literal = match[1] ?? match[2] ?? match[3] ?? ''
    for (const rawToken of literal.split(/\s+/)) {
      const token = rawToken.replace(/^['"`]+/, '').replace(/['"`]+$/, '')
      if (token !== '') found.add(token)
    }
  }
  return [...found]
}

/** Files whose literals use `token` as a whole class token. Matched on
 * delimiter boundaries so a bare class never matches its own opacity-suffixed
 * form, which Tailwind compiles to a different selector and which therefore
 * needs its own override, exactly like a variant does. */
export function consumersOf(token: string): string[] {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|[\\s'"\`])${escaped}(?=[\\s'"\`]|$)`, 'm')
  return SOURCE_ENTRIES.filter(({ source }) => pattern.test(source)).map(({ rel }) => rel)
}

/* -------------------------------------------------------------------------
 * The override sheet's own consumers: the D-34 criterion (v1.28.3).
 *
 * Every guard above asks "this class is USED - does index.css cover it?". This
 * one asks the mirror question, "index.css covers this - does anything still
 * USE it?", and it is the direction nothing watched. The ratchet in
 * src/styles/tokens.test.ts bounds the sheet's SIZE, so it cannot tell eleven
 * dead rules leaving from eleven different dead rules arriving; v1.28.2 paid
 * that ratchet out (205 -> 194) and recorded the gap in its own ceiling
 * comment. This is the gap.
 *
 * THE CRITERION IS FORM-EXACT, and that is the whole defect class. Tailwind
 * compiles `hover:border-zinc-600/60` to `.hover\:border-zinc-600\/60:hover`,
 * a different selector token from the bare `.border-zinc-600\/60`, so a bare
 * override rule can never match a variant-only consumer. All eleven rules
 * THEME-VARIANT-ORPHAN-1 retired were bare heads whose only consumers were
 * variant-prefixed: live-looking, and matching zero elements. `consumersOf`
 * matches on delimiter boundaries, so asking it for the class name the
 * SELECTOR spells is exactly the form-exact question.
 * ---------------------------------------------------------------------- */

export const LIGHT_THEME_ATTR = '[data-theme="light"]'

/**
 * Every class name a CSS compound selector names, backslash escapes resolved.
 *
 * A hand lexer rather than a regex because the two `:` in
 * `.hover\:bg-zinc-800:hover` mean opposite things - the escaped one is part of
 * the class NAME, the bare one is a pseudo-class - and so do the two `.` in
 * `.animate-pulse.bg-zinc-800\/60`. It is a lexer over a string a real CSS
 * parser already handed us as one selector, never a sweep over a source file.
 */
export function classNamesInSelector(selector: string): string[] {
  const names: string[] = []
  for (let i = 0; i < selector.length; i += 1) {
    if (selector[i] !== '.') continue
    if (i > 0 && selector[i - 1] === '\\') continue
    let j = i + 1
    let name = ''
    while (j < selector.length) {
      const ch = selector[j]
      if (ch === '\\') {
        if (j + 1 >= selector.length) break
        name += selector[j + 1]
        j += 2
        continue
      }
      if (/[\s.:[\]>~+,()#*='"]/.test(ch)) break
      name += ch
      j += 1
    }
    if (name !== '') names.push(name)
    i = j - 1
  }
  return names
}

/**
 * Every `[data-theme="light"]` rule head src/index.css declares, one entry per
 * selector in a selector list, whitespace normalised.
 *
 * Parsed with postcss - already a devDependency, already the engine that
 * compiles this stylesheet - rather than grepped, because this file argues with
 * itself in prose: it carries CSS comments that QUOTE override rules deleted in
 * earlier milestones, including `[data-theme="light"] .border-amber-400\/60`,
 * whose bare form has had no consumer since v1.27.2. A regex sweep resurrects
 * those comments as rules and reports them as orphans, and a guard that reports
 * garbage gets deleted (L-031). Measured on this tree: the regex form reads 202
 * occurrences, 8 of them inside comments; the parser reads 194 real ones.
 */
export function lightOverrideSelectors(css: string = RAW_INDEX_CSS): string[] {
  const found: string[] = []
  postcss.parse(css, { from: 'src/index.css' }).walkRules((rule) => {
    for (const selector of rule.selectors) {
      const normalised = selector.replace(/\s+/g, ' ').trim()
      if (normalised.includes(LIGHT_THEME_ATTR)) found.push(normalised)
    }
  })
  return found
}

export const LIGHT_OVERRIDE_SELECTORS = lightOverrideSelectors()

export interface LightOverrideHead {
  readonly selector: string
  readonly classNames: readonly string[]
}

export function lightOverrideHeads(
  selectors: readonly string[] = LIGHT_OVERRIDE_SELECTORS,
): LightOverrideHead[] {
  return selectors.map((selector) => ({ selector, classNames: classNamesInSelector(selector) }))
}

/**
 * Heads whose selector NAMES a class the lexer could not read.
 *
 * "This selector has no class" and "this selector's class could not be read"
 * are the same zero, and the second one silently removes a rule from the sweep
 * below - so the criterion would go quiet exactly when the parse is wrong
 * (L-069). Attribute selectors are stripped first so a future `[href=".pdf"]`
 * cannot read as a class.
 */
export function unreadableOverrideHeads(
  heads: readonly LightOverrideHead[] = lightOverrideHeads(),
): LightOverrideHead[] {
  return heads.filter(
    (head) => head.classNames.length === 0 && head.selector.replace(/\[[^\]]*\]/g, '').includes('.'),
  )
}

export interface LightOverrideOrphan {
  readonly selector: string
  readonly className: string
}

/**
 * Every (rule head, class name) pair with no consumer in the exact form the
 * selector matches.
 *
 * `consumers` is injectable so the criterion can be driven over a synthetic
 * corpus in its own negative control without touching either real source.
 */
export function lightOverrideOrphans(
  heads: readonly LightOverrideHead[] = lightOverrideHeads(),
  consumers: (token: string) => string[] = consumersOf,
): LightOverrideOrphan[] {
  const orphans: LightOverrideOrphan[] = []
  for (const head of heads) {
    for (const className of head.classNames) {
      if (consumers(className).length === 0) orphans.push({ selector: head.selector, className })
    }
  }
  return orphans
}
