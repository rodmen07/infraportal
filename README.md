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
