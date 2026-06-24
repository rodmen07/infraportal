# Task Portal Service

Single-page task management portal built with React 19, Vite 5, TypeScript (strict), and Tailwind CSS. Integrates with a Rust/Axum REST API, a Python JWT auth service, and an AI orchestrator for goal-based task planning. Content is CMS-editable via Decap CMS with GitHub OAuth.

## Features

- **Kanban board** — drag-and-drop task cards across To Do / In Progress / Done columns
- **AI goal planner** — describe a short-term goal and generate composite task breakdowns via an LLM orchestrator
- **Story-point gamification** — earn story points for completing tasks; track your writing-tier progression (poem → paragraph → short story → novel → epic)
- **Scroll-spy navigation** — sticky side nav with IntersectionObserver-driven active-section highlighting
- **Progress HUD** — always-visible sticky bar showing completion %, done/pending counts, signed-in status
- **Admin dashboard** — metrics, request logs, and user activity panels (admin role required)
- **Decap CMS** — edit homepage content, FAQ, and highlight cards from a browser-based admin UI backed by GitHub
- **JWT authentication** — sign in / sign out / create username with role-based access (user, planner, admin)
- **Responsive design** — mobile-first layout with XL sidebar breakpoint

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 19 |
| Build tool | Vite 5 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3.4 |
| Linting | ESLint 9 + typescript-eslint + react-hooks + react-refresh |
| CMS | Decap CMS (GitHub backend) |
| Deployment | GitHub Pages via Actions |

## Project structure

```
src/
├── api/              # HTTP clients for auth-service and task-api-service
├── features/
│   ├── admin/        # Admin dashboard section and hook
│   ├── auth/         # Session panel and auth session hook
│   ├── layout/       # ProgressHud, SideNav, useScrollSpy
│   ├── site/         # SiteHeader, HomeSections, FaqSection, CMS content hooks
│   └── tasks/
│       ├── kanban/   # KanbanBoard, KanbanCard, KanbanColumnPanel, helpers
│       ├── TaskManagerSection.tsx
│       ├── useTaskManager.ts
│       └── planNormalization.ts
├── App.tsx           # Root layout wiring hooks and sections
├── config.ts         # Runtime environment config with validation
├── types.ts          # Shared TypeScript interfaces
├── index.css         # Tailwind directives + custom animations
└── main.tsx          # React DOM entrypoint
```

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Test

```bash
npm run test
```

## Goal planner

- Enter a long-term goal in the planner form and generate composite tasks.
- Create generated tasks in bulk and manage them from the task list.

## Environment configuration

Create a local env file from `.env.example`:

```bash
cp .env.example .env.local
```

Commonly used variables:

- `VITE_MONITORING_URL`
- `VITE_AI_ORCHESTRATOR_URL`
- `VITE_AUTH_SERVICE_URL`
- `VITE_SCHEDULING_URL`
- `VITE_PROJECTS_API_BASE_URL`
- `VITE_CONTACTS_API_BASE_URL`
- `VITE_ACCOUNTS_API_BASE_URL`
- `VITE_OPPORTUNITIES_API_BASE_URL`
- `VITE_ACTIVITIES_API_BASE_URL`
- `VITE_AUTOMATION_API_BASE_URL`
- `VITE_INTEGRATIONS_API_BASE_URL`
- `VITE_SEARCH_API_BASE_URL`
- `VITE_REPORTING_API_BASE_URL`
- `VITE_AUDIT_API_BASE_URL`
- `VITE_OBSERVABOARD_URL`
- `VITE_SPEND_API_BASE_URL`

## GitHub Pages deployment

This repo includes a workflow at `.github/workflows/deploy-pages.yml`.

- Trigger: push to `main`
- Build output: `dist/`
- Deploy target: GitHub Pages
- Build env is populated from repository secrets/variables listed in the workflow `Build` step.

### Required repo settings

In GitHub repo settings:

1. Go to **Pages**.
2. Set **Build and deployment** source to **GitHub Actions**.
3. Go to **Secrets and variables → Actions** and set the env vars used by the workflow (API base URLs, monitoring/auth/orchestrator URLs, admin secrets).

Vite production base path is configured for this repo path (`/infraportal/`) in `vite.config.js`.

## Security and reliability hardening

## Latest audit and reporting polish

This iteration improved the operations workflows in a few practical ways:

- The audit log now gives faster context with summary cards, quick presets, and better empty-result recovery.
- The reports workspace now offers clearer first-run guidance and a more polished management header.

## Recent UI polish updates

The latest infraportal polish pass improved the client-facing experience in a few key areas:

