# infraportal — RM Cloud Consulting

The public front end of the RM Cloud Consulting platform: a consulting funnel, a live
platform status board, an interactive API playground, and a CRM + client-portal demo,
shipped as one static React bundle on GitHub Pages.

- **Live site:** <https://rodmen07.github.io/infraportal/>
- **Current milestone, decisions and shipped history:** [ROADMAP.md](ROADMAP.md)
- **Backend:** the 11-service Rust/Axum workspace in the sibling `microservices` repo,
  fronted by the `go-gateway` API gateway on Cloud Run. This repo talks to it over HTTP
  and never bundles it.

There is no server in this repo. Every route is client-rendered from a hash router, so
the whole site is a `dist/` directory served by GitHub Pages.

## What ships here

| Surface | Route | What it is |
|---|---|---|
| Consulting funnel | `#/services`, `#/pricing`, `#/retainers`, `#/contact` | Offer pages, a four-field consultation form with lead scoring, retainer tiers backed by Stripe Payment Links, and a `#/checkout-thank-you` return route. |
| Platform status board | `#/status` | Real per-service health read live from the gateway's upstream aggregate, plus an SSE activity feed over `event-stream-service`. Degrades to a readable offline state rather than a blank card. |
| API playground | `#/api-docs` | The 11 committed OpenAPI specs in `src/api-specs/`, rendered by a custom client-side renderer, with a per-operation "Try it" runner against marked in-browser demo stores. |
| CRM and client portal demo | `#/crm/admin`, `#/portal` | The CRM admin console and the client portal, backed by a seeded in-browser demo store and labelled with a demo badge. |
| Case studies and proof | `#/case-studies`, `#/about`, `#/patch-notes` | Delivery evidence, the open-source crates strip, and the release log. |
| Discovery affordances | any route | A guided product tour, a Cmd/Ctrl-K command palette with global search, and a real 404 page for unmatched hashes. |
| Lead magnet | `#/lead-magnet` | Email capture with immediate on-page artifact delivery (`#/infrastructure-audit-checklist` plus a printable copy). |

Admin-gated views (`#/admin/consultations`, `#/admin/support`, `#/admin/audit`,
`#/admin/health`, `#/crm/reports`, `#/search`, `#/observaboard`) sit behind the admin
key and are deliberately not linked from the marketing nav.

## Tech stack

| Layer | Technology |
|---|---|
| UI framework | React 19 |
| Build tool | Vite 8 |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 3.4 driven by CSS custom properties in `src/styles/tokens.css` |
| Routing | Hash router in `src/main.tsx` (no router dependency), route-level code splitting |
| Tests | Vitest 4 in the `node` environment |
| Linting | ESLint 10 + typescript-eslint + react-hooks + react-refresh |
| Deployment | GitHub Pages via GitHub Actions |

`package.json` is the source of truth for exact versions; the majors above are asserted
against it by `src/features/site/repoIdentity.test.ts`, so this table cannot silently
rot after an upgrade.

## Run locally

```bash
npm install
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the repo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, single run |
| `npm run test:coverage` | Vitest with v8 coverage |
| `npm run sync-specs` | Copy the OpenAPI specs from the microservices repo into `src/api-specs/`. Add `-- --source remote --ref <sha-or-branch>` to fetch them from the public repo instead of a sibling checkout |
| `npm run check-spec-drift` | Fail if the committed specs differ from their source. Takes the same `--source` / `--ref` flags |
| `npm run stripe:setup-links` | Bootstrap Stripe products, prices and Payment Links (see below) |

## Environment configuration

```bash
cp .env.example .env.local
```

`.env.example` is the authoritative list and documents each variable inline. Two
contracts are worth calling out because getting them wrong is not obvious:

- **`VITE_LEAD_INTAKE_URL`** must point at a PUBLIC intake endpoint or proxy. Do not
  point it at an authenticated CRM endpoint such as `contacts-service /api/v1/contacts`.
  When it is unset the site falls back to an email relay so leads still arrive.
- **`VITE_GATEWAY_URL`** defaults to the deployed gateway, so `#/status` works on the
  production build with no extra configuration.

### Stripe Payment Links

```bash
npm run stripe:setup-links -- --dry-run   # preview, no API call
npm run stripe:setup-links                # create products, prices and links
```

The script creates one product, price and Payment Link per pricing tier, writes the
resulting `checkoutUrl` values into `public/content/pricing.json`, and records the
generated ids in `public/content/stripe_payment_links.json`. Each link redirects to
`#/checkout-thank-you?tier=<slug>` with the tier inside the fragment, which is where
the hash router can read it; `scripts/lib/checkoutRedirect.mjs` owns that URL shape and
is imported by both the generator and its test so the two cannot drift.

## Tests and CI gates

`.github/workflows/test.yml` runs on every pull request with Node 24:

```bash
npm ci
npm audit --omit=dev --audit-level=moderate
npm run typecheck
npm run lint
npm run test:coverage
npm run build
```

