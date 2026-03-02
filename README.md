# Frontend Service

Frontend project for the tutorial ecosystem, built with React + Vite and integrated with a free open-source CMS (Decap CMS).

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

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
