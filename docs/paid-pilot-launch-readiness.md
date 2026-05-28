# Paid Pilot Launch Readiness

Status: Needs Review

Launch scope: paid pilot only. Do not deploy to production, mutate production data, change billing/live Stripe, change authentication or roles, or apply database migrations without owner approval and PR review.

## Current Gate Status

| Area | Status | Evidence |
| --- | --- | --- |
| TypeScript, lint, unit tests, navigation, links, build | Ready locally | These gates passed during the launch-readiness pass. Re-run before PR approval. |
| Public smoke | Ready locally | `npx playwright test tests/smoke.spec.ts --project=chromium` passed. |
| Accessibility | Ready locally | `npx playwright test tests/a11y.spec.ts --project=chromium` now passes all public SafePredict routes. |
| Gus verified-learning safety fixtures | Ready locally | `npm run test:ai-eval` runs deterministic `gus.verified-learning` fixtures without `OPENAI_API_KEY`; live OpenAI-backed fixtures still skip when no key is provided. |
| AI release metrics | Blocked | `npm run ai:release-gate` must be run with real staging or CI metrics for critical eval pass rate, failure rate, fallback rate, token cost regression, and p95 latency regression. Do not use fabricated metrics. |
| Supabase migration sync | Blocked | `npm run db:check-sync` needs `SUPABASE_MIGRATION_CHECK_DB_URL` or a linked staging project that can read remote migration history. |
| Supabase advisors | Blocked | Re-run staging security and performance advisors after migrations and triage SECURITY DEFINER exposure, public vector usage, missing FK indexes, and duplicate permissive policies. |
| Vercel Node runtime | Blocked | Repo requires Node `20.x`; linked Vercel metadata has reported `24.x`. Update the staging Vercel project runtime to `20.x` in Vercel before capturing final evidence. |
| Authenticated staging E2E | Blocked | Requires staging pilot admin, field-user, and superadmin accounts with sandbox/test data. |

## AI Release Evidence Rules

- `gus.verified-learning` is deterministic and can be verified locally without model access.
- OpenAI-backed eval surfaces still require `OPENAI_API_KEY` and should be run against staging-safe fixtures.
- `npm run ai:release-gate` should remain red until real metrics are supplied through `--metrics <path>` or `AI_RELEASE_GATE_METRICS_JSON`.
- Passing fixture coverage alone is not enough for paid pilot launch; record live eval results and runtime metrics in the release ticket.
- Any Safety AI response used for launch evidence must be conservative, source-grounded, and clear when knowledge is missing.

## Cron Decision

The duplicate `/api/cron/jobsite-daily-todos` entries are intentional DST coverage:

- `0 10 * * *` reaches 5am America/Chicago during daylight time.
- `0 11 * * *` reaches 5am America/Chicago during standard time.
- The route itself skips unless the local hour is 5, so the extra invocation should not generate duplicate todos.

Keep both schedules unless the route stops enforcing the local-hour guard.

## Staging Evidence To Capture

Run with sandbox/test data only:

- `npm run db:check-sync` with `SUPABASE_MIGRATION_CHECK_DB_URL` pointed at staging.
- Supabase security advisor and performance advisor after staging migrations.
- `npm run vercel:check` after Vercel staging runtime is set to Node `20.x`.
- `npm run ai:release-gate -- --metrics <staging-metrics.json>` or the equivalent CI metrics source.
- Authenticated staging E2E as company admin, field user, and superadmin.
- PDF and Word exports for document flows that support export.
- Stripe billing checks in test mode only.
- Cross-tenant denial checks for field user and company admin.

## Manual Owner Sign-Off Click Path

On staging, sign in as the correct role and click:

- Dashboard
- Command Center
- Library
- Jobsites
- JSA
- Permits
- Field Issue Log
- Incidents
- Training Tracker
- Safety Forms
- Safety Intelligence

Launch remains Needs Review until the blocked hosted/staging evidence above is attached.
