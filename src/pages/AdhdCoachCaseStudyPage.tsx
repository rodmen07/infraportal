import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { CodeBlock } from '../features/consulting/CodeBlock'

const TECH_STACK = [
  'Next.js 16.2.11',
  'React 19.2.4',
  'TypeScript 5.9.3',
  'Tailwind CSS 4.3.1',
  'Firebase Auth',
  'Cloud Firestore',
  'Zod 4.4',
  'Vitest 3.2',
  'Playwright 1.62',
  'Stripe Payment Links',
  'GitHub Actions',
  'GitHub Pages',
  'Python 3.11',
]

// Each row: the product rule, the file that enforces it, and the assertion.
// Every rule below is mechanical — a test fails if the rule is broken, so the
// rules are not a README promise that drifts away from the shipped app.
const PRODUCT_RULES: [string, string, string][] = [
  [
    'No infinite feed',
    'src/lib/plan.ts:341-376',
    'Three doses map to fixed minute budgets: light 5, medium 15, deep 30. There is no fourth, unbounded option.',
  ],
  [
    'Daily cap, stated once',
    'src/lib/plan.ts:40',
    'Every generated plan carries capMessage: "You reached today’s plan. See you tomorrow." as a field on the DailyPlan type.',
  ],
  [
    'No streak pressure (data)',
    'src/lib/__tests__/focus-session.test.ts:153',
    'The summary object’s keys are asserted not to match /streak|target|goal|rate|score/i.',
  ],
  [
    'No streak pressure (storage)',
    'src/lib/challenges.ts:144',
    'Legacy stored payloads carrying streak fields are dropped on load; challenges.test.ts:41 proves it.',
  ],
  [
    'No shame or failure language',
    'src/lib/__tests__/focus-session.test.ts:162',
    'A test literally named "uses no streak, shame, or failure language".',
  ],
  [
    'No guilt in the trends view',
    'src/app/__tests__/trends-page.test.tsx:342',
    'Rendered card text is asserted not to match /streak|goal|target|rate|missed|failed|should/i.',
  ],
  [
    'No streak-shaped copy',
    'src/lib/__tests__/affirmations.test.ts:14',
    'Affirmation copy must not match /streak/i; trend-insights.test.ts:182 applies the same rule to insights.',
  ],
  [
    'No streak UI on challenges',
    'src/app/__tests__/challenges-page.test.tsx:35-36',
    '"Current Streak" and "Longest Streak" are asserted absent from the rendered page.',
  ],
]

