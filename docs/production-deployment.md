# Production deployment (Safety360Docs)

Use this checklist when cutting over a **new production** environment (Vercel + Supabase). Staging should mirror these steps on its own project.

## 0. Two pushes (Supabase vs Vercel)

| Push | Target | Typical command / trigger |
|------|--------|---------------------------|
| **Supabase** | Hosted Postgres + RLS (`supabase/migrations`) | `npm run db:push` after `supabase link`, or GitHub Action [supabase-db-push.yml](../.github/workflows/supabase-db-push.yml) |
| **Vercel** | Next.js app build + serverless routes | `git push` to the production branch, or `npm run vercel:prod` (from repo root; `npx vercel login` first) |

Run **Supabase migrations first** whenever migration files changed, then deploy **Vercel** so the app and schema stay aligned.

## 1. Supabase (production project)

1. Create a **dedicated** Supabase project for production (do not share with local dev long term).
2. **Database**: apply migrations from [`supabase/migrations/`](../supabase/migrations/). **Vercel does not run migrations** — only the Next.js build. Typical order: **push migrations to Supabase**, then deploy (or redeploy) on Vercel so the app matches the schema.
   - **Local:** `supabase link --project-ref <ref>` then `supabase db push` (see [dev-setup.md](./dev-setup.md)).
   - **CI:** optional workflow [.github/workflows/supabase-db-push.yml](../.github/workflows/supabase-db-push.yml) runs `supabase db push` when migration files change on `main`/`master` (requires repo secrets below).
   - **Risk Memory Engine** (if you use facets, contractors, crews, or stored recommendations): ensure these run in order on the target project: `20260413130000_company_risk_memory_engine.sql`, then `20260414120000_risk_memory_phase2.sql`, then `20260415103000_company_crews_risk_memory.sql`. All are applied automatically when you `db push` a linked project with an up-to-date migration history.
3. **Auth → URL configuration**:
   - **Site URL**: your canonical app URL (e.g. `https://app.example.com`).
   - **Redirect URLs**: include the same origin plus any preview URLs you use (or restrict previews to staging only).
4. **Backups**: enable backup / PITR appropriate to your plan and recovery expectations.
5. **Email** (if using Supabase Auth email): configure SMTP or Supabase default; verify deliverability for sign-in and password reset.

## 2. Vercel

[`vercel.json`](../vercel.json) uses **`npm ci`** for installs (faster, strict lockfile) when the build runs. If a deploy sits on **Initializing** for a minute, that is usually **queue + clone** before **Building** starts; total time ~1–2 minutes is typical for this app.

1. Import the Git repo (or connect existing project) and set **Production** branch (usually `main`).
2. **Environment variables** (Production; mirror for Preview if previews should hit a real backend):

   | Variable | Notes |
   |----------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Production project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (safe for browser) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server only; never `NEXT_PUBLIC_*`. If an older env uses the typo `SUPABASE_SERIVCE_ROLE_KEY`, the app still reads it; rename or duplicate to the canonical name when convenient. |
   | `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | Canonical URL for invites and redirects |
   | `NEXT_PUBLIC_ADMIN_EMAILS` | Optional; platform admin list |
   | `CRON_SECRET` | Long random string; required for scheduled cron (see below) |
   | `OPENAI_API_KEY` | If AI features are enabled in prod |
   | `OPENAI_BASE_URL` | Optional; use `https://ai-gateway.vercel.sh/v1` with a Vercel AI Gateway key (`vck_…`) |
   | `RESEND_FROM_EMAIL` | If sending invite email from your domain |
   | Stripe keys | Live keys + webhook secret only when billing is live |

   Full list and comments: [`.env.example`](../.env.example) and [README.md](../README.md).

   **Injury Weather — deterministic vs AI:** Trade momentum, predicted injuries, risk levels, and trend series come from the **deterministic** engine ([`lib/injuryWeather/service.ts`](../lib/injuryWeather/service.ts), [`lib/injuryWeather/riskModel.ts`](../lib/injuryWeather/riskModel.ts)) and **do not** require `OPENAI_API_KEY`. OpenAI (or the gateway) is used only for **optional** layers: narrative insights, optional web-research bullets, and an optional structured forecast override when `INJURY_WEATHER_AI_FORECAST_OVERRIDE=1` — see [`lib/injuryWeather/ai.ts`](../lib/injuryWeather/ai.ts) and the Injury Weather block in [`.env.example`](../.env.example).

3. **Custom domain**: attach domain in Vercel; ensure DNS and HTTPS complete. Update Supabase redirect URLs to match.
4. **Build**: confirm `npm run build` succeeds locally (Vercel runs the same command for Next.js). This repo declares **`engines.node` ≥ 20.9** in [`package.json`](../package.json) so Vercel uses a compatible Node runtime.
5. **If the deployment fails**, use the table below before changing code.

