# Safety360Docs

Enterprise safety and compliance workspace: document control, company workspaces (jobsites, training, corrective actions), field workflows (observations, DAPs, permits, incidents), and admin tooling. Built with **Next.js** (App Router), **Supabase** (Postgres + Auth + RLS), deployed on **Vercel**.

## Requirements

- Node.js 20+
- npm (or compatible package manager)
- A Supabase project with migrations applied from `supabase/migrations/`

## Quick start

```bash
npm install
cp .env.example .env.local   # if you maintain an example; otherwise create .env.local manually
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (local UI) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (local UI) | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / scripts | Service role for admin API routes and seed scripts (never expose to the client) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Optional | Server-side fallbacks read by [`lib/supabaseAdmin.ts`](lib/supabaseAdmin.ts) |
| `OPENAI_API_KEY` | For AI features | Document / GC program AI review, injury-weather insights |
| `CRON_SECRET` | Production cron | Bearer or `?secret=` for [`/api/cron/injury-weather-refresh`](app/api/cron/injury-weather-refresh/route.ts) |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Optional | Comma-separated admin emails ([`lib/rbac.ts`](lib/rbac.ts), [`lib/admin.ts`](lib/admin.ts)) |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | Optional | Absolute URLs for redirects (e.g. invite links) |

**E2E / smoke**

| Variable | Purpose |
|----------|---------|
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | Playwright authenticated tests |
| `PLAYWRIGHT_BASE_URL` | Override default `http://127.0.0.1:3000` |
| `PLAYWRIGHT_SKIP_WEBSERVER` | Set to skip starting the dev server from Playwright |
| `SMOKE_BASE_URL` / `SMOKE_BEARER_TOKEN` | [`scripts/smoke-safety-ops.mjs`](scripts/smoke-safety-ops.mjs) |

See [`docs/dev-setup.md`](docs/dev-setup.md) for Supabase workflow, cron, and superadmin notes.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (`lib/**/*.test.ts`) |
| `npm run test:navigation` | Navigation integrity tests |
| `npm run test:links` | Broken link checker |
| `npm run test:e2e` | Playwright (see [`playwright.config.ts`](playwright.config.ts)) |
| `npx playwright test tests/a11y.spec.ts` | Accessibility (axe) on `/`, `/login`, `/submit` |
| `npm run test:e2e:ci` | Build + production server + Playwright |
| `npm run smoke:safetyops` | HTTP smoke script |
| `npm run seed:csep-test` | Seed CSEP test user (needs service role) |

## Database

Apply migrations with the Supabase CLI (link your project, then):

```bash
supabase db push
```

RLS policies live in `supabase/migrations/`. API routes should align with [`docs/api-rbac-audit.md`](docs/api-rbac-audit.md).

## Scheduled jobs (Vercel)

[`vercel.json`](vercel.json) defines a daily cron hitting `/api/cron/injury-weather-refresh`. Set `CRON_SECRET` in Vercel and configure the same value for the cron `Authorization: Bearer …` header (Vercel cron supports this pattern when documented in your deployment).

## License

Private / unpublished (`"private": true` in `package.json`).