const HIGHLIGHTS: { label: string; detail: string; file: string; code: string; language?: string }[] = [
  {
    label: 'Selling a membership from a site that has no server',
    detail:
      'output: "export" means there are no route handlers, so the app can neither create a Stripe Checkout Session nor receive a Stripe webhook. Stripe Payment Links move checkout off the app entirely, and attribution is smuggled through the URL: the Firebase uid rides along as client_reference_id, so every payment Stripe records can be matched back to the account that made it. The link itself is a build-time environment variable, and the getter hard-requires an https:// prefix or returns null, in which case the pricing CTA degrades to a mailto early-access flow. Both channels log the same pricing_cta_clicked event with a channel label, so the two are comparable rather than one being invisible.',
    file: 'src/lib/billing.ts (36 lines, the whole module)',
    code: `// Appends Stripe Payment Link prefill params so a zero-backend static site
// can still attribute each payment: client_reference_id carries the Firebase
// uid and prefilled_email seeds Stripe's checkout email field.

export function getStripePaymentLink(): string | null {
  const raw = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK?.trim()
  return raw && raw.startsWith("https://") ? raw : null   // null = use mailto
}

export function buildMembershipCheckoutUrl(
  link: string,
  { uid, email }: { uid?: string; email?: string },
): string {
  const url = new URL(link)                    // existing query params kept
  if (uid) url.searchParams.set("client_reference_id", uid)
  if (email) url.searchParams.set("prefilled_email", email)
  return url.toString()
}

// Entitlement is read client-side off users/{uid}.subscriptionStatus in
// Firestore and flipped by hand. Webhook automation is a documented,
// deliberately deferred milestone (v0.5), not an oversight.`,
    language: 'typescript',
  },
  {
    label: 'One route comparison, because a second copy locks people out',
    detail:
      'Every href in the app is written /journal, but trailingSlash: true makes the live usePathname() value /journal/. Two features compare them: nav active-link marking, and the subscription gate’s /pricing exemption. A second hand-rolled copy of that comparison would still look correct in review and would only show up as a person unable to reach checkout, which is the failure mode nobody reports. So the comparison lives in one 40-line module with 9 tests, and both consumers route through it. The non-obvious half is recorded in the docstring and was verified against the live export rather than assumed: basePath is not part of usePathname(), so it is deliberately not handled here.',
    file: 'src/lib/route-path.ts',
    code: `// Next's pre-router value is null; "" and "/" are both the root.
export function normalizeRoutePath(pathname: string | null): string {
  if (pathname === null) return "/"
  const trimmed = pathname.replace(/\\/+$/, "")
  return trimmed === "" ? "/" : trimmed
}

export function isRoute(pathname: string | null, route: string): boolean {
  return normalizeRoutePath(pathname) === normalizeRoutePath(route)
}

// Consumers (both shipped in PR #117):
//   site-nav.tsx          -> aria-current="page" on the active link
//   subscription-guard.tsx -> the unconditional /pricing exemption
//
// basePath is NOT handled: it is not part of usePathname(). Confirmed by
// fetching the live export under its basePath and finding aria-current
// already resolved onto the prefixed href.`,
    language: 'typescript',
  },
  {
    label: 'Guest to account migration that can neither lose nor clobber data',
    detail:
      'Opening the app to signed-out visitors means they write real data to guest-scoped localStorage: check-ins, journal entries, focus sessions, sliced tasks, today’s plan. On sign-in all of it has to follow them. The hazard is that those collections do not share write semantics. The check-in log is append-only, so several check-ins can legitimately share a date. The journal upserts by date key, so copying the check-in migration verbatim would let a guest entry silently overwrite account text written the same day. The answer is one collection-agnostic primitive whose conflict guard is opt-in per collection rather than universal: journal opts in, append-only collections deliberately do not, because there a date-identity rule would delete guest records rather than protect account ones. The divergence from the design doc is recorded as deliberate rather than quietly done.',
    file: 'src/lib/guest-migration.ts (221 lines)',
    code: `// Two primitives, one policy.
migrateGuestRecords(plan, targetScopeKey)       // listable collections
migrateGuestSingleRecord(plan, targetScopeKey)  // one blob per scope (v0.17)

// Four-state result contract:
//   migrated | already-migrated | skipped | error

// Idempotency marker:
guestMigrationMarker(scope, backend, collection?)
//   -> "calm-daily-coach-migrated-guest:<scope>:<backend>[:<collection>]"
//
// The collection segment is OPTIONAL purely for backward compatibility.
// Check-ins have written the 3-part key since v0.4, and adding a segment
// would make every already-migrated person look un-migrated and re-run
// their copy.

// Safety properties, stated as properties rather than hoped for:
//   1. The guest copy is never deleted - the caller is given no removal hook.
//   2. Account data wins, via an OPT-IN conflictGuard that reads account
//      identity keys ONCE (not per record) and skips colliding guest rows.
//   3. On "error" the marker is deliberately NOT set, so the next load
//      retries instead of silently declaring the copy done.

// Collections migrated: check-ins (v0.4), journal + focus sessions (v0.13,
// PRs #113/#115), slicer history + planner state (v0.17, PRs #131/#132).
// PR #113 extracted the loop out of checkin-store.ts and the check-in
// migration tests passed UNCHANGED, which is what makes that refactor
// behavior-preserving rather than merely claimed.`,
    language: 'typescript',
  },
  {
    label: 'Theme flash prevention, and a guard built from two disagreeing sources',
    detail:
      'The app is dark by default with a persisted light toggle, and its theming is hybrid: most components read CSS custom properties, but a hand-maintained allowlist patches a specific set of literal Tailwind colour classes, and only under data-theme="dark". A class one step outside that allowlist gets no theme adaptation and ships invisible in one theme, which passes every existing test and every code review. The audit measured the exposure rather than guessing at it: 73 raw literal colour-class occurrences across 14 non-test files, of which three were genuinely broken in production, found by resolving actual hex values. It also correctly set aside a modal backdrop that is theme-agnostic by design. The fix is two-part: a blocking inline script that stamps the theme before first paint, and a regression guard that reads the app’s literal colour-class usage and the stylesheet’s allowlist as two sources that must agree.',
    file: 'src/app/layout.tsx:40-53 + src/app/__tests__/theme-token-guard.test.ts',
    code: `// Blocking inline <head> script - runs before first paint, so a persisted
// light theme never flashes dark on the way in.
try {
  var stored = localStorage.getItem("calm-daily-coach:theme");
  document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
} catch (err) {
  document.documentElement.dataset.theme = "dark";   // dark is the default
}
// <html suppressHydrationWarning> because the prerender cannot know this.

// The regression guard reads BOTH sides and fails when they disagree:
//   side A: the literal colour classes the app actually uses
//   side B: globals.css's [data-theme] override allowlist
//
// The three live defects it was built from:
//   hover:bg-slate-800 nav buttons - the allowlist never touched hover:
//     variants or background utilities, so light mode composited dark text
//     on a dark hover fill
//   subscription-guard.tsx - the entire paywall screen, zero theme awareness
//   a bg-white/70 callout nested inside a token-driven dark panel
//
// PR #94 then found the guard's OWN blind spot (inline style colours, which
// a className regex cannot see), added a self-checking BASELINE_DEBT_TOTAL,
// and retracted an unsound claim in its own design doc. PR #128 widened it
// to a dark:-paired shade pattern it had been missing.`,
    language: 'javascript',
  },
  {
    label: 'Browser E2E, because jsdom structurally cannot see this bug class',
    detail:
      'Every test in the repo lived in jsdom, and the defects that slipped through a green 500-plus suite were exactly the ones only a real browser sees. Three concrete escapes: the deployed site serving spinner-only HTML on every route, found by hand rather than by any test; an onboarding hydration mismatch caused by reading localStorage in a useState initializer, which a returning visitor computed as false and therefore never noticed until the app opened to signed-out visitors; and a progress ring that reset on reload, which jsdom cannot reproduce because nothing in it reloads a page. Those bugs live at the prerender-and-hydrate boundary of the exported artifact served under a basePath, so the dev server reproduces none of them. The suite therefore runs Playwright against the real build output, served by a dependency-free stdlib Node server that reproduces the hosting shape exactly.',
    file: 'e2e/serve.mjs (124 lines, stdlib only) + e2e/fixtures.ts',
    code: `// serve.mjs reproduces GitHub Pages' exact shape against the real out/
// directory produced by a production build:
//
//   out/ mounted under the basePath
//   directory URL         -> index.html
//   bare basePath         -> 301 to its trailing-slash form
//   unknown path          -> the exported 404.html, with a real 404 status
//   outside the basePath  -> 404 ON PURPOSE, so a basePath regression is
//                            seen rather than absorbed
//   ../ traversal         -> refused
//
// It even bridges one verified Windows/Linux build discrepancy in Next's
// segment-payload filenames, documented with the live probe that
// established it rather than as a hunch.

// fixtures.ts - the console-error tripwire.
// Production React reports a hydration mismatch as a MINIFIED console.error,
// so every journey fails on any non-allowlisted console error or page error.
// The fixture is { auto: true } so a forgotten reference can never silently
// disarm it, and the allowlist starts EMPTY: every future entry must carry
// a reason string.

// vitest.config.ts:16 excludes e2e/** - vitest sets no include, and its
// default glob would otherwise claim the .spec.ts browser journeys and
// execute them under jsdom, which is the entire thing being escaped.`,
    language: 'javascript',
  },
  {
    label: 'A blocking gate that queries the internet, fixed with a detector',
    detail:
      'npm audit --audit-level=high is a blocking step in the Quality Gate, and it queries the live advisory database. That makes the gate non-hermetic: an unchanged main branch can go red with no code change. It did, four times, and each time it was discovered reactively when someone next opened a pull request. The fix was neither to remove the gate nor to pin the advisory data, but to add a detector: a daily scheduled run of the identical command that gates nothing and surfaces the red within a day. Dependabot is not a substitute here and the reason is recorded: one advisory needed a major bump of a transitive dependency with no direct upgrade path, so no pull request was ever opened for it.',
    file: '.github/workflows/security-audit.yml',
    code: `on:
  schedule:
    - cron: "17 6 * * *"    # off-the-hour, to dodge the top-of-hour spike
  workflow_dispatch:
  pull_request:
    paths: [".github/workflows/security-audit.yml"]

# Runs the IDENTICAL command the Quality Gate runs, tees the output into
# the job summary, and gates nothing.
#
# Reactive red-main incidents this detector exists to pre-empt, each fixed
# after the fact: PRs #99, #101, #102, #107.
#
# Command parity between detector and gate is itself enforced by a test
# that reads both YAML files: src/__tests__/workflow-audit-parity.test.ts
# (5 tests). The same reasoning drove static-export-surface.test.ts, which
# caught an unimported production dependency sitting inside the audit
# surface for a package the app could never load.`,
    language: 'yaml',
  },
]

