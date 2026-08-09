/**
 * Tailwind colour-role coverage (v1.18.4).
 *
 * tokens.test.ts's ghost-class scanner only checks hand-authored CSS classes
 * (the OWNED_CLASS_PREFIXES namespaces: forge-, btn-, field-, etc). It does
 * not - and cannot cheaply - validate raw Tailwind *utility* classes like
 * `bg-neutral-bg` or `text-accent-text`, because those are supposed to
 * resolve through tailwind.config.js's `theme.extend.colors`, not through a
 * CSS rule this repo authors directly.
 *
 * That gap let a real ghost class ship during v1.18.4: the Badge primitive's
 * `neutral` tone (src/components/ui/Badge.tsx) and PatchNotesPage's
 * "Upcoming" version pill both used `bg-neutral-bg` / `border-neutral-border`
 * / `ring-neutral-border`, but tailwind.config.js never defined a `neutral`
 * colour role (Tailwind's own built-in `neutral` grey scale exists, but only
 * as numeric shades - it has no `bg` or `border` sub-key) - so those three
 * classes compiled to nothing, the exact F1 failure mode (a panel or pill
 * with no background and no border) one config edit away from every other
 * semantic role that DOES already work (accent, success, warning, danger,
 * caution, info, surface, border, text).
 *
 * This test closes that specific gap: it reads the real, live
 * tailwind.config.js colour tree (dynamic import, not a text regex, so a
 * restructured config is still validated correctly) and asserts every
 * component's use of one of *our own* semantic colour roles resolves to a
 * key that config tree actually defines.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
// @ts-expect-error -- plain JS config with no declaration file; its shape is
// asserted explicitly in definedColorClasses() below instead.
import tailwindConfig from '../../tailwind.config.js'

const ROOT = process.cwd()

/** Top-level colour roles this design system owns (v1.18.1-.4). Tailwind's
 * own built-in palette (zinc, amber, emerald, red, blue, ...) is deliberately
 * excluded: those are still consumed as literal, unmapped utilities across
 * the app (the light-mode override sheet exists precisely because of that),
 * and validating them is out of this test's scope. */
const OWNED_COLOR_ROLES = ['surface', 'border', 'text', 'accent', 'success', 'warning', 'danger', 'caution', 'info', 'neutral'] as const

type ColorTree = Record<string, string | Record<string, string>>

function flattenColorRole(role: string, value: string | Record<string, string>): Set<string> {
  const suffixes = new Set<string>()
  if (typeof value === 'string') {
    suffixes.add(role)
    return suffixes
  }
  for (const subKey of Object.keys(value)) {
    suffixes.add(subKey === 'DEFAULT' ? role : `${role}-${subKey}`)
  }
  return suffixes
}

/** Every `<prefix>-<role>[-<sub>]` class name tailwind.config.js's colour
 * tree can actually generate, for the roles this repo owns. */
function definedColorClasses(): Set<string> {
  const colors = (tailwindConfig as { theme?: { extend?: { colors?: ColorTree } } }).theme?.extend?.colors ?? {}
  const defined = new Set<string>()
  for (const role of OWNED_COLOR_ROLES) {
    if (!(role in colors)) continue
    for (const suffix of flattenColorRole(role, colors[role])) defined.add(suffix)
  }
  return defined
}

const UTILITY_PREFIXES = ['bg', 'text', 'border', 'ring', 'divide', 'from', 'via', 'to', 'placeholder', 'decoration', 'outline'] as const

/** Every source file under src/ that can carry a class name: `.tsx` plus
 * non-test `.ts` (SWEEP-TSX-ONLY-1; was `.tsx`-only until 2026-08-08, which
 * made the owned-role classes in src/features/crm/vocabulary.ts — a plain-.ts
 * class registry consumed via className — invisible to this exact check).
 * Mirrors tokens.test.ts's allSourceFiles() (kept local: importing across
 * test files couples their maintenance for no shared benefit here).
 * `.test.ts(x)` stays excluded: test prose quotes class names
 * illustratively. */
function allSourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allSourceFiles(relPath))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(relPath)
  }
  return found.sort()
}

const SOURCE_FILES = allSourceFiles()

/** Every class-like literal token in a component's source, ignoring
 * interpolated template fragments (`` `text-${tone}` `` never yields a
 * literal string Tailwind's scanner - or this test - can see). */
function classTokensIn(source: string): string[] {
  const tokens: string[] = []
  const literalPattern = /'([^'\n]*)'|"([^"\n]*)"/g
  let match: RegExpExecArray | null
  while ((match = literalPattern.exec(source)) !== null) {
    const literal = match[1] ?? match[2] ?? ''
    for (const raw of literal.split(/\s+/)) {
      const candidate = raw.slice(raw.lastIndexOf(':') + 1)
      if (/^[a-z][a-z0-9-]*$/.test(candidate)) tokens.push(candidate)
    }
  }
  return tokens
}

/** For a class token like `bg-neutral-bg`, return the `neutral-bg` part if
 * its utility prefix is one we validate and its remainder starts with one of
 * our owned colour roles; otherwise null (a Tailwind built-in colour, a
 * spacing/layout utility, or anything else out of scope). */
function ownedColorSuffix(token: string): string | null {
  for (const prefix of UTILITY_PREFIXES) {
    if (!token.startsWith(`${prefix}-`)) continue
    const remainder = token.slice(prefix.length + 1)
    if (OWNED_COLOR_ROLES.some((role) => remainder === role || remainder.startsWith(`${role}-`))) {
      return remainder
    }
  }
  return null
}

describe('tailwind.config.js colour roles actually generate the utilities components use', () => {
  it('defines at least the roles this repo introduced through v1.18', () => {
    const defined = definedColorClasses()
    // Guards the scanner itself: a config restructure that silently drops
    // theme.extend.colors would otherwise make every check below vacuous.
    expect(defined.size).toBeGreaterThan(15)
  })

  it('the corpus includes the non-test .ts half (scanner non-vacuity)', () => {
    // SWEEP-TSX-ONLY-1, mirroring colorThemeCoverage.test.ts: a filter edit
    // that silently drops plain .ts modules would re-open the vocabulary.ts
    // blind spot while every check below stays green.
    expect(SOURCE_FILES.length).toBeGreaterThan(40)
    expect(SOURCE_FILES.filter((rel) => rel.endsWith('.ts')).length).toBeGreaterThan(0)
  })

  it('every owned-role colour class referenced in non-test src/** resolves to a real config key', () => {
    const defined = definedColorClasses()
    const offenders: string[] = []
    for (const relPath of SOURCE_FILES) {
      const source = readFileSync(path.join(ROOT, relPath), 'utf-8')
      for (const token of classTokensIn(source)) {
        const suffix = ownedColorSuffix(token)
        if (suffix && !defined.has(suffix)) offenders.push(`${relPath}: .${token}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('regression: neutral tone (Badge, PatchNotesPage) resolves via tailwind.config.js', () => {
    const defined = definedColorClasses()
    expect(defined.has('neutral-bg')).toBe(true)
    expect(defined.has('neutral-border')).toBe(true)
  })
})
