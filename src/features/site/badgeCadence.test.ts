/**
 * Live-badge cadence guard (v1.21.2, decisions D-5 + D-6; closes BADGE-RATE-1
 * and BADGE-SKIPPED-1).
 *
 * WHAT WENT WRONG. `useGitHubBuildStatus` polled unauthenticated `api.github.com`
 * on `setInterval(load, 120_000)`, once per repository, for the seven
 * repositories listed on `#/case-studies/microservices`. GitHub allows 60
 * unauthenticated requests an hour PER IP, shared with every other tab on that
 * address; the page spent 217. So a section headed "Live CI/CD" reliably
 * throttled itself into "Unknown" after roughly a quarter of an hour, on a
 * public credibility surface, and the portal's copy printed "Updates every 2
 * min" underneath a promise it could not keep.
 *
 * WHY A GUARD RATHER THAN A ONE-LINE DELETION (L-003). Deleting the timer fixes
 * today's instance. What makes the class recur is that nothing in the repo
 * relates the number of badges on a page to the budget those badges spend, and
 * nothing relates a component's cadence COPY to the code's actual cadence. Both
 * pairings are asserted below from BOTH sides, so the fix cannot be half-undone
 * by adding a repository, restoring a timer, or re-typing the caption.
 *
 *   A  no self-throttling  the hook schedules no repeat read of its own
 *   B  inside the budget   worst-case automatic cost of one page view, computed
 *                          from the repo list parsed out of the PAGE, is <= 60
 *   C  askable             every consumer of the hook renders a refresh control
 *   D  honest copy         no consumer advertises an automatic cadence
 *   E  keyboard-reachable  the control's recipe resolves var(--focus-ring)
 *
 * (B) is deliberately computed rather than written down. A hard-coded "7 <= 60"
 * would pass forever while someone appended an eighth, a twelfth and a
 * fortieth repository to the page.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { UNAUTHENTICATED_HOURLY_BUDGET, hourlyRequestCost } from './useGitHubBuildStatus'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

const HOOK_PATH = 'src/features/site/useGitHubBuildStatus.ts'
const CONTROL_PATH = 'src/features/site/BadgeRefresh.tsx'
const CASE_STUDY_PATH = 'src/pages/MicroservicesCaseStudyPage.tsx'
const STYLESHEET_PATH = 'src/index.css'

/** The cadence this hook used to run at, kept as a number so contract B can
 * show the budget arithmetic that forced the change instead of asserting it. */
const RETIRED_POLL_INTERVAL_MS = 120_000

/** Every `.ts`/`.tsx` file under `src/`, excluding test files. */
function sourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...sourceFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found
}

/**
 * Files that render the hook, derived from the source rather than listed here,
 * so a third consumer added later is held to C and D on its first day.
 *
 * A consumer must both IMPORT the module and CALL the hook. Matching the bare
 * identifier is not enough: `BadgeRefresh.tsx` names it in prose while being
 * the control itself, and would otherwise be asked to render itself.
 */
function hookConsumers(): string[] {
  return sourceFiles().filter((rel) => {
    if (rel === HOOK_PATH) return false
    const src = read(rel)
    return /from\s+'[^']*useGitHubBuildStatus'/.test(src) && /useGitHubBuildStatus\(/.test(src)
  })
}

