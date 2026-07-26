/**
 * Single-source guard for the recurring-cost figure (v1.21.3, D-7a).
 *
 * THE DEFECT CLASS. `PROOF-COST-1` was a home-page tile asserting a standing
 * recurring spend of nothing; it was true when it was typed and had gone false
 * by 2026-07-21, when the Cloud Run half came back. v1.20.1 fixed that tile by
 * MEASURING it (`proofStats.ts` + `useLiveServices.ts`), but
 * the sentence around it kept a hand-typed replacement figure, and it was typed
 * TWICE — `ProofStrip.tsx` on Home and `CaseStudiesPage.tsx` on `#/case-studies`
 * — plus a third and fourth time inside `runtimeStatusCopy.test.ts`'s fixtures.
 * Four copies of an unverifiable number is the same failure one level down: the
 * copies can drift against each other, and nothing fails when they do.
 *
 * WHY NOT MEASURE IT, like the service count on the same strip. Cost needs the
 * GCP billing export, which is BLOCKED (see `ROADMAP.md`, "Cost Intelligence"),
 * and no public endpoint reports it. So D-7's default is single-source-plus-
 * guard, which cannot make the figure true but makes it appear exactly once,
 * dated, with its basis recorded — a one-line edit to re-check instead of a
 * repo-wide sweep, and a red suite if a fifth copy is ever typed.
 *
 * WHAT THIS GUARD DOES NOT COVER, stated so a later reader does not assume more
 * than it gives: it matches a CURRENCY FIGURE joined to a period word ("$9 a
 * month", "$9/month", "$108 a year"). A figure spelled in words ("nine dollars
 * a month") would slip past. That is the same trade `envContract.test.ts`
 * contract E makes, and for the same reason: a structural check needs an AST
 * walk. The scan is deliberately repo-wide rather than scoped to the two known
 * consumers, so a THIRD surface that starts quoting the cost is caught on its
 * first day rather than after a review notices it.
 *
 * Source-scan assertions, matching this repo's established pattern
 * (`tokens.test.ts`, `runtimeStatusCopy.test.ts`, `routeIntegrity.test.ts`,
 * `envContract.test.ts`, `badgeCadence.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  RECURRING_COST_BASIS,
  RECURRING_COST_MEASURED_ON,
  RECURRING_COST_PHRASE,
} from './platformCost'

const ROOT = process.cwd()

/** The module that is allowed to state the figure, and the two that read it. */
const COST_SOURCE = 'src/features/site/platformCost.ts'
const COST_CONSUMERS = ['src/features/site/ProofStrip.tsx', 'src/pages/CaseStudiesPage.tsx'] as const

/**
 * A currency figure joined to a billing period, in the forms this site has used
 * or could plausibly use. The connector is optional so "$9/month" and "$9 a
 * month" are one rule rather than two that can drift.
 */
const MONTHLY_COST_LITERAL = /\$\s?\d[\d,]*(?:\.\d+)?\s*(?:\/\s*|per\s+|a\s+)?(?:month|monthly|year|annually)\b/i

/**
 * The ONLY files allowed to carry the figure, each for a stated reason. Every
 * entry is asserted below to still exist AND still carry a match, so an
 * exemption cannot outlive the thing it exempts — the same self-assertion
 * `runtimeStatusCopy.test.ts` uses, which is what stops an allowlist from
 * quietly becoming the place new copies hide.
 */
const ALLOWED: readonly { readonly file: string; readonly why: string }[] = [
  {
    file: COST_SOURCE,
    why: 'The single source. This is the one place the figure is written down.',
  },
  {
    file: 'src/features/site/platformCost.test.ts',
    why: 'This guard. Its negative controls quote hand-typed figures to prove the matcher fires.',
  },
  {
    file: 'src/pages/patchNotesData.ts',
    why: 'Dated historical changelog, allowlisted for the same reason runtimeStatusCopy.test.ts allowlists it. Its "~$30/month to ~$2-5/month" line records what the Fly-to-Cloud-Run migration changed AT THE TIME; that is a record of a past release, not a claim about what is billed now, and rewriting it to import a present-day constant would falsify the changelog.',
  },
]

const ALLOWED_FILES = new Set(ALLOWED.map((entry) => entry.file))

/** Every .ts/.tsx file under src/, relative to the repo root, sorted. */
function allSourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...allSourceFiles(relPath))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) found.push(relPath)
  }
  return found.sort()
}

/** The hand-typed cost figures in a document. Empty means clean. */
function costLiteralsIn(text: string): string[] {
  return [...text.matchAll(new RegExp(MONTHLY_COST_LITERAL.source, 'gi'))].map((m) => m[0])
}

const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), 'utf-8')