const GATE_STEPS: [string, string][] = [
  ['npm run lint', 'eslint 9 flat config'],
  ['npm run typecheck', 'tsc --noEmit'],
  ['npm run build', 'the real static export'],
  ['npm audit', '--audit-level=high'],
  ['npm run test:coverage', 'the full vitest suite'],
]

export function AdhdCoachCaseStudyPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const toggle = (idx: number) => setOpenIdx(openIdx === idx ? null : idx)

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">ADHD Daily Coach</h1>
            <p className="mt-1 text-sm text-amber-300/80">
              Next.js static export · No backend · Firebase Auth · Firestore sync · Stripe Payment Links · Autonomous dev agent
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-zinc-500/60 hover:text-text-primary"
            >
              ← Case studies
            </a>
            <a
              href="https://rodmen07.github.io/adhd-daily-coach/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-zinc-500/60 hover:text-text-primary"
            >
              Live site →
            </a>
            <a
              href="https://github.com/rodmen07/adhd-daily-coach"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-zinc-500/60 hover:text-text-primary"
            >
              GitHub →
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          A deliberate, ADHD friendly self-improvement app where users choose a daily content dose and
          receive exactly that amount. It ships as a Next.js static export with no server routes at all,
          and still does Google sign-in, cloud sync, a paid membership flow, and a guest-to-account data
          migration. That constraint is the whole engineering story: every subsystem below exists in the
          shape it does because there is nowhere to run code except the visitor&rsquo;s browser and
          GitHub Actions.
        </p>
      </section>

      {/* Tech stack */}
      <div className="flex flex-wrap gap-2">
        {TECH_STACK.map((tech) => (
          <span
            key={tech}
            className="rounded border border-zinc-700/50 bg-surface-control px-2.5 py-1 text-xs font-medium text-text-secondary"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* The constraint */}
      <section className="forge-panel rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 backdrop-blur-xl">
        <h2 className="mb-4 text-base font-semibold text-amber-200">The constraint that shapes everything</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          next.config.ts declares <code className="rounded bg-zinc-800 px-1 text-amber-300">output: &quot;export&quot;</code>,
          so the build emits static HTML and there is no runtime to receive a request. That is not a
          claim taken on trust: there are zero <code className="rounded bg-zinc-800 px-1 text-amber-300">route.ts</code> and{' '}
          <code className="rounded bg-zinc-800 px-1 text-amber-300">middleware.ts</code> files anywhere under src/,
          no src/app/api directory, and a test reads the export mode live out of the config and then asserts
          that no module under src/ imports a Node built-in and no production dependency goes unimported. Its
          header records the two real modules that had to be deleted to make it pass: a check-in store that
          wrote JSON to disk, and the only importer of a mail library.
        </p>
        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-200">What a static export takes away</div>
            <div className="space-y-2">
              {[
                'No route handlers, so no Stripe Checkout Session can be created server-side',
                'No webhook endpoint, so Stripe can never call back into the app',
                'No server session, so every access decision is made in the browser',
                'No Node APIs, so any module that touches the filesystem breaks the build',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-danger-text">&#x25CF;</span>
                  <span className="text-text-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-green-700/40 bg-green-950/20 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-200">What it still does anyway</div>
            <div className="space-y-2">
              {[
                'Google sign-in via Firebase, popup with a redirect fallback',
                'Cloud sync to Firestore, with every read and write falling back to localStorage',
                'A paid membership flow, attributed through Stripe Payment Link parameters',
                'Guest data that follows a visitor into their account on first sign-in',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-success-text">&#x25CF;</span>
                  <span className="text-text-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* By the numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: '563', label: 'Vitest tests, 74 files' },
          { value: '4', label: 'Playwright browser journeys' },
          { value: '11,675', label: 'Non-test lines under src/' },
          { value: '9,967', label: 'Test lines under src/' },
          { value: '4', label: 'Production dependencies' },
          { value: '13', label: 'App Router routes' },
          { value: '41', label: 'Modules in src/lib' },
          { value: '127', label: 'Merged PRs, 0 open' },
        ].map(({ value, label }) => (
          <div key={label} className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4 text-center">
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="mt-0.5 text-xs text-text-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* Product rules enforced by tests */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Product rules the test suite enforces</h2>
          <p className="mt-0.5 text-xs text-text-subtle">
            No infinite feed · no streak pressure · a daily cap · each one wired to an assertion, not a README promise
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700/40 text-left">
                <th className="px-4 py-2.5 font-semibold text-text-muted">Rule</th>
                <th className="px-4 py-2.5 font-semibold text-text-muted">What the assertion actually checks</th>
                <th className="hidden px-4 py-2.5 font-semibold text-text-muted sm:table-cell">Enforced in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {PRODUCT_RULES.map(([rule, file, assertion]) => (
                <tr key={file} className="transition hover:bg-zinc-800/20">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-amber-300">{rule}</span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{assertion}</td>
                  <td className="hidden px-4 py-2.5 font-mono text-text-subtle sm:table-cell">{file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expandable implementation highlights */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Implementation highlights</h2>
          <p className="mt-0.5 text-xs text-text-subtle">Click any item to see the module or workflow</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {HIGHLIGHTS.map(({ label, detail, file, code, language }, idx) => (
            <div key={label}>
              <button
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-zinc-800/30"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 text-amber-400">›</span>
                  <span className="font-medium text-zinc-200">{label}</span>
                </span>
                <span className="shrink-0 text-scale-xs text-text-subtle">
                  {openIdx === idx ? '▲' : '▼'}
                </span>
              </button>
              <div className={`grid transition-all duration-200 ease-out ${openIdx === idx ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-3 px-5 pb-5 pt-1">
                    <p className="pl-4 text-sm leading-relaxed text-text-muted">{detail}</p>
                    <CodeBlock code={code} language={language ?? 'typescript'} file={file} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The autonomous dev-agent pipeline */}
      <section className="forge-panel rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5 backdrop-blur-xl">
        <h2 className="text-base font-semibold text-amber-200">The dev agent that opens its own pull requests</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The repository carries a second, deliberately separate work stream: a Python agent that picks a task
          off a JSON backlog, edits the TypeScript codebase through a tool-call loop, verifies its own work by
          running the project&rsquo;s own npm scripts, commits to a task branch, and opens a pull request. It is
          2,068 lines across 12 files, built on the standard library plus four provider SDKs. The interesting
          design decision is that the runner does not believe the model: when the model returns no tool calls,
          the runner runs verification anyway and feeds the exit code plus full output back into the
          conversation. Success is defined by the build, not by the model announcing it is finished.
        </p>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          {[
            ['Round cap', 'MAX_ROUNDS = 30, a hard cost ceiling on tool round-trips'],
            ['Tool surface', 'read_file, write_file, search_grep, run_verification — nothing else'],
            ['Verification', 'npm run check = lint && typecheck && test, the same triple CI runs'],
            ['Isolation', 'each worker gets its own git worktree, so no index.lock collisions'],
            ['Task claiming', 'a cross-process file lock; crashed claims auto-requeue after a lease'],
            ['Backlog hygiene', '10 stdlib unittest tests, no LLM calls and no external deps'],
            ['Real state', '26 tasks: 15 completed, 11 pending; state.json records 17 runs'],
            ['Shipped', 'PRs #30, #31, #33, #46, #47 — all authored by the agent, all merged'],
          ].map(([head, body]) => (
            <div key={head} className="rounded border border-zinc-700/40 bg-zinc-800/40 px-3 py-2">
              <span className="font-semibold text-text-secondary">{head}</span>
              <span className="ml-2 text-text-subtle">{body}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <CodeBlock
            file="agents/dev-agent/main.py + tools.py"
            language="python"
            code={`# The self-heal step, which is the part that makes the loop trustworthy.
#
# When the model returns NO tool calls, the runner does not take that as
# "done". It runs the project's own verification and, if that fails, feeds
# the exit code plus full stdout/stderr back as a user message with
# "Please modify the code to address these issues" and keeps looping.
#
#   run_verification()  ->  npm run check
#                       ->  npm run lint && npm run typecheck && npm run test
#
# So the agent is gated by exactly the same lint/typecheck/test triple the
# human Quality Gate uses. It cannot declare victory over a red build.

# Branch and PR mechanics:
#   create_git_branch()   stashes a dirty tree, fetches origin/main, then
#                         checks out -B dev-agent/<task-id>-<slug>.
#                         AUTOMATION_DETACH=1 detaches from origin/main
#                         instead, because in a worktree the shared main is
#                         checked out somewhere else.
#   commit_changes()      commits feat(<task-id>): <title>
#   push_and_create_pr()  gh pr create --base main, guarded by gh auth
#                         status; if unauthenticated it PRINTS the command
#                         rather than failing the run.
#
# State writes go through _atomic_write: unique temp file + os.replace, with
# a 10-attempt retry loop for transient Windows PermissionError.

# Multi-worker mode gives each worker its own git worktree (shared object
# store, independent index and HEAD). All workers point at one backlog.json
# and claim tasks through a cross-process file lock, so two workers cannot
# grab the same task. Merge serialization is delegated to branch protection
# plus GitHub auto-merge rather than reimplemented.

# replenish_backlog compares a candidate against every backlog task of ANY
# status before appending, so a task ever queued, completed, or parked is
# never re-added under a new id. That property has its own test.`}
          />
        </div>
      </section>

      {/* CI/CD */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">The Quality Gate</h2>
          <p className="mt-0.5 text-xs text-text-subtle">
            Five blocking steps on Node 24, then a legacy check name is re-posted so branch protection stays honest
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start gap-2 text-xs">
            {GATE_STEPS.map(([cmd, note], i) => (
              <div key={cmd} className="flex items-start gap-2">
                {i > 0 && <div className="flex items-center pt-3 text-zinc-600">→</div>}
                <div className="rounded-lg border border-zinc-600/50 bg-surface-control px-3 py-2 text-center">
                  <div className="font-mono font-semibold text-zinc-200">{cmd}</div>
                  <div className="mt-1 text-text-subtle">{note}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            Every step blocks. After they pass, a script step posts both a commit status and a check named
            lint-and-build onto the pull request head SHA, because that legacy name is what branch protection
            requires; the workflow comment records that the name is now attested by the full gate. Branch
            protection lists exactly one required context. Superseded pull-request runs are cancelled, while
            push runs on main never are.
          </p>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            {[
              ['ci.yml', 'The only required check. Uploads coverage as an artifact.'],
              ['deploy-pages.yml', 'Inlines 6 Firebase secrets and 2 repo variables at build time, uploads out/ with hidden files included, and retries the deploy step once on a transient failure.'],
              ['e2e.yml', 'Deliberately NOT required. Requiredness is earned by observed stability, following the security-audit precedent.'],
            ].map(([file, note]) => (
              <div key={file} className="rounded border border-zinc-700/40 bg-zinc-800/40 px-3 py-2">
                <div className="font-mono font-semibold text-text-secondary">{file}</div>
                <div className="mt-1 text-text-subtle">{note}</div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            Seven guard tests run inside that blocking gate: theme-token-guard, static-export-surface,
            workflow-audit-parity, roadmap-milestone-status, onboarding-storage-contract,
            auth-message-contract, and lockfile-version-parity. Each one compares two sources of truth rather
            than restating either, which is why they catch drift instead of encoding it.
          </p>
        </div>
      </section>

      {/* Honest limits */}
      <section className="forge-panel rounded-2xl border border-zinc-700/40 bg-zinc-900/60 p-5">
        <h2 className="text-base font-semibold text-white">What is built and tested but not switched on</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Three capabilities on this page exist as working, tested code paths that are not activated in
          production. Saying so is cheaper than having someone find out.
        </p>
        <div className="mt-4 space-y-2 text-sm text-text-muted">
          {[
            'Stripe: no repository variable holds a Payment Link, and the live pricing page carries no Stripe URL, so the CTA currently takes the mailto early-access path. The billing module and its tests are real; live payments are not.',
            'Firestore: the documented security rules have not been published, so real users stay on the local-storage fallback. The sync code path exists and is covered by tests, including 27 in the check-in store alone.',
            'The dev agent: the workflow that would run it in CI needs LLM API keys, and only the six Firebase secrets are configured on the repository. It is a locally-run pipeline with a CI harness written for it.',
          ].map((item, i) => (
            <div key={item} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-scale-xs font-bold text-amber-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-text-muted">
          The app itself is live and prerendered, so you can check the result rather than take the write-up on
          faith. For the health of the separate Cloud Run platform described in the other case studies, the{' '}
          <a
            href="#/status"
            className="rounded text-accent-text underline underline-offset-4 transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            platform status board
          </a>{' '}
          measures that live in your browser.
        </p>
      </section>

      {/* CTA */}
      <section className="forge-panel rounded-2xl border border-zinc-700/40 bg-zinc-900/60 p-5">
        <h2 className="text-base font-semibold text-white">Build something under the same constraints</h2>
        <p className="mt-2 text-sm text-text-muted">
          Whether you need a product that ships without a backend to operate, a test suite that enforces
          product rules instead of describing them, or an agent pipeline gated by your own build, the patterns
          on this page transfer directly.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#/contact" className="btn-accent px-5 py-2 text-sm">
            Start a conversation
          </a>
          <a href="#/case-studies" className="btn-neutral px-5 py-2 text-sm">
            All case studies
          </a>
        </div>
      </section>
    </PageLayout>
  )
}
