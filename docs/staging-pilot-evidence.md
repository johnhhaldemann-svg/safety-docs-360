# Staging Pilot Evidence

This file is the working evidence log for the staging-first pilot readiness pass.

## Release Candidate

| Item | Status | Evidence |
| --- | --- | --- |
| Repo readiness changes preserved | Ready | Working tree contains pilot gate scripts, CI wiring, docs, smoke coverage, and Supabase hardening migration. |
| Latest local migration | Ready | `npm run db:check-local` reports `20260526150000_pilot_revenue_supabase_hardening.sql`. |
| Local Vercel runtime guard | Ready with warning | `npm run vercel:check` passes because `package.json` pins Node `20.x`; linked Vercel metadata still reports `24.x`. |
| Unit/build verification | Ready | Latest verification before this evidence log: typecheck, lint, navigation, link checks, Vitest, and Next build passed. Lint has existing warning backlog. |

## Environment Confirmation

| Target | Status | Evidence / Needed Action |
| --- | --- | --- |
| Staging Supabase project | Blocked | No local `.env.staging` was found. `.env.local` points to Supabase project ref `mdqkfbnwxrasdmbsjcqv`, name `safetydocs360`, which is not labeled staging. Provide a staging project ref or staging DB URL before applying migrations. |
| Staging Vercel project | Blocked | `.vercel/project.json` points to project `safety-docs-360` under team `team_aokvdgYK1ovY1nIDeeBsoWKN`, and metadata reports Node `24.x`. Confirm this is staging or provide the staging Vercel project/team before changing settings or deploying. |
| Vercel connector visibility | Blocked | Previous connector inspection returned `403 Forbidden` for the linked team scope. Re-authenticate/re-scope before deployment evidence can be captured through the connector. |

## Migration Sync Evidence

| Source | Latest Migration |
| --- | --- |
| Local repo | `20260526150000_pilot_revenue_supabase_hardening` |
| Connector-read Supabase project `mdqkfbnwxrasdmbsjcqv` | `20260522135305_gus_planning_sessions` |

Do not apply migrations until the staging target is confirmed.

## Evidence To Fill After Staging Is Confirmed

| Area | Pass? | Evidence Link / Notes |
| --- | --- | --- |
| Supabase migrations applied to staging | ☐ | |
| Supabase security advisors reviewed after migration | ☐ | |
| Supabase performance advisors reviewed after migration | ☐ | |
| Vercel Node set to `20.x` for staging | ☐ | |
| Vercel deployment/build logs captured | ☐ | |
| Staging env matrix redacted and reviewed | ☐ | |
| Cron registration and latest run evidence captured | ☐ | |
| Company setup happy path | ☐ | |
| Jobsite + emergency action plan happy path | ☐ | |
| JSA and permit happy path | ☐ | |
| Field issue/corrective action happy path | ☐ | |
| Incident happy path | ☐ | |
| Training matrix happy path | ☐ | |
| Document upload/review/download happy path | ☐ | |
| Billing happy path, if contracted | ☐ | |
| Cross-tenant field user denial | ☐ | |
| Cross-tenant company admin denial | ☐ | |
