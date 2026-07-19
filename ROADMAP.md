# InfraPortal Frontend Roadmap

Frontend-only roadmap for the infraportal repo. Created 2026-07-18. The canonical platform roadmap (version sequence, backend milestones, full blocked and user-only lists) is `d:/Projects/Portfolio/microservices/ROADMAP.md`; version numbers below come from that sequence.

---

## Status (2026-07-18)

- This repo still deploys for real: GitHub Pages on merge to main. It is the only deployable surface of the platform.
- All backend infrastructure was decommissioned to zero on 2026-06-04 (Cloud SQL deleted, Cloud Run and Fly endpoints offline, data permanently gone). Every `VITE_*_API_BASE_URL` target is dead. Any feature that needs backend data must be built against a clearly marked mocked API layer, or degrade gracefully when its URL env var is unset.
- The site has two first-class surfaces:
  1. **Consulting monetization funnel** (primary since 2026-06-26): consultation intake with lead scoring and hot-lead SLA tracking, retainer pricing tiers with Stripe Payment Links and a checkout thank-you route, lead magnet landing page with hybrid delivery, admin auth gates on Consultations and Support Queue, support queue on the client dashboard.
  2. **CRM demo portal** (historical demo): still routable, but backendless since 2026-06-04.
- Verification bar: `npm run build`, `npm run test` (Vitest), the tsc CI gate, and npm audit CI. A green Pages deploy on merge is the ship signal.

## Shipped work (2026-06-01 to 2026-07-18)

- 2026-06-01: API documentation page with Swagger UI (labeled "v1.16.1" under the old private plan numbering; nav link removed during the 2026-06-26 pivot; the page awaits real specs from platform v1.16.1/.2).
- 2026-06-23 to 2026-06-26 (36 commits): monetization pivot: consultation review pipeline with lead scoring, hot-lead SLA and follow-up templates; retainer pricing plus Stripe Payment Links bootstrap and checkout thank-you route; lead magnet page with hybrid delivery; admin auth gates; support queue; tsc and npm audit CI gates; API Docs and Patch Notes links removed from nav (page files kept).
- 2026-07-18 remediation pass: stored-XSS sanitization of inbound email HTML; case studies restored and dead-backend claims removed; email lead relay fallback when `VITE_LEAD_INTAKE_URL` is unset; Pages bundle rebuilt after removing decommissioned repo variables; `VITE_SCHEDULING_URL` defaults to the Cal.com booking page.

---

## Next milestones (doable now)

Each milestone is one or two small PRs, in ship order, keeping the platform's one-minor-per-week cadence.

### v1.16.4 - Portal Bulk Ops (mocked API) - SHIPPED 2026-07-19 (PRs #20, #21 incl. the shared demo store)

- PR 1: `BulkImportModal` plus a `useBulkImport` hook with CSV parse and validation UX, against a mocked API layer with the mock boundary clearly marked in code.
- PR 2 (optional polish): bulk select and bulk edit affordances in portal lists reusing the same mocked boundary; Vitest coverage for the CSV validation logic.
- Done when: build, Vitest, and the tsc CI gate are green; the Pages deploy succeeds; the mock boundary is explicit in code (no call sites pretend the backend is live).

### v1.16.5 - Deliverable Templates and Project Cloning (mocked API) - SHIPPED 2026-07-19 (PR #22; templates + cloning + projects demo store)

- PR 1: `ProjectCloneModal` plus `TemplateLibrary` components against the same mocked API layer.
- PR 2 (optional): template CRUD UX and a clone-from-template flow, with tests.
- Done when: same bar as v1.16.4.

### v1.17 - Interactive API Playground (approved 2026-07-19; all four milestones SHIPPED 2026-07-19)

Theme design record: `d:/Projects/Portfolio/microservices/docs/design/V1_17_THEME.md`. Approved with the custom lightweight renderer (no new runtime dependencies), the API Docs nav link restored after the funnel entries, and four weekly minors. This theme absorbs the old "Follow-up tied to platform v1.16.1/.2" line (restore the nav link, point the page at the committed specs). Delivered far ahead of the weekly cadence: all four milestones shipped 2026-07-19.

