# Parity modules release validation (evidence)

This packet supports the **Parity Modules Release Validation** plan. It records what was run in-repo and what still requires a linked Supabase project and authenticated staging or production checks.

## 1. Environment and database readiness

| Check | Result | Notes |
| --- | --- | --- |
| Parity migrations present under `supabase/migrations/` | Pass | Includes safety forms, integration webhooks, HRIS roster imports, and related parity SQL. |
| `npm run db:push --dry-run` (or equivalent) against remote | Blocked locally | Supabase CLI reported **Access token not provided**; run after `supabase login` or with `SUPABASE_ACCESS_TOKEN` in the deployment pipeline. |

## 2. Automated gates (blocking)

Commands run from the repository root on the validation workstation:

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | Pass — **0 errors**, 8 existing `@typescript-eslint/no-explicit-any` warnings in unrelated API routes. |
| Typecheck | `npx tsc --noEmit` | Pass |
| Unit / route tests | `npm run test` | Pass — full Vitest suite (includes new parity-focused route tests below). |
| Route / nav smoke | `npm run test -- lib/appRouteSmokeCoverage.test.ts lib/appNavigationIntegrity.test.ts` | Pass |

### Code fixes applied for automated gates

- **Induction route tests**: `response` possibly undefined (Next handler typings) — resolved via `requireRouteResponse` from `@/lib/routeResponseTest` (including `app/api/company/inductions/requirements/route.test.ts`).
- **Dashboard layout test**: `availableBlocks` length was hard-coded; it now matches `getAvailableDashboardBlocks` for the same role and permission map as the API.
- **New automated coverage (subset of the manual feature matrix)**:
  - `app/api/company/field-sync/batch/route.test.ts` — toolbox role gate, stale `ifUnmodifiedSince` conflict, restricted jobsite scope on create.
  - `app/api/company/integrations/webhooks/route.test.ts` — unauthorized GET, CSEP-only guard forwarding, integration manager role gate, validation for create.
  - `app/api/company/safety-forms/definitions/route.test.ts` — unauthorized GET, form manager role gate, missing title validation.

## 3. Manual feature tests (API / UI)

Fully exercising definitions, versions, submissions, webhook HMAC deliveries, and HRIS import end-to-end requires **real auth, company workspace, and migrated tables**. Track those in your staging checklist; the plan’s rows remain the source of truth.

| Area | Automated in CI | Manual / staging still required |
| --- | --- | --- |
| Safety forms — publish version, runner, submissions | Partial (definitions POST/GET guards and validation only) | Full flows, approval path, risk events in DB |
| Offline toolbox — queue, flush, conflict | Partial (batch conflict + jobsite scope + role) | Service worker, multi-device flush, real `updated_at` |
| Integrations — signed delivery, HRIS import | Partial (RBAC + CSEP + create validation) | Webhook secret storage, outbound HMAC delivery log, HRIS payload samples |

## 4. Security and scope (RBAC, jobsite, CSEP)

| Check | Evidence |
| --- | --- |
| Integration admin surfaces blocked for non-manager roles | `integrations/webhooks/route.test.ts` (403 for `safety_manager` on POST). |
| CSEP-only company guard on integrations list | Same file — GET returns guard `NextResponse` when `blockIfCsepOnlyCompany` resolves non-null. |
| Jobsite scope on field toolbox batch create | `field-sync/batch/route.test.ts` — restricted scope rejects unknown jobsite. |
| Full role matrix (field vs admin, cross-jobsite reads) | Still validate manually against staging with real assignments; see `docs/api-rbac-audit.md` for route inventory. |

## 5. Release gate checklist

| Criterion | Status |
| --- | --- |
| Blocking automated tests pass | **Pass** (last full `npm run test` in validation session). |
| `tsc` clean | **Pass** |
| Lint errors | **None** (warnings only, pre-existing). |
| DB push / migration apply in target env | **Pending** — requires Supabase auth in that environment. |
| Manual UI/API matrix + screenshots | **Pending** — staging sign-off. |
| RBAC / scope / CSEP manual matrix | **Partially covered** by new tests; complete in staging. |

When staging is available, attach screenshots and HTTP traces to this packet or your release ticket and mark the pending rows complete.

## 6. Revenue pilot sign-off (optional appendix)

Use when a **paid pilot** completes staging or production validation. Copy rows from [pilot-qa-signoff.md](./pilot-qa-signoff.md) and [pilot-staging-and-env.md](./pilot-staging-and-env.md).

| Criterion | Staging | Production pilot |
| --- | --- | --- |
| Migrations applied (evidence attached) | ☐ | ☐ |
| `npm run verify:release` green on release commit | ☐ | ☐ |
| Isolation / RBAC spot tests ([pilot-qa-signoff](./pilot-qa-signoff.md)) | ☐ | ☐ |
| Happy path per [pilot-sku](./pilot-sku.md) | ☐ | ☐ |
| Billing (test or live per contract) | ☐ | ☐ |
| Legal / privacy review ([pilot-legal-and-agreements](./pilot-legal-and-agreements.md)) | ☐ | ☐ |
| Owner approval name + date | | |

**Waived checklist items** (must match pilot contract): _e.g. document-only search — see pilot-sku waivers table._