### Vercel build failures — typical causes

| Symptom / cause | What to do |
|-----------------|------------|
| **Wrong repo / folder** | **Settings → General → Root Directory** must be the folder that contains `package.json` (repo root if the app lives at the repository root). |
| **No install / lockfile** | Commit **`package-lock.json`** (or `pnpm-lock.yaml` / `yarn.lock` if you use that manager). Vercel installs from the lockfile at the root directory above. |
| **Node too old** | Use **Node 20+** for Next.js 16. In Vercel: **Settings → General → Node.js Version** → **20.x**. This repo also sets **`engines`** in `package.json` and [`.nvmrc`](../.nvmrc) to `20`. |
| **Missing env vars** | Some failures happen at **build** if code reads env at import time. **Settings → Environment Variables**: set at least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for server routes. Copy values for **Production** and **Preview** if previews should work. See the table in §2 above. |
| **Git not connected / no push** | Confirm the GitHub/GitLab app is installed on the org/account, the repo is linked, and **Production Branch** matches the branch you push (often `main`). |
| **Build / output settings overridden** | **Settings → General → Build & Development Settings**: leave **Build Command** as **`npm run build`** or **empty** (Vercel’s Next.js default). **Output Directory** should be **default/empty** unless you use a custom static export. **Install Command** should be **default** unless you standardize on `pnpm install` / `yarn install`. |

## 3. Scheduled crons

[`vercel.json`](../vercel.json) schedules `GET /api/cron/injury-weather-refresh`, `GET /api/cron/company-billing-invoices`, and `GET /api/cron/risk-memory-rollup` daily.

1. Set **`CRON_SECRET`** in Vercel **Production** (and Preview if crons run there).
2. Vercel injects `Authorization: Bearer <CRON_SECRET>` on cron invocations when `CRON_SECRET` is defined. The handler also accepts `?secret=<CRON_SECRET>` for **manual** runs (do not share or log URLs containing the secret).
3. If cron returns **401**: confirm `CRON_SECRET` has no accidental newlines; redeploy after changing env vars. See [lib/cronAuth.ts](../lib/cronAuth.ts).
4. **Risk Memory rollup** needs **`SUPABASE_SERVICE_ROLE_KEY`** on Vercel (same as other admin jobs). It upserts `company_risk_memory_snapshots` for each company (skips CSEP-only plans). Optional second scheduled job or manual URL: same path with `&recommendations=1` to append deduped rule-based rows to `company_risk_ai_recommendations`. Optional env: **`RISK_MEMORY_CRON_MAX_COMPANIES`** (default 300, cap 2000).

## 4. GitHub Actions — Supabase migrations

To let GitHub apply migrations to a hosted project (staging or production ref), add **repository secrets**:

| Secret | Where to get it |
|--------|------------------|
| `SUPABASE_ACCESS_TOKEN` | [Supabase Dashboard](https://supabase.com/dashboard/account/tokens) → Account → Access Tokens |
| `SUPABASE_PROJECT_REF` | Project **Settings → General** → Reference ID |

The workflow [supabase-db-push.yml](../.github/workflows/supabase-db-push.yml) runs on **`workflow_dispatch`** and when **`supabase/migrations/**`** or **`supabase/config.toml`** changes on `main`/`master`. Use a **staging** project ref first; point production only when you intend every merged migration to hit prod.

If the job is skipped, one or both secrets are missing (same pattern as E2E secrets).

## 5. GitHub Actions (full E2E on `main`)

To run the full Playwright suite on pushes to `main`, add repository **Secrets**:

- `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — test user in the **target** Supabase project
- `E2E_NEXT_PUBLIC_SUPABASE_URL`, `E2E_NEXT_PUBLIC_SUPABASE_ANON_KEY` — same project as that user

If **any** of these secrets is missing, the workflow **skips** full E2E so forks and fresh repos stay green. When **all four** are set, the job runs and failures block the workflow (see [.github/workflows/ci.yml](../.github/workflows/ci.yml)).

## 6. Post-deploy smoke

- Open `/`, `/login`, `/terms`, `/privacy`.
- Sign in as a production test user; exercise one company-scoped flow (e.g. workspace summary or **Insights → Command center** — user-facing steps in [command-center.md](./command-center.md)).
- Optional: `npm run smoke:safetyops` with `SMOKE_BASE_URL` and `SMOKE_BEARER_TOKEN` pointed at production (see README).

## 7. Security reminders

- Rotate **service role** if it was ever exposed.
- Review [api-rbac-audit.md](./api-rbac-audit.md) when adding API routes.
- Run superadmin flows only against non-production unless explicitly approved ([dev-setup.md](./dev-setup.md)).