- **v1.17.1 - Committed specs rendered on the site (shipped 2026-07-19).** `npm run sync-specs` converts the 11 `<service>-service/openapi.yaml` files from the sibling microservices checkout into committed JSON snapshots under `src/api-specs/` (pinned `yaml` devDependency, deterministic output, plus a small generated manifest). `ApiDocsPage` reworked into a custom client-side OpenAPI renderer: service selector from the manifest, operations grouped by tag, parameters, request/response schema trees with local $ref resolution and cycle guards, per-operation auth requirements, and ApiError-envelope tagging. Specs lazy-load as one chunk per service; the route itself is lazy so the initial bundle shrinks. Dead `GATEWAY_URL` links and the hardcoded services table deleted; page counts derive from the manifest. API Docs nav link restored after Contact. Vitest: spec-model unit tests plus a walk-every-operation catalog suite (all $refs resolve, manifest matches specs, render smoke over every operation).
- **v1.17.2 - Request builder against the demo stores (shipped 2026-07-19).** Per-operation "Try it" panel in the spec explorer: forms derived from each operation's parameters and requestBody schema (`src/features/apiDocs/tryIt/formModel.ts`, with a JSON-textarea fallback and a Form/JSON toggle so every documented error path stays reachable), executing through a new marked mock boundary (`src/lib/tryItAdapter.mock.ts`) that maps operationIds onto the demo stores: accounts/contacts/opportunities via `crmStore.mock.ts`, projects/milestones/deliverables via new direct CRUD methods on `projectsStore.mock.ts`. 28 of the 99 operations execute; the rest render an honest disabled state (no demo dataset, no fake liveness for health probes). Simulation follows the specs: 200/201/204 DTOs from real store state, VALIDATION_ERROR envelopes with each spec's exact status split (400 for accounts/contacts/projects, 422 for opportunities), 404s from store misses, contacts' cross-entity 422 INVALID_ACCOUNT checked against the demo accounts, the projects-service no-cascade delete failures reproduced as 500 DB_ERROR, axum extractor rejections (malformed JSON 400 text/plain, missing field or wrong type 422 text/plain), and X-RateLimit-* headers only where each response documents them, tagged simulated. The panel states the admin-caller simulation outright; demo-id hint chips fill path params. Vitest: 55 new tests (adapter mapping, form-model derivation, store CRUD, disabled states, per-operation panel render smoke). Builder ships inside the lazy api-docs chunk.
- **v1.17.3 - Snippets and deep links (shipped 2026-07-19).** Per-operation copyable snippets, template-driven and unit tested (`src/features/apiDocs/snippets/snippetModel.ts`): curl with the documented method, the spec's first documented server URL, a bearer placeholder for authed operations, and a POSIX-quoted JSON body preferring the visitor's current Try it values (with spec-example and schema-skeleton fallbacks); TypeScript SDK snippets using only the real `@rodmen07/infraportal-sdk` surface (typed AccountsApi for accounts CRUD, the client core's `request()` elsewhere with an honest missing-typed-module note), labeled builds-from-source / not yet on npm, plus an offline note for the decommissioned base URL and a PowerShell quoting note; a test pins the SDK's public exports so no snippet references anything the SDK does not export. Sharable deep links (`#/api-docs?service=...&op=...`, query inside the hash fragment so GitHub Pages serves the same index.html) with pure round-tripping parse/serialize (`src/features/apiDocs/deepLink.ts`), cold-load restore of the selected operation, and a per-operation Copy link affordance.
- **v1.17.4 - Drift protection and wrap-up (shipped 2026-07-19).** Cross-repo spec drift detection: `npm run check-spec-drift` regenerates the 11 spec snapshots plus the manifest through the exact `npm run sync-specs` pipeline (shared `scripts/lib/specSnapshot.mjs`) into a temp directory and byte-compares against the committed `src/api-specs/` files (over git-normalized LF content, so a Windows autocrlf working tree is not false drift), exiting nonzero with a per-file report (match / drift / missing / stale) and the documented resync command. Local runs read the sibling microservices checkout; CI runners have no sibling checkout, so remote mode fetches the canonical specs from the public microservices repo (raw.githubusercontent.com) at a pinned ref, `main` by default. New `.github/workflows/spec-drift.yml` runs the check on PRs touching `src/api-specs/` or the sync scripts plus a weekly Monday cron (cross-repo drift arrives without a PR here); path filters keep it off unrelated PRs and the committed snapshot stays authoritative for the site. Wrap-up: patch notes backfilled for v1.16 (consolidated) and v1.17.1-.4, with the patch notes data extracted to `src/pages/patchNotesData.ts` under new sanity tests; Vitest fixture-dir coverage of the snapshot build and byte-compare; this roadmap marks the theme complete.

### v1.18 - One Product: UI/UX coherence theme - PROPOSED, awaiting user review; design doc: `docs/design/V1_18_UX_THEME.md` (no implementation until the doc's decision gate is answered)

---

## Later / candidates (not scheduled)

- Quick win: find and fix the stale DynamoDB blurb (likely `DynamoDbCaseStudyPage.tsx` in this repo or the pinned portfolio repo README; locate it first).
- README truth pass: replace the pre-pivot "Task Portal Service" identity with the current funnel-plus-portal identity, remove the corrupted duplicated productionizer-bot blocks (repeated loading-skeleton rows, duplicate PRODUCTIONIZER:START markers; last bot run 2026-04-25), update env-var guidance that still points at decommissioned backend URLs, and add a one-line pointer to this roadmap.
- Coordinated Vite major upgrade to clear the npm audit findings that `npm audit fix` could not address (noted in README since 2026-04-12).

---

## BLOCKED (do not pick up)

- Client email notifications and activity feed (old plan v1.16.10): needs a live backend and email service; decommissioned 2026-06-04.
- Any feature requiring live CRM data: backend offline. Use the mocked API layer, or wait for the infra-rebuild decision (USER-ONLY, not made).

## USER-ONLY

- Stripe and any paid-account actions (Payment Links are bootstrapped; product, price, or account changes need the user).
- Publishing the drafted LinkedIn post.
- The infra-rebuild decision.

---

## History note

The repo README still opens with the pre-pivot "Task Portal Service" identity (Kanban board, AI goal planner) from before the CRM portal era and the 2026-06-26 monetization pivot. Until the README truth pass lands, treat this roadmap's Status section as the current identity statement.
