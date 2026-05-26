# Pilot Revenue Readiness

Use this before any paid pilot cutover. The goal is to prove that the app build, Vercel runtime, Supabase schema, and pilot workflows all point at the intended environment.

## Required Gate

Run from the repo root:

```bash
npm run verify:pilot
```

This checks Vercel Node alignment, Supabase migration sync, TypeScript, lint, unit tests, navigation, link checks, and production build.

If `db:check-sync` cannot read the target database, set one of:

- `SUPABASE_MIGRATION_CHECK_DB_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_REMOTE_MIGRATION_VERSION` for evidence-only comparison

Do not deploy Vercel when the newest local migration is missing remotely.

## Evidence To Capture

| Area | Evidence |
| --- | --- |
| Supabase migrations | Output from `npm run db:check-sync`, plus `supabase migration list` or dashboard screenshot showing latest migration. |
| Supabase advisors | Security and performance advisor exports after the latest migration. |
| Vercel runtime | `npm run vercel:check`, Vercel project Node.js setting at `20.x`, and latest deployment build log. |
| Vercel env | Redacted env matrix for Production and Staging, especially Supabase URL/anon/service role, `CRON_SECRET`, email, Stripe, OpenAI, and weather vars. |
| Cron | Vercel cron list plus latest successful `platform_job_runs` rows for cron-backed safety jobs. |
| Pilot workflows | Screenshots or test notes for company setup, jobsite, JSA, permit, field issue/corrective action, incident, training matrix, document review/download, and billing if contracted. |
| Tenant isolation | Cross-company API/UI denial proof for a field user and company admin. |

## Current Pilot Defaults

- Node: `20.x` in `package.json`, `.nvmrc`, CI, and Vercel Project Settings.
- Supabase schema changes must flow through `supabase/migrations`.
- Staging should use a dedicated Supabase project or an isolated Vercel project/preview environment.
- Vercel connector inspection is required before production evidence is complete; if the connector returns `403`, re-authenticate it for the project team.

## Supabase Hardening Notes

The pilot hardening migration adds scoped policies for contractor training tables and server-only service-role policies for internal counter/predictability tables. Remaining advisor warnings need explicit owner decisions:

- `SECURITY DEFINER` functions: keep callable only when the app or RLS needs direct authenticated execution; otherwise move/revoke in a follow-up migration.
- `vector` in `public`: defer until all embedding functions and generated SQL references are migrated together.
- Leaked-password protection: enable in Supabase Auth for pilot/prod, or record a business exception.
- Performance advisors: prioritize high-read pilot tables before broad policy/index cleanup.
