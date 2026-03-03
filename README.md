# Frontend Service

Frontend project for the tutorial ecosystem, built with React + Vite + TypeScript, styled with Tailwind CSS, and integrated with a free open-source CMS (Decap CMS).

## Tech stack

- React 19 + Vite 5
- TypeScript (strict mode)
- Tailwind CSS (utility-first styling)
- Mermaid (goal/task visual diagrams)

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Goal planner and diagrams

- Enter a long-term goal in the planner form and generate composite tasks.
- Create generated tasks in bulk and manage them from the task list.
- Every generated plan is visualized as a Goal → Tasks diagram in the **Goal Diagrams** section.

## API base URL strategy

Frontend reads API base URL from `VITE_API_BASE_URL`.

- Local default: `http://localhost:3000`
- Production default fallback: `https://backend-service.example.com`

Create a local env file from `.env.example` when needed:

```bash
cp .env.example .env.local
```

Then set:

```bash
VITE_API_BASE_URL=https://your-backend-host
```

## GitHub Pages deployment

This repo includes a workflow at `.github/workflows/deploy-pages.yml`.

- Trigger: push to `main`
- Build output: `dist/`
- Deploy target: GitHub Pages
- Build env supports `VITE_API_BASE_URL` from GitHub repo settings

### Required repo settings

In GitHub repo settings:

1. Go to **Pages**.
2. Set **Build and deployment** source to **GitHub Actions**.
3. Go to **Secrets and variables → Actions** and set one of:
	- Repository Variable: `VITE_API_BASE_URL` (preferred)
	- Repository Secret: `VITE_API_BASE_URL`

Vite production base path is configured for this repo path (`/frontend-service/`) in `vite.config.js`.

## CMS integration (Decap CMS)

- Admin URL (dev): `/admin/`
- Admin URL (Pages): `/frontend-service/admin/`
- CMS config: `public/admin/config.yml`
- Editable homepage content source: `public/content/site.json`

### Notes for GitHub-backed CMS auth

Decap CMS is free/open-source, but GitHub backend editing requires an OAuth flow provider.
Typical options:

- Netlify Identity + Git Gateway (if hosted via Netlify)
- Self-hosted OAuth proxy for GitHub (if hosted elsewhere, including GitHub Pages)

The current config is ready for GitHub repo wiring and content structure, and can be finalized once your auth flow choice is made.

## Working context from current code

### App flow and state

- Main UX flow is implemented in `src/App.tsx`.
- App loads editable site content from `content/site.json` (base-aware path handling).
- Planner state includes transient generated tasks and a local in-memory history of recent plans.
- Goal plan history is currently capped to the latest `8` plans.

### API layer behavior

- Backend calls are centralized in `src/api/tasks.ts`.
- Error parsing prefers backend envelope fields (`message`, then `code`) before status fallback.
- Current task listing request uses `GET /api/v1/tasks?limit=100&offset=0`.

### Planner UX and resilience

- Planner request uses backend `POST /api/v1/tasks/plan` via `planTasksFromGoal`.
- Generated tasks are normalized client-side to remove numbering and bullet prefixes.
- UI maps known backend planner errors (`LLM_API_KEY_MISSING`, upstream/rate-limit signals) to friendly status messages.

### Diagram rendering details

- Goal diagrams are rendered by `src/components/GoalDiagram.tsx` using Mermaid.
- Mermaid is initialized once per app lifecycle.
- Diagram labels are sanitized to reduce invalid Mermaid syntax from user/model text.

### Build/deploy implementation details

- `vite.config.js` sets production base path to `/frontend-service/`.
- GitHub Pages deploy workflow injects `VITE_API_BASE_URL` from repository variables/secrets.