/** The repo list the public case study actually renders. */
function renderedRepos(): string[] {
  const src = read(CASE_STUDY_PATH)
  const match = src.match(/<BuildStatusBadges[^>]*repos=\{\[([\s\S]*?)\]\}/)
  expect(match, `no <BuildStatusBadges repos={[...]}> found in ${CASE_STUDY_PATH}`).toBeTruthy()
  return [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('badge cadence A: the hook schedules no repeat read of its own', () => {
  const src = read(HOOK_PATH)

  it('contains no setInterval', () => {
    // The literal clause of the v1.21.2 done-when.
    expect(src.match(/setInterval/g) ?? []).toHaveLength(0)
  })

  it('contains no setTimeout re-scheduling either', () => {
    // The same defect wearing a different name: a self-rescheduling timeout is
    // a poll. Asserting only on `setInterval` would let the class walk back in.
    expect(src.match(/setTimeout/g) ?? []).toHaveLength(0)
  })

  it('exposes a refresh callback instead, so reading once stays honest', () => {
    expect(src).toMatch(/refresh:\s*\(\)\s*=>\s*void/)
    expect(src).toMatch(/return\s*\{\s*state,\s*refresh,\s*refreshing\s*\}/)
  })
})

describe('badge cadence B: one page view stays inside the visitor budget', () => {
  const repos = renderedRepos()

  it('the case study still renders a non-empty repo list', () => {
    // Guards the guard: an empty parse would make every budget assertion below
    // pass vacuously.
    expect(repos.length).toBeGreaterThan(0)
    expect(new Set(repos).size).toBe(repos.length)
  })

  it('costs at most one request per rendered repository', () => {
    expect(hourlyRequestCost(repos.length)).toBe(repos.length)
  })

  it(`spends at most ${UNAUTHENTICATED_HOURLY_BUDGET} requests an hour, unattended`, () => {
    expect(hourlyRequestCost(repos.length)).toBeLessThanOrEqual(UNAUTHENTICATED_HOURLY_BUDGET)
  })

  it('the retired 2-minute poll blew that budget on this same list', () => {
    // The regression lock. Both numbers come from the list the page renders
    // today, so this stays a true statement about the real page rather than a
    // frozen anecdote, and it fails loudly if anyone reinstates the interval.
    const polled = hourlyRequestCost(repos.length, RETIRED_POLL_INTERVAL_MS)
    expect(polled).toBeGreaterThan(UNAUTHENTICATED_HOURLY_BUDGET)
    expect(polled).toBe(repos.length * 31)
  })

  it('leaves headroom for the visitor to refresh by hand', () => {
    // Refreshing is the replacement for polling, so it has to be affordable:
    // at least a few deliberate re-reads must fit in what is left.
    const perClick = hourlyRequestCost(repos.length)
    const spare = UNAUTHENTICATED_HOURLY_BUDGET - perClick
    expect(Math.floor(spare / perClick)).toBeGreaterThanOrEqual(3)
  })
})

describe('badge cadence C: every consumer lets the reader ask again', () => {
  const consumers = hookConsumers()

  it('finds the consumers by import rather than by a list in this file', () => {
    expect(consumers.length).toBeGreaterThan(0)
    expect(consumers).toContain('src/features/site/BuildStatusBadges.tsx')
    expect(consumers).toContain('src/features/portal/buildStatus.tsx')
  })

  it.each(consumers)('%s takes refresh from the hook and renders the control', (rel) => {
    const src = read(rel)
    expect(src, `${rel} ignores the hook's refresh callback`).toMatch(
      /const\s*\{[^}]*\brefresh\b[^}]*\}\s*=\s*useGitHubBuildStatus\(/,
    )
    expect(src, `${rel} renders no refresh control`).toMatch(/<BadgeRefresh[\s/>]/)
  })
})

describe('badge cadence D: no consumer advertises a cadence it does not run', () => {
  // The portal panel printed "Updates every 2 min". After D-5 that sentence is
  // false, and before D-5 it was only true until the rate limit bit. Any
  // "updates every N <unit>" claim on a surface fed by this hook is now a
  // failing test, whichever direction it drifts.
  const CADENCE_CLAIM = /updates?\s+every\s+\d+\s*(s|ms|sec|second|m|min|minute|h|hour)/i

  it.each(hookConsumers())('%s claims no automatic refresh interval', (rel) => {
    expect(read(rel)).not.toMatch(CADENCE_CLAIM)
  })

  it('the pattern really does catch the caption that shipped', () => {
    // Negative control: without this the regex could be quietly wrong and every
    // assertion above would pass by failing to match anything at all.
    expect('Updates every 2 min').toMatch(CADENCE_CLAIM)
    expect('Refresh').not.toMatch(CADENCE_CLAIM)
  })
})

describe('badge cadence E: the control is keyboard-reachable with a focus ring', () => {
  const control = read(CONTROL_PATH)
  const css = read(STYLESHEET_PATH)

  it('is a real button element via the shared primitive, not a clickable div', () => {
    expect(control).toMatch(/from\s+'\.\.\/\.\.\/components\/ui\/Button'/)
    expect(control).toMatch(/variant="neutral"/)
    // `Button` renders `<button type="button">` unless told otherwise, so the
    // control is in the tab order and responds to Enter and Space for free.
    expect(read('src/components/ui/Button.tsx')).toMatch(/type=\{buttonRest\.type \?\? 'button'\}/)
  })

  it('that variant resolves a var(--focus-ring) outline on :focus-visible', () => {
    // Reads the stylesheet, not the component: a class name that resolves to no
    // rule is this repo's oldest shipped bug class (the v1.18.1 ghost classes).
    const rule = css.match(/\.btn-neutral:focus-visible[^}]*\}/)
    expect(rule, '.btn-neutral has no :focus-visible rule in src/index.css').toBeTruthy()
    expect(rule![0]).toMatch(/outline:\s*2px solid var\(--focus-ring\)/)
  })

  it('--focus-ring is defined for both themes', () => {
    const tokens = read('src/styles/tokens.css')
    const decls = tokens.match(/--focus-ring\s*:/g) ?? []
    expect(decls.length).toBeGreaterThanOrEqual(2)
  })

  it('carries no animation, so there is nothing to exempt from reduced motion', () => {
    expect(control).not.toMatch(/animate-/)
  })
})