- The hero now includes a proof strip above the fold so visitors see concrete delivery evidence before the CTA.
- The homepage, pricing, and contact flow now emphasize productized consulting offers, paid discovery, and clear proposal requests.
- The hero and process sections now surface the configured scheduling link directly when `VITE_SCHEDULING_URL` is set, reducing booking friction.
- The contact page now reuses the pricing trust strip and FAQ so prospects see proof and objections handling before submitting the form.
- Consultation intake now computes lead score and priority (hot/warm/nurture) from engagement type, budget, timeline, and response detail so high-value prospects are reviewed first.
- Consultations admin now includes a compact pipeline strip (new-to-reviewed, reviewed-to-accepted, and overall acceptance rates) plus priority quick filters to triage hot leads faster.
- Hot leads now display a first-response SLA state (clock, met, missed) using a 2-hour target once intake moves from new to reviewed.
- Consultation cards now include one-click follow-up template copy (priority-aware subject and message body) to speed first outreach.
- Contact pages now surface an optional booking link from `VITE_SCHEDULING_URL` so prospects can jump straight to a 30-minute call when a calendar URL is configured.
- Shared navigation now uses clearer grouped sections across mobile and desktop layouts.
- The contact page provides better submission guidance, live message feedback, and clearer sending states.
- Search now presents a more structured query workspace with grouped result summaries.
- The user dashboard highlights workspace status more clearly and improves overall scanability.


- Added unit tests for core status/time behavior:
  - `src/utils/time.test.ts`
  - `src/features/site/useGitHubBuildStatus.test.ts`
- Build status polling now:
  - cancels in-flight requests before new polls,
  - uses timeout-driven aborts,
  - avoids stale caching (`cache: 'no-store'`),
  - avoids set-state-after-unmount behavior.
- Relative time formatting now safely handles invalid and future timestamps.
- Applied non-breaking dependency remediations via `npm audit fix`.
- Remaining audit findings are tied to Vite major upgrades and should be addressed in a coordinated framework upgrade.


| `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ || `loading-skeleton` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |<!-- PRODUCTIONIZER:START -->
## Productionizer Agent

Near-autonomous UI/UX improvement agent powered by **Gemini 2.5 Flash**. Each workflow run picks the next pending task from the matrix below, applies the fix, verifies with `tsc` + `eslint`, and opens a PR against this repo.

**Source**: [rodmen07/portfolio — agents/productionizer](https://github.com/rodmen07/portfolio/tree/main/agents/productionizer) · Triggered manually via `workflow_dispatch` · Runs in 15–60 min windows

---

### Progress

**22 / 30 tasks complete** (73%)

`█████████████████████░░░░░░░░░`

### Task Matrix

| Gap | Portal | CrmAdmin | Audit | Reports | Observaboard | Search | ServiceHealth | UserDashboard | PortalLogin | Contact |
|-----|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|

| `empty-state` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |<!-- PRODUCTIONIZER:START -->
## Productionizer Agent

Near-autonomous UI/UX improvement agent powered by **Gemini 2.5 Flash**. Each workflow run picks the next pending task from the matrix below, applies the fix, verifies with `tsc` + `eslint`, and opens a PR against this repo.

**Source**: [rodmen07/portfolio — agents/productionizer](https://github.com/rodmen07/portfolio/tree/main/agents/productionizer) · Triggered manually via `workflow_dispatch` · Runs in 15–60 min windows

---

### Progress

**22 / 30 tasks complete** (73%)

`█████████████████████░░░░░░░░░`

### Task Matrix

| Gap | Portal | CrmAdmin | Audit | Reports | Observaboard | Search | ServiceHealth | UserDashboard | PortalLogin | Contact |
|-----|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|

| `error-ux` | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

> ✅ = PR opened (or task already satisfied) · ⬜ = pending

### Next task

`AuditPage` / `error-ux`

### Recently completed

- **UserDashboardPage** / `loading-skeleton` — UserDashboardPage: replaced 'Loading...' texts and implicit loading states for cards, core metrics, opportunity distribution, and recent activities with dedicated skeleton components — provides a better user experience by previewing content layout.
- **ServiceHealthPage** / `loading-skeleton` — ServiceHealthPage: Replaced 'Loading...' text and generic loading states with `ServiceHealthCardSkeleton` and `SummaryBarSkeleton` components, and made the initial data fetch asynchronous in `useEffect` to prevent cascading renders — this provides a more structured and visually appealing loading experience that matches the content layout.
- **SearchPage** / `loading-skeleton` — SearchPage: replaced the search input spinner with a pulsing search icon and added a `SearchResultsSkeleton` for displaying during search result loading — provides a better visual cue for ongoing searches and previews content layout.
- **ObservaboardPage** / `loading-skeleton` — ObservaboardPage: replaced `Spinner` with `ObservaboardTableSkeleton` — matches table layout, eliminates layout shift and provides a better loading experience.
- **ReportsPage** / `loading-skeleton` — ReportsPage: replaced loading spinner with ReportsViewSkeleton, DashboardCardSkeleton, and ReportTableSkeleton components — provides a visual preview of the page layout during loading.

### Stop conditions

The agent pauses automatically when:
- ⏱ The configured time window (15 / 30 / 45 / 60 min) is exhausted
- ⚠️ 25 or more open PRs are awaiting review
- ❌ An unrecoverable error occurs

### Last run

2026-04-25 18:36 UTC

*Updated automatically by productionizer-bot · Do not edit between these markers*
<!-- PRODUCTIONIZER:END -->
