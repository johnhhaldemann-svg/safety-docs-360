# Safety360Docs

Enterprise safety and compliance workspace: document control, company workspaces (jobsites, training, corrective actions), field workflows (observations, JSAs, permits, incidents), and admin tooling. Built with **Next.js** (App Router), **Supabase** (Postgres + Auth + RLS), deployed on **Vercel**.

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

**Command center (end users):** after sign-in, open **Insights → Command center** for Risk Memory, open-work shortcuts, recommendations, and the company memory bank. Step-by-step usage: [`docs/command-center.md`](docs/command-center.md).

**Adoption / demo:** the first-run checklist and Command Center adoption path are covered in [`docs/release-readiness.md`](docs/release-readiness.md). Sales walkthrough setup is in [`docs/demo-mode.md`](docs/demo-mode.md).

Moving to a new Windows laptop? Use [`docs/new-laptop-setup.md`](docs/new-laptop-setup.md) and run `powershell -ExecutionPolicy Bypass -File .\scripts\setup-new-laptop.ps1`.

## Supabase + Vercel deploy (“push”)

These are **two separate systems**. There is no single “push” to both.

| Step | What | How |
|------|------|-----|
| **1. Database** | Apply SQL migrations to your **Supabase** project | Locally: `supabase link --project-ref <ref>` then `npm run db:push`. Or enable [`.github/workflows/supabase-db-push.yml`](.github/workflows/supabase-db-push.yml) (GitHub secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) and merge migration changes / run the workflow. |
| **2. App** | Deploy the **Next.js** app to **Vercel** | Push to the branch Vercel uses for Production (usually `main`), or run `npm run vercel:prod` (uses `npx vercel`; run `npx vercel login` once). Preview: `npm run vercel:preview`. |

Always do **step 1 before step 2** when migrations changed, so production code matches the database. Env vars for Vercel are in the project dashboard (same keys as [`.env.example`](.env.example)). Full checklist: [`docs/production-deployment.md`](docs/production-deployment.md) (includes a **Vercel build failure** troubleshooting table: root directory, lockfile, Node 20, env vars, Git, build settings).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (local UI) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (local UI) | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / scripts | Service role for admin API routes and seed scripts (never expose to the client) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Optional | Server-side fallbacks read by [`lib/supabaseAdmin.ts`](lib/supabaseAdmin.ts) |
| `OPENAI_API_KEY` | For AI features | Document / GC program AI review, injury-weather insights |
| `CRON_SECRET` | Production cron | Bearer or `?secret=` for [`injury-weather-refresh`](app/api/cron/injury-weather-refresh/route.ts), [`company-billing-invoices`](app/api/cron/company-billing-invoices/route.ts), [`risk-memory-rollup`](app/api/cron/risk-memory-rollup/route.ts) |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Optional | Comma-separated admin emails ([`lib/rbac.ts`](lib/rbac.ts), [`lib/admin.ts`](lib/admin.ts)) |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | Optional | Absolute URLs for redirects (e.g. invite links) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Optional | Shown on `/privacy` for data and privacy inquiries |

**E2E**

| Variable | Purpose |
|----------|---------|
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | Playwright authenticated tests |
| `E2E_NEXT_PUBLIC_SUPABASE_URL` / `E2E_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project for CI E2E (same as test user); all four values required for the `playwright-full` GitHub Actions job |
| `PLAYWRIGHT_BASE_URL` | Override default `http://127.0.0.1:3000` |
| `PLAYWRIGHT_SKIP_WEBSERVER` | Set to skip starting the dev server from Playwright |

**GitHub Actions (optional repository secrets)**

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Enables non-blocking [AI eval](.github/workflows/ai-eval.yml) runs (otherwise fixtures skip). |
| `AI_EVAL_COMPANY_AI_MODEL` / `AI_EVAL_RISK_MEMORY_LLM_MODEL` / `AI_EVAL_SI_DOCUMENT_MODEL` | Optional model overrides for the AI eval workflow only. |

See [`docs/dev-setup.md`](docs/dev-setup.md) for Supabase workflow, cron, E2E secret checklist, and superadmin notes.

**Production launch:** step-by-step checklist in [`docs/production-deployment.md`](docs/production-deployment.md). Operations and go-to-market alignment in [`docs/support-onboarding-runbook.md`](docs/support-onboarding-runbook.md).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (`lib/**/*.test.ts`) |
| `npm run test:navigation` | Navigation integrity tests |
| `npm run verify:release` | Release gate: lint, Vitest, navigation tests, and adoption Playwright spec |
| `npm run test:links` | Broken link checker |
| `npm run test:e2e` | Playwright (see [`playwright.config.ts`](playwright.config.ts)) |
| `npx playwright test tests/a11y.spec.ts` | Accessibility (axe) on `/`, `/login`, `/privacy`, `/submit` |
| `npm run stress:platform` | Load test: concurrent requests to public HTML pages plus anonymous GET `/api/legal/config` and `/api/auth/me` (401 OK). Requires a running server. `STRESS_SKIP_API=1` for HTML only. |
| `npm run test:e2e:ci` | Build + production server + Playwright |
| `npm run seed:csep-test` | Seed CSEP test user (needs service role) |
| `npm run db:push` | `supabase db push --yes` (after `supabase link`) |
| `npm run vercel:prod` | Production deploy (`npx vercel deploy --prod`) |
| `npm run vercel:preview` | Preview deploy (`npx vercel deploy`) |

Keep the **Supabase CLI** (`supabase` in `devDependencies`) current with `npm install`; the GitHub **Supabase DB push** workflow pins the same major line in [`.github/workflows/supabase-db-push.yml`](.github/workflows/supabase-db-push.yml).

## Database

Migrations live in `supabase/migrations/` and apply to **Supabase** (Postgres), not to Vercel. Deploy order: **run migrations**, then ship the Next.js app on Vercel so the API matches the schema.

**Local / manual**

```bash
supabase link --project-ref <your-project-ref>
npm run db:push
```

(`npm run db:push` is `supabase db push --yes`.)

**CI (optional):** when `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` are set as GitHub repo secrets, [.github/workflows/supabase-db-push.yml](.github/workflows/supabase-db-push.yml) runs `supabase db push` on migration changes to `main`/`master` or via **Actions → Supabase DB push → Run workflow**. See [docs/production-deployment.md](docs/production-deployment.md).

RLS policies are defined in migrations. API routes should align with [`docs/api-rbac-audit.md`](docs/api-rbac-audit.md).

## Scheduled jobs (Vercel)

[`vercel.json`](vercel.json) defines daily crons: `/api/cron/injury-weather-refresh`, `/api/cron/company-billing-invoices`, and `/api/cron/risk-memory-rollup`. Set `CRON_SECRET` in Vercel (Vercel sends `Authorization: Bearer …` when configured). See [`docs/production-deployment.md`](docs/production-deployment.md).

## License

Private / unpublished (`"private": true` in `package.json`).
