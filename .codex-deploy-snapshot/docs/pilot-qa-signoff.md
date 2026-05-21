# Pilot QA and sign-off

Run on **staging** (see [pilot-staging-and-env](./pilot-staging-and-env.md)) before inviting paying pilots. Record pass / fail / waived in the tables below; attach screenshots to your release ticket if required.

## Automated gate (local or CI)

From repo root:

```bash
npm run verify:release
```

Expected: TypeScript, Vitest, navigation, link checks, lint per [release-readiness](./release-readiness.md).

| Gate | Pass? | Notes / link |
|------|-------|----------------|
| `npm run verify:release` | ☐ | |

## Staging smoke (from release-readiness)

| Step | Pass? | Tester / date |
|------|-------|----------------|
| `/`, `/marketing`, `/company-signup`, `/login`, `/privacy`, `/terms` load | ☐ | |
| Company-admin sign-in; dashboard loads | ☐ | |
| Workspace launch checklist visible | ☐ | |
| Command Center opens; onboarding marks CC viewed | ☐ | |
| Library, Jobsites, Field Issue Log, Safety Intelligence open from nav | ☐ | |

## Pilot happy path (Beta Gates 2–3)

Align steps with [pilot-sku](./pilot-sku.md). Skip rows not in your pilot contract.

| Step | Pass? | Notes |
|------|-------|--------|
| Create or use pilot company; complete company profile | ☐ | |
| Create jobsite; assign field and admin users | ☐ | |
| JSA: create draft, save, attach to jobsite | ☐ | |
| Permit: create (from JSA or standalone per product rules) | ☐ | |
| Field Issue Log: create issue / corrective action; filter by jobsite | ☐ | |
| Incident: create record linked to jobsite | ☐ | |
| Training Tracker: open matrix; spot-check gap vs match | ☐ | |
| Document: upload; appears in library with correct scope | ☐ | |
| Submit / admin review (if in SKU): submit → reviewer → customer download | ☐ | |
| Billing (if in SKU): view plan or invoices on staging Stripe test mode | ☐ | |

## Isolation and security (Beta Gate 1)

Use **separate** companies and users on staging. Attempt cross-tenant access that should fail.

| Test | Expected | Pass? |
|------|----------|--------|
| Field user A opens API/UI for company B’s jobsite | Denied or empty | ☐ |
| Company admin A cannot switch workspace to company B | Denied | ☐ |
| Unauthenticated `/api/company/*` | 401 | ☐ |
| CSEP-only company hits integrations (if applicable) | Guard / 403 per product rules | ☐ |

Deep reference: [api-rbac-audit](./api-rbac-audit.md), [route-structure](./route-structure.md).

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-------------|
| Product / owner | | | |
| Engineering | | | |
| Security / isolation (optional) | | | |

Copy summary rows into [parity-modules-release-validation](./parity-modules-release-validation.md) §6 when complete.