A second job, **Full-tree audit (advisory)**, runs `npm audit --audit-level=moderate`
over the whole tree including devDependencies. It is deliberately NOT a required
context: it makes dev-tool advisories visible without letting a toolchain
advisory block delivery of the app (DEP-AUDIT-SCOPE-1, owner decision
2026-08-10). A red there is a triage item, not a broken build.

That job runs on **pull requests only**. `.github/workflows/security-audit.yml`
carries the calendar arm: a daily cron auditing **both** scopes in two jobs,
`Scheduled security audit` (`--omit=dev`) and `Scheduled full-tree audit
(advisory)` (whole tree). Neither is a required context either.

(Until 2026-08-13 the advisory job also ran on pushes to `main`, and this block
read: *"A red there is a triage item, not a broken build."* — which was true and
was not a mechanism. A dev-tree advisory would have shown the whole **Tests**
run on `main` as failed while all five required contexts stayed green, which is
indistinguishable from a broken `main` to anyone who does not open the run.
ADVISORY-RED-MAIN-1 moved the cadence to the daily cron instead of relying on
the note. The push arm fired on our commit rate — measured gaps of up to 76 h —
so the daily cron is a tightening, not a swap.)

(This block read `--audit-level=high` until 2026-08-10. The threshold moved to
`moderate` in PR #137 on 2026-08-07, after GHSA-55q2-fjhq-7xh7 — a moderate XSS
in dompurify, the app's only HTML sanitiser — sat in a direct production
dependency while the `high` gate exited 0.)

The required contexts on `main` are **Build**, **Linting**, **Type Check**,
**Unit Tests** and **GitGuardian Security Checks**, with strict up-to-date branches.
`.github/workflows/spec-drift.yml` additionally checks the committed OpenAPI specs
against their source on spec-touching pull requests and on a weekly schedule.

Much of the suite is made of **drift guards** rather than unit tests: source scans that
read two artifacts which must agree and fail when they diverge. The ones worth knowing
about before adding code:

- `src/styles/tokens.test.ts` — every CSS class used in `.tsx` must actually be defined
  (a class that does not exist renders an invisible card, which has shipped here twice).
- `src/styles/colorThemeCoverage.test.ts` and `typeScaleFloor.test.ts` — no raw
  palette class without a light-theme override, and a 12px type-scale floor.
- `src/features/layout/routeIntegrity.test.ts` — every internal destination in the nav,
  command palette and guided tour resolves against the router vocabulary parsed out of
  `src/main.tsx`.
- `src/features/site/contentContract.test.ts` — every committed `public/content/*.json`
  file a hook fetches must parse, satisfy what its consuming components dereference
  (a mis-shaped tier crashes the pricing grid; a malformed file silently empties it),
  and carry only internal links the router resolves; files no hook fetches must be
  excused by name with a live reason.
- `src/features/site/runtimeStatusCopy.test.ts` — no source file may assert a platform
  runtime status or a present-tense infrastructure cost, because a static bundle cannot
  know either; `#/status` measures them instead.
- `src/features/site/repoIdentity.test.ts` — this README must keep naming the current
  product identity, link the roadmap, name only routes the router handles, and agree
  with `package.json` on the stack majors.
- `src/features/site/conversionInstrumentation.test.ts` — every analytics call site uses
  a name from the typed event registry (`src/utils/analyticsEvents.ts`), every declared
  conversion surface carries tracking, and no registered name goes unused.
- `src/features/site/setStateInEffect.test.ts` — `react-hooks/set-state-in-effect` runs
  at `error` for every file except the shrinking legacy list in `eslint.config.js`, and
  no listed file may keep its exemption after it stops violating the rule.
- `src/features/portal/portalStoreSubscription.test.ts` — the portal panels read the
  localStorage-backed onboarding and support stores through `useSyncExternalStore`, so a
  write from one panel reaches its siblings; every store mutator must notify, and no
  panel may mirror a store into state inside an effect.
- `src/features/site/analyticsSink.test.ts` — an analytics sink's forwarding code in
  `src/utils/analytics.ts` and its loader script in `index.html` must arrive and leave
  together (no dispatching into a void, no sink that drops funnel events), and every
  drift-guard path this README names must exist on disk.

## Deployment

`.github/workflows/deploy-pages.yml` builds and publishes to GitHub Pages on every push
to `main`, so a merge is a deploy. The production base path (`/infraportal/`) is set in
`vite.config.js`. Build-time environment values come from repository secrets and
variables listed in the workflow's build step; in repository settings, Pages must be set
to build from **GitHub Actions**.

## History

**Renamed 2026-07-25.** This repository shipped from 2025 to mid-2026 as
**Task Portal Service**, a single-page task manager with a Kanban board, an AI goal
planner and story-point gamification. That product was retired across two pivots (the
CRM portal era, then the 2026-06-26 consulting monetization pivot) and none of it
remains in the codebase. The name outlived the product in this README and in the
`package.json` package name until this pass; [ROADMAP.md](ROADMAP.md) carries the full
shipped record.
