# Developer setup and operations

## Production checklist

For Vercel env vars, Supabase Auth URLs, cron, and GitHub E2E secrets, use [production-deployment.md](./production-deployment.md). For support, onboarding, and launch-mode decisions, see [support-onboarding-runbook.md](./support-onboarding-runbook.md).

## Staging vs production Supabase

- Use **separate Supabase projects** for staging and production.
- Point `NEXT_PUBLIC_SUPABASE_*` and server keys at the target environment in `.env.local` (local), Vercel env (deployed), or your CI secrets.
- Never commit real keys. Rotate the **service role** if it was exposed.

## Migrations

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli) (or use `npx supabase` / `npm run supabase`).
2. Repo root includes [`supabase/config.toml`](../supabase/config.toml) from `supabase init` so `db push` works in CI and locally.
3. Link: `supabase link --project-ref <ref>`.
4. Push schema: `npm run db:push` or `supabase db push` (or your team’s documented migration process).

**Vercel** does not execute migrations. Optional GitHub workflow: [supabase-db-push.yml](../.github/workflows/supabase-db-push.yml) (secrets documented in [production-deployment.md](./production-deployment.md)).

After pulling new migrations, re-run push before testing features that depend on new tables or RLS.

## Superadmin and admin routes

- **Admin** capabilities are enforced in [`lib/rbac.ts`](../lib/rbac.ts) (`authorizeRequest`, role checks) and in database RLS.
- **`/api/superadmin/*`** routes are restricted to superadmin roles; treat them like production-critical operations.
- Prefer testing superadmin flows against a **non-production** project unless you have explicit approval.

## Cron

- Schedule is defined in [`vercel.json`](../vercel.json) for `/api/cron/injury-weather-refresh`, `/api/cron/company-billing-invoices`, and `/api/cron/risk-memory-rollup`.
- Cron handlers require `CRON_SECRET`: either `Authorization: Bearer <secret>` or `?secret=<secret>` (see [`lib/cronAuth.ts`](../lib/cronAuth.ts)). Risk Memory rollup: [`app/api/cron/risk-memory-rollup/route.ts`](../app/api/cron/risk-memory-rollup/route.ts) — optional `recommendations=1` and `days=90` query params.
- In Vercel, set `CRON_SECRET` and ensure cron invocations include the secret (per Vercel cron + your security policy).

## Public vs authenticated API behavior

- Some routes are **intentionally public** (e.g. agreement config for signup, registration). See [`docs/api-rbac-audit.md`](api-rbac-audit.md).
- Legacy **proxy** routes under `/api/incidents`, `/api/observations`, `/api/companies`, etc. forward to `/api/company/*` with the same headers so the session cookie / `Authorization` still applies.

## E2E tests

1. Configure `NEXT_PUBLIC_SUPABASE_*` so the app can run.
2. Optional: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_NEXT_PUBLIC_SUPABASE_URL`, and `E2E_NEXT_PUBLIC_SUPABASE_ANON_KEY` for CI full E2E on `main` (all four required there; see [production-deployment.md](./production-deployment.md)).
3. Run `npm run test:e2e` or `npm run test:e2e:ci` (see root [`README.md`](../README.md)).