const SOURCE_FILES = allSourceFiles()
const SCANNED_FILES = SOURCE_FILES.filter((f) => !ALLOWED_FILES.has(f))

describe('cost-literal scan (sanity / negative control)', () => {
  it('the walk found the source tree (a scan over zero files would pass vacuously)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(150)
    expect(SOURCE_FILES).toContain(COST_SOURCE)
    for (const consumer of COST_CONSUMERS) expect(SOURCE_FILES).toContain(consumer)
    expect(SCANNED_FILES.length).toBe(SOURCE_FILES.length - ALLOWED.length)
  })

  it('the matcher fires on every hand-typed form (proves it is not inert)', () => {
    // The on/off proof (L-001): the exact sentence that was live on Home until
    // this PR, plus the spellings a future edit is most likely to reach for.
    expect(costLiteralsIn('brought the Cloud Run half back for about $9 a month when')).toEqual([
      '$9 a month',
    ])
    expect(costLiteralsIn('runs at $12/month')).toEqual(['$12/month'])
    expect(costLiteralsIn('costs $9.50 per month')).toEqual(['$9.50 per month'])
    expect(costLiteralsIn('roughly $1,200 a year')).toEqual(['$1,200 a year'])
  })

  it('does not fire on the interpolated form, or on unrelated figures', () => {
    // What the two consumers now render. If this ever matched, the fix would
    // be unshippable: every consumer would look like an offender.
    expect(costLiteralsIn('back for {RECURRING_COST_PHRASE} when the portfolio')).toEqual([])
    // Neighbouring copy that must stay legal: the past-anchored teardown claim
    // `runtimeStatusCopy.test.ts` guards, and a Tailwind shade.
    expect(costLiteralsIn('tore the whole thing down to $0 once its job was done')).toEqual([])
    expect(costLiteralsIn('className="bg-zinc-900 text-zinc-400"')).toEqual([])
    // A referral bounty is a price, not a recurring infra cost.
    expect(costLiteralsIn('$500 referral bonus')).toEqual([])
  })
})

describe('the recurring-cost figure is stated exactly once', () => {
  it.each(SCANNED_FILES)('%s does not hand-type a recurring cost', (relPath) => {
    const literals = costLiteralsIn(read(relPath))
    expect(
      literals,
      `${relPath} hand-types a recurring cost (${literals.join(', ')}). This bundle cannot ` +
        `check that number, so it is stated once in ${COST_SOURCE} and imported. Import ` +
        'RECURRING_COST_PHRASE instead, or add an ALLOWED entry with a reason.',
    ).toEqual([])
  })

  it('the one source still carries the figure (the guard would pass vacuously if it did not)', () => {
    expect(costLiteralsIn(read(COST_SOURCE)).length).toBeGreaterThan(0)
  })
})

describe('the constant is dated, and both marketing surfaces read it', () => {
  it('the exported phrase is a figure this guard recognises', () => {
    // Ties the constant to the scan: a phrase the matcher cannot see would let
    // a second copy be typed in a form the guard never checks.
    expect(costLiteralsIn(RECURRING_COST_PHRASE)).toEqual(['$9 a month'])
  })

  it('the figure carries the date it was last checked, and what it covers', () => {
    expect(RECURRING_COST_MEASURED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // The rebuild that first created a recurring line item; a figure measured
    // before it would be describing a platform that did not exist yet.
    expect(RECURRING_COST_MEASURED_ON >= '2026-07-21').toBe(true)
    expect(RECURRING_COST_BASIS).toMatch(/Cloud SQL/)
    expect(RECURRING_COST_BASIS.length).toBeGreaterThan(40)
  })

  it.each(COST_CONSUMERS)('%s imports the constant and renders it', (relPath) => {
    const source = read(relPath)
    expect(
      source,
      `${relPath} must import RECURRING_COST_PHRASE from the platformCost module.`,
    ).toMatch(/import \{[^}]*RECURRING_COST_PHRASE[^}]*\} from '[^']*platformCost'/)
    expect(
      source,
      `${relPath} imports the constant but never renders it, which means its cost sentence ` +
        'went somewhere else — check whether a literal came back.',
    ).toContain('{RECURRING_COST_PHRASE}')
  })
})

describe('the allowlist cannot outlive what it exempts', () => {
  it.each(ALLOWED)('$file still exists and still needs its exemption', ({ file, why }) => {
    expect(SOURCE_FILES, `${file} is allowlisted but no longer exists; delete the entry.`).toContain(
      file,
    )
    expect(
      costLiteralsIn(read(file)).length,
      `${file} no longer states a cost figure, so its exemption ("${why}") is stale. Delete the ` +
        'ALLOWED entry so the file is scanned like every other.',
    ).toBeGreaterThan(0)
  })
})
