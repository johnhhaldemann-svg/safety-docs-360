# Developer setup and operations

## Staging vs production Supabase

- Use **separate Supabase projects** for staging and production.
- Point `NEXT_PUBLIC_SUPABASE_*` and server keys at the target environment in `.env.local` (local), Vercel env (deployed), or your CI secrets.
- Never commit real keys. Rotate the **service role** if it was exposed.

## Migrations

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Link: `supabase link --project-ref <ref>`.
3. Push schema: `supabase db push` (or your team’s documented migration process).

After pulling new migrations, re-run push before testing features that depend on new tables or RLS.

## Superadmin and admin routes

- **Admin** capabilities are enforced in [`lib/rbac.ts`](../lib/rbac.ts) (`authorizeRequest`, role checks) and in database RLS.
- **`/api/superadmin/*`** routes are restricted to superadmin roles; treat them like production-critical operations.
- Prefer testing superadmin flows against a **non-production** project unless you have explicit approval.

## Cron

- Schedule is defined in [`vercel.json`](../vercel.json) (`/api/cron/injury-weather-refresh`).
- [`app/api/cron/injury-weather-refresh/route.ts`](../app/api/cron/injury-weather-refresh/route.ts) requires `CRON_SECRET`: either `Authorization: Bearer <secret>` or `?secret=<secret>`.
- In Vercel, set `CRON_SECRET` and ensure cron invocations include the secret (per Vercel cron + your security policy).

## Public vs authenticated API behavior

- Some routes are **intentionally public** (e.g. agreement config for signup, registration). See [`docs/api-rbac-audit.md`](api-rbac-audit.md).
- Legacy **proxy** routes under `/api/incidents`, `/api/observations`, `/api/companies`, etc. forward to `/api/company/*` with the same headers so the session cookie / `Authorization` still applies.

## E2E tests

1. Configure `NEXT_PUBLIC_SUPABASE_*` so the app can run.
2. Optional: `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` for authenticated suites.
3. Run `npm run test:e2e` or `npm run test:e2e:ci` (see root [`README.md`](../README.md)).
