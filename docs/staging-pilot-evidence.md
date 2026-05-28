# Staging Pilot Evidence

This file is the working evidence log for the staging-first pilot readiness pass.

## Release Candidate

| Item | Status | Evidence |
| --- | --- | --- |
| Repo readiness changes preserved | Ready | Working tree contains pilot gate scripts, CI wiring, docs, smoke coverage, and Supabase hardening migration. |
| Latest local migration | Ready | `npm run db:check-local` reports `20260526150000_pilot_revenue_supabase_hardening.sql`. |
| Local Vercel runtime guard | Ready with warning | `npm run vercel:check` passes because `package.json` pins Node `20.x`; linked Vercel metadata still reports `24.x`. |
| Unit/build verification | Ready | Latest verification before this evidence log: typecheck, lint, navigation, link checks, Vitest, and Next build passed. Lint has existing warning backlog. |
| Public accessibility verification | Ready locally | `npx playwright test tests/a11y.spec.ts --project=chromium` passes after SafePredict route accessibility fixes. |
| Gus verified-learning fixture coverage | Ready locally | `npm run test:ai-eval` runs deterministic Gus fixtures without `OPENAI_API_KEY`; live OpenAI-backed fixtures still require provider credentials and metrics. |

## Environment Confirmation

| Target | Status | Evidence / Needed Action |
| --- | --- | --- |
| Staging Supabase project | Blocked | No local `.env.staging` was found. `.env.local` points to Supabase project ref `mdqkfbnwxrasdmbsjcqv`, name `safetydocs360`, which is not labeled staging. Provide a staging project ref or staging DB URL before applying migrations. |
| Staging Vercel project | Blocked | `.vercel/project.json` points to project `safety-docs-360` under team `team_aokvdgYK1ovY1nIDeeBsoWKN`, and metadata reports Node `24.x`. Confirm this is staging or provide the staging Vercel project/team before changing settings or deploying. |
| Vercel connector visibility | Blocked | Previous connector inspection returned `403 Forbidden` for the linked team scope. Re-authenticate/re-scope before deployment evidence can be captured through the connector. |

## Staging Bootstrap Attempt - 2026-05-26

| Item | Status | Evidence / Needed Action |
| --- | --- | --- |
| Dedicated Supabase staging project | Created but not usable yet | Created `safetydocs360-staging` in org `wgziitlrkgwoflwjlaul`, region `us-east-1`, project ref `dacafxrcrijqevgjotjc`; Supabase quoted `$10/month`. The project is empty and cannot apply the repo migration stack because the repo is missing the original baseline schema. |
| Supabase staging branch fallback | Failed and cleaned up | Created branch `safetydocs360-staging-pilot` from `mdqkfbnwxrasdmbsjcqv`, ref `rumolhtgzzujucmmxixw`, with `with_data:false`; Supabase quoted `$0.01344/hour`. Branch replay failed on `20260318000000_core_security_rls` with `relation "public.submissions" does not exist`. Deleted branch `016485c2-64f8-47a7-ac4e-ad0b35576b2e` after failure. |
| Root blocker | Blocked | Local migrations start with policy/RLS changes against pre-existing tables such as `public.submissions`, `public.documents`, and `public.subscriptions`, but no baseline migration or schema dump for those tables exists in `supabase/`. Add a baseline schema migration or obtain a schema-only dump from the current Supabase project before staging can be rebuilt safely. |
| Empty staging project cleanup | Blocked | Attempted to pause `dacafxrcrijqevgjotjc`; Supabase rejected it with `Project is not free-tier. Please downgrade it to free-tier first and try again.` Handle billing/project cleanup in the Supabase dashboard if this project should not remain billable. |

## Baseline Recovery Attempt - 2026-05-26

| Item | Status | Evidence / Needed Action |
| --- | --- | --- |
| Schema-only baseline artifact | Ready | Created `supabase/baseline/20260522135305_schema.sql` from source project `mdqkfbnwxrasdmbsjcqv` at remote migration `20260522135305_gus_planning_sessions`. Dump includes `public` and `private` schemas only. |
| Storage config baseline artifact | Ready | Created `supabase/baseline/20260522135305_storage_config.sql` from source project metadata. File includes storage bucket configuration and `storage.objects` policies only; it does not include storage objects. |
| Baseline safety validation | Ready | `npm run db:baseline:dump -- --dry-run` passed after Docker Desktop was started. `npm run db:baseline:dump` wrote the baseline files and rejected data-dump markers including `COPY`, pg_dump data sections, migration history, auth user data statements, and key-like secrets. Follow-up search found no forbidden markers. |
| Repeatable staging tooling | Ready | Added `db:baseline:dump`, `db:staging:bootstrap`, and `db:staging:verify` package scripts. Bootstrap refuses production ref `mdqkfbnwxrasdmbsjcqv`, defaults to staging ref `dacafxrcrijqevgjotjc`, checks for existing app tables, applies schema/storage baselines, repairs migration history through `20260522135305`, and then applies pending migrations. |
| Staging env template | Ready | Added `db:staging:scaffold-url`; running it created gitignored `.env.staging.local` with `STAGING_SUPABASE_REF=dacafxrcrijqevgjotjc` and a placeholder `STAGING_DATABASE_URL`. |
| Live staging bootstrap | Blocked | `npm run db:staging:verify` now reaches the staging pooler but fails authentication because `.env.staging.local` still contains `REPLACE_WITH_STAGING_DATABASE_PASSWORD`. Replace it with the staging database password from Supabase Dashboard, then run `npm run db:staging:bootstrap`. |

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
| AI release metrics attached for staging | ☐ | |
| `npm run ai:release-gate` passes with real metrics | ☐ | |
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
