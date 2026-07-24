# InfraPortal Frontend Roadmap

Frontend-only roadmap for the infraportal repo. Created 2026-07-18. The canonical platform roadmap (version sequence, backend milestones, full blocked and user-only lists) is `d:/Projects/Portfolio/microservices/ROADMAP.md`; version numbers below come from that sequence.

---

## Status (2026-07-23)

- This repo deploys for real: GitHub Pages on merge to main. It is the primary public surface of the platform.
- **The backend platform is LIVE again (corrected 2026-07-23; the prior "decommissioned to zero, every endpoint dead, mock everything" status was FALSE and is deleted).** Cloud SQL was rebuilt 2026-07-21 (`microservices-489413:us-south1:microservices-pg`) and the 11 Cloud Run services deploy on every merge to microservices `main`. Verified live 2026-07-23: the go-gateway aggregate `GET https://go-gateway-5gcrg4oiza-uc.a.run.app/health/upstreams` returns **HTTP 200**, and `accounts-service /health` returns **200**. Two components are honestly down: `auth` can 503 on cold start (bounded-retry candidate), and `tasks`/`task-api` (Fly) is genuinely offline (GW-6, reviving it is a user cost decision). So live endpoints are a legitimate verification target again — features that read platform data may read the live gateway, and tests must not depend on the network (fixture the payload and cover the degraded/offline path).
- Public surfaces on the marketing site:
  1. **Consulting monetization funnel** (primary since 2026-06-26): consultation intake with lead scoring and hot-lead SLA tracking, retainer pricing tiers with Stripe Payment Links and a checkout thank-you route, lead magnet landing page with hybrid delivery, admin auth gates on Consultations and Support Queue, support queue on the client dashboard.
  2. **Public Platform Status board** (`#/status`, shipped 2026-07-23, NF-1): real per-service health read from the live gateway aggregate, with a live SSE **activity feed** (NF-4) over event-stream-service.
  3. **Interactive API playground** (`#/api-docs`, v1.17): all 11 committed OpenAPI specs rendered client-side with a per-operation "Try it" runner against marked demo stores.
  4. **CRM demo portal** (`#/crm/admin`, `#/portal`): the CRM admin console and client portal, backed by an in-browser demo store with an honest demo badge.
  5. **Discovery affordances:** a guided product tour (NF-2) and a Cmd/Ctrl-K command palette + global search (NF-3).
- Verification bar: `npm run build`, `npm run test:coverage` (Vitest), the `tsc` typecheck gate, `eslint .`, and `npm audit` CI, plus the `Build` required check (added 2026-07-22, PR #47) so a broken production build cannot merge green. A green Pages deploy on merge is the ship signal. `main` is branch-protected.

## Shipped work

### Through 2026-07-18 (history)

- 2026-06-01: API documentation page with Swagger UI (later reworked into the custom renderer under v1.17).
- 2026-06-23 to 2026-06-26 (36 commits): monetization pivot: consultation review pipeline with lead scoring, hot-lead SLA and follow-up templates; retainer pricing plus Stripe Payment Links bootstrap and checkout thank-you route; lead magnet page with hybrid delivery; admin auth gates; support queue; tsc and npm audit CI gates.
- 2026-07-18 remediation pass: stored-XSS sanitization of inbound email HTML; case studies restored; email lead relay fallback when `VITE_LEAD_INTAKE_URL` is unset; `VITE_SCHEDULING_URL` defaults to the Cal.com booking page.

### 2026-07-19 to 2026-07-23 (the shipping run)

Delivered far ahead of the one-minor-per-week cadence. Every entry below is a merged, deployed PR (verified against gh state 2026-07-23).

- **v1.16.4 - Portal Bulk Ops (mocked API)** - SHIPPED 2026-07-19 (PRs #20, #21): `BulkImportModal` + `useBulkImport` CSV parse/validation, bulk select/edit, and the shared seeded demo store.
- **v1.16.5 - Deliverable Templates and Project Cloning** - SHIPPED 2026-07-19 (PRs #22 + template CRUD): `ProjectCloneModal`, `TemplateLibrary`, `TemplateEditorModal`, and `src/lib/projectStatusVocabulary.ts` as the single spec-derived status source of truth, locked by a drift-guard test against `src/api-specs/projects-service.json` (fixed a real bug: the admin tab offered off-spec deliverable statuses the service rejects).
- **v1.17 - Interactive API Playground** - all four milestones SHIPPED 2026-07-19 (PRs #23-#26). Design record: `microservices/docs/design/V1_17_THEME.md`. v1.17.1 committed specs rendered by a custom client-side OpenAPI renderer; v1.17.2 per-operation "Try it" runner against marked demo stores (28 of 99 operations execute, rest honestly disabled); v1.17.3 copyable curl/SDK snippets + sharable deep links; v1.17.4 cross-repo spec-drift detection (`npm run check-spec-drift` + `.github/workflows/spec-drift.yml`, weekly cron).
- **v1.18 - "One Product" UI/UX coherence theme** - design doc `docs/design/V1_18_UX_THEME.md`, APPROVED 2026-07-19 (user "defaults approved" to D1-D11, PR #30).
  - v1.18.1 (PRs #31, #32): token foundation (`src/styles/tokens.css` + `tailwind.config.js`), shared chrome onto tokens, seven override-sheet groups deleted; fixed F1 (invisible dark-mode cards), F3 (theme flash), and the `.btn-sm`/`.interactive-card` ghosts.
  - v1.18.2 (PRs #34, #35): one nav (SideNav retired), one brand ("RM Cloud Consulting"), one page anatomy (shared `PageHeader`), real focus-trap/Escape/skip-link a11y.
  - v1.18.3 (PR #36; QA follow-up #37): calm hero motion (D6), "free 30-minute discovery call" copy (D8), 4-field contact form (D9), ProofStrip on Home, OG/Twitter meta tags.
  - v1.18.4 (PRs #38, #40; hotfix #41): shared UI primitives (`Badge`/`Button`/`Card`/`DataTable`/`EmptyState`), D5 type scale (16px root, 12px floor), the two named repo-wide contrast bugs fixed for every variant. Override-sheet deletion did NOT happen here (the sheet grew 124 → 229 as more contrast fixes needed more overrides); retargeted to v1.18.6. Hotfix #41 fixed a `*/`-in-CSS-comment build break that no required check caught (which is why the `Build` gate #47 was later added).
  - **v1.18.5 - route-level code splitting** - SHIPPED 2026-07-21 (PR #44): initial chunk 800.54 kB → 387.92 kB (−51.5%), gzip 219.56 → 120.32 kB; `RouteLoadingFallback` renders the real shell so the load-watchdog stays satisfied.
  - **v1.18.6 - Override-sheet retirement** - EXECUTED 2026-07-22 (re-scoped 2026-07-21 after a measured analysis, PR #46; user-approved HYBRID plan). The `Build` required check landed first (PR #47). Text-token migration slices #49, #52, #55 plus the split-module migration retired dead rules and ratcheted the sheet down (230 → 221). Two regressions the "zero-shift" plan did not anticipate were found in later adversarial review and fixed: an orphaned `[data-theme="dark"] .text-zinc-500` bump re-failed WCAG AA on ~49 caption surfaces (fix #56, root of lesson L-028), and an orphaned `pre.text-zinc-*` rule lost code-block dark backgrounds in light mode (fix #57). **The non-fenced text retirement is COMPLETE**; the remaining `bg-zinc`/`border-zinc` and status families are NOT mechanical renames and are deferred to v1.19 D11/D12 as design decisions.
  - **CH-1 - split CrmAdminPage / PortalPage** - DONE 2026-07-22 (behavior-preserving): `PortalPage.tsx` 1100 → 253 (PR #53), `CrmAdminPage.tsx` 2187 → 101 (PR #54), the extracted modules migrated onto tokens (#55). This unblocked the two fenced hotspots that had held the last 56 override rules.
- **v1.19 - semantic-token consolidation** (user-approved 2026-07-22; the surface/status token systems already existed and were partially adopted, so this is migration, not construction).
  - **D12 status-text migration - COMPLETE** (PRs #60, #61, #63): all status text roles (danger/success/warning/caution/info) migrated onto the pre-existing semantic `-text` tokens; danger hover/opacity variants and the two sky badges resolved in #63; amber/purple/violet/cyan/teal left as brand/decorative accents. Ratchet 221 → 212.
  - **D11 surface/elevation migration - IN PROGRESS** (PR #62 slice 1: exact-match neutral fills onto surface tokens, 212 → 210). Remaining safe slices roll out after the user glances at live results; the solid-fill and recessed-scrim families are HELD pending new token decisions (backgrounds are high visual risk and cannot be eyeball-verified by autodev).

### NET-NEW FEATURE QUEUE (shipped 2026-07-23; user directive "high-impact net-new features")

Ranked by impact on the portfolio's actual job (credibility + conversion for the job/contract hunt).

- **NF-1 - Live Platform Status Board** (`#/status`) - SHIPPED. go-gateway PR #11 made the aggregate browser-consumable (HTTP 200 when degraded, real `Access-Control-Allow-Origin`, corrected `events` upstream, honest `tasks` state) and fixed a HIGH latent bug (CORS `ALLOWED_ORIGINS` was set nowhere, so every cross-origin browser call was already failing). Board shipped as infraportal PR #65: pure tested model (`statusModel.ts`) + thin page, per-service tiles, overall banner, auto-refresh honoring reduced motion, offline fallback that never blanks.
- **NF-2 - Guided product tour** - SHIPPED (PR #68): a global, persistent, non-focus-trapping floating card deep-linking through the real surfaces; honest routing (only surfaces viewable without a login; the login-gated portal is deliberately excluded).
- **NF-3 - Command palette + global search** (Cmd/Ctrl-K) - SHIPPED (PR #66): pages derived from the nav so palette/nav cannot drift, plus status/case-studies/portal/actions; deterministic ranker; full listbox a11y.
- **NF-4 - Real-time activity feed** - SHIPPED (PR #67): live SSE feed on the public status page over event-stream-service. The hub is CORS-correct but has no production publisher yet, so the feed leads with its connection state and a calm empty state.
  - **NF-4b (follow-up):** wire a real server-side (JWT-holding) publisher so the feed is non-empty. Recommended default: go-gateway publishes an event on each successful deploy and on upstream status transitions.
- **NF-5 - slokit dogfooding + `slokit simulate`** - SHIPPED in the crates repo (slokit PRs #15, #16).
- **QA route-integrity guard** - SHIPPED 2026-07-23 (PR #69): a drift test that parses the router's route vocabulary out of `main.tsx` and asserts every internal destination in the nav, command palette, and guided tour resolves to a real route (the fallback is Home, so a typo'd destination silently lands there). No live bug; regression guard.

---

## Next milestones (candidates)

The v1.16-v1.18 themes are complete and the NF-1..NF-5 queue shipped. Remaining scheduled-ish work:

- **v1.19 D11 - surface/elevation migration** (in progress): roll out the remaining safe surface/border slices after a user glance; the solid-fill/recessed-scrim families are HELD pending new token decisions.
- **NF-4b - real activity-feed publisher** (see above).
- **Cost Intelligence** (old plan v1.16.5-.7): the infra half is unblocked (platform is live), but it specifically needs a GCP **billing export to BigQuery** (`GCP_BILLING_DATASET`/`GCP_BILLING_TABLE` read by `spend-service`), which was never recreated. Blocked on that export, not on infra.

## Later / candidates (not scheduled)

- **infraportal README truth pass:** the README still opens with the pre-pivot "Task Portal Service" identity and points env-var guidance at old backend URLs; replace with the current funnel-plus-portal identity, remove corrupted duplicated productionizer-bot blocks, add a pointer to this roadmap.
- **api-specs stale text (filed as a bug 2026-07-23):** all 11 `src/api-specs/*.json` `description` fields still say "All runtime endpoints have been offline since 2026-06-04, when the platform infrastructure was decommissioned to zero" — now FALSE and rendered live on `#/api-docs`. The fix is in the microservices spec source + a re-sync (the drift check makes hand-editing the snapshots revert), so it is a cross-repo increment, not a local edit.
- **DynamoDB blurb:** find and fix the stale DynamoDB claim (likely `DynamoDbCaseStudyPage.tsx` or the pinned portfolio repo README).
- **Vite major upgrade** to clear the last 2 npm-audit findings (esbuild/vite, dev-server-only, so LOW real-world impact for a static Pages build); its own increment with a Vite 7→8 compat check.

---

## BLOCKED (do not pick up)

- **Cost Intelligence billing pull:** needs a GCP billing export to BigQuery (see Next milestones). CLEARS WHEN: the export dataset exists and the env vars are set on spend-service.
- **Client email notifications:** no longer blocked on the backend (it is live); still needs an email service configured and a server-side publisher. Reframe before working: the "needs a live backend" blocker cleared 2026-07-21.

## USER-ONLY

- Stripe and any paid-account actions (Payment Links are bootstrapped; product/price/account changes need the user).
- Publishing the drafted LinkedIn post.
- Any action that creates a billable cloud resource or mutates running infrastructure (read-only cloud probes are allowed). The infra-rebuild decision itself was MADE by the user 2026-07-21 and is no longer pending. Recurring cost now accruing: Cloud SQL db-f1-micro (~$8-10/mo) plus Artifact Registry image growth (11 images per microservices merge, no retention policy yet).

---

## History note

The repo README still opens with the pre-pivot "Task Portal Service" identity (Kanban board, AI goal planner) from before the CRM portal era and the 2026-06-26 monetization pivot. Until the README truth pass lands (a Later candidate above), treat this roadmap's Status section as the current identity statement.
