# SafetyDocs360 — E2E Function Pass Test Report

> Branch: `e2e/mock-onboarding-and-function-pass`  
> Seed company: `TEST_E2E Mock Construction Co` (team_key: `test-e2e-mock-co`)

---

## Summary

| Metric | Value |
|--------|-------|
| Total functions tested | — |
| Passed | — |
| Failed | — |
| Skipped (env not set) | — |
| Run date | — |
| Playwright version | 1.52.0 |
| Highest-severity issue | — |

*Run `npm run test:e2e:mock` and replace the values above with actual results.*

---

## How to Run

```bash
# 1. Start the dev server
npm run dev

# 2. Seed the test company (once per environment)
E2E_SEED_CONFIRM=yes node scripts/seed-test-company.mjs

# 3. Copy the output env vars into .env.local
#    E2E_COMPANY_ADMIN_EMAIL=test-admin-e2e@safety360.test
#    E2E_COMPANY_ADMIN_PASSWORD=TestAdmin2026!
#    E2E_FIELD_USER_EMAIL=test-field-e2e@safety360.test
#    E2E_FIELD_USER_PASSWORD=TestField2026!
#    E2E_TEST_COMPANY_ID=<uuid from seed output>
#    E2E_TEST_JOBSITE_ID=<uuid from seed output>

# 4. Run the full mock-onboarding suite
npm run test:e2e:mock

# 5. View the HTML report
npm run test:e2e:report

# 6. Tear down when done
E2E_SEED_CONFIRM=yes node scripts/teardown-test-company.mjs
```

---

## Suite 1 — Company Onboarding Flow (`onboarding-flow.spec.ts`)

Tests the `/company-signup` UI form and `/api/auth/company-register` API.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1.1 | Page loads with company name and owner fields | — | |
| 1.2 | Submit with empty form shows validation errors | — | |
| 1.3 | Agreement checkbox required before submit | — | |
| 1.4 | Invalid email format shows error | — | |
| 1.5 | Short password shows client-side error (if implemented) | — | informational |
| 1.6 | Valid form submission → success or duplicate-user message | — | uses API directly |
| 1.7 | API rejects missing required fields (400) | — | |
| 1.8 | API rejects submission without agreement (400) | — | |

---

## Suite 2 — Field User Function Pass (`field-user-function-pass.spec.ts`)

Walks every module as a standard non-admin user.

| # | Function / Module | Status | Notes |
|---|-------------------|--------|-------|
| 2.1 | **Auth**: stored session reaches authenticated shell | — | |
| 2.2 | **Auth**: /dashboard not redirected to /login | — | |
| 2.3 | **Dashboard**: page loads without 500 | — | |
| 2.4 | **Dashboard**: company context visible | — | |
| 2.5 | **Jobsites**: list page loads | — | |
| 2.6 | **Jobsites**: test jobsite appears in list | — | |
| 2.7 | **Jobsite/overview**: loads | — | |
| 2.8 | **Jobsite/team**: loads | — | |
| 2.9 | **Jobsite/jsa**: loads | — | |
| 2.10 | **Jobsite/incidents**: loads | — | |
| 2.11 | **Jobsite/permits**: loads | — | |
| 2.12 | **Jobsite/documents**: loads | — | |
| 2.13 | **Jobsite/schedule**: loads | — | |
| 2.14 | **Documents**: page loads | — | |
| 2.15 | **Documents**: list or empty state visible | — | |
| 2.16 | **Documents**: upload control present | — | |
| 2.17 | **JSA hub**: loads | — | |
| 2.18 | **JSA/jobsite**: loads | — | |
| 2.19 | **JSA AI fill**: API call succeeds and returns sane output | — | |
| 2.20 | **Incidents hub**: loads | — | |
| 2.21 | **Incidents/jobsite**: loads | — | |
| 2.22 | **Incidents**: new incident form opens | — | |
| 2.23 | **Permits hub**: loads | — | |
| 2.24 | **Permits/jobsite**: loads | — | |
| 2.25 | **Safety Intelligence**: loads | — | |
| 2.26 | **Reports/jobsite**: loads | — | |
| 2.27 | **OSHA 300**: loads | — | |
| 2.28 | **Inductions**: company page loads | — | |
| 2.29 | **Inductions/jobsite**: loads | — | |
| 2.30 | **Admin gate**: field user blocked from /admin | — | |

---

## Suite 3 — Admin Function Pass (`admin-function-pass.spec.ts`)

Tests admin-only features as the company admin user.

| # | Function / Module | Status | Notes |
|---|-------------------|--------|-------|
| 3.1 | **Auth**: admin session reaches dashboard | — | |
| 3.2 | **Dashboard**: admin view loads | — | |
| 3.3 | **Company setup**: page accessible | — | |
| 3.4 | **Onboarding import**: 3-tab UI visible | — | |
| 3.5 | **Company integrations**: page loads | — | |
| 3.6 | **Company contractors**: page loads | — | |
| 3.7 | **Team management**: jobsite team shows members | — | |
| 3.8 | **Documents**: page loads for admin | — | |
| 3.9 | **Documents**: admin can open upload/create flow | — | |
| 3.10 | **Jobsite documents**: tab loads | — | |
| 3.11 | **JSA/jobsite**: loads for admin | — | |
| 3.12 | **JSA AI fill**: API responds with 200 and non-empty body | — | |
| 3.13 | **Incidents**: admin can open new incident form | — | |
| 3.14 | **Permits**: admin can open new permit form | — | |
| 3.15 | **Inductions**: company page loads | — | |
| 3.16 | **Inductions/jobsite**: tab loads | — | |
| 3.17 | **Safety forms**: page loads | — | |
| 3.18 | **Reports/jobsite**: loads with generation options | — | |
| 3.19 | **OSHA 300**: loads for admin | — | |

---

## Suite 4 — RLS Boundary Tests (`rls-boundaries.spec.ts`)

Cross-tenant isolation and role escalation prevention.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.1 | Foreign company overview → redirected or empty | — | |
| 4.2 | Foreign jobsite overview → redirected or 404 | — | |
| 4.3 | Foreign jobsite JSA tab → redirected or blocked | — | |
| 4.4 | Foreign jobsite incidents tab → redirected or blocked | — | |
| 4.5 | **RLS**: JWT cannot read foreign company_memberships (0 rows) | — | Supabase REST |
| 4.6 | **RLS**: JWT cannot read foreign company_jobsites (0 rows) | — | Supabase REST |
| 4.7 | **RLS**: JWT CAN read own company_jobsites (≥1 row) | — | Supabase REST |
| 4.8 | **RLS**: JWT cannot read foreign company_jsas (0 rows) | — | Supabase REST |
| 4.9 | **RLS**: JWT cannot read foreign company_incidents (0 rows) | — | Supabase REST |
| 4.10 | Field user denied /admin | — | |
| 4.11 | Field user denied /admin/users | — | |
| 4.12 | Field user denied /admin/companies | — | |
| 4.13 | /dashboard → /login (unauthenticated) | — | clean session |
| 4.14 | /documents → /login (unauthenticated) | — | clean session |
| 4.15 | /jobsites → /login (unauthenticated) | — | clean session |
| 4.16 | /incidents → /login (unauthenticated) | — | clean session |
| 4.17 | /permits → /login (unauthenticated) | — | clean session |
| 4.18 | /jsa → /login (unauthenticated) | — | clean session |
| 4.19 | /admin → /login (unauthenticated) | — | clean session |

---

## Bug Report

*Fill in after the run. Format: severity, steps to reproduce, expected vs actual.*

### Open Bugs

> None documented yet — run the suite and record failures here.

| # | Severity | Suite | Test | Steps to Reproduce | Expected | Actual |
|---|----------|-------|------|--------------------|----------|--------|
| — | — | — | — | — | — | — |

### Severity Guide

| Level | Meaning |
|-------|---------|
| **P0** | Data leak / auth bypass / production blocker |
| **P1** | Core feature broken for all users |
| **P2** | Feature broken for a specific role or edge case |
| **P3** | Visual / UX issue, non-blocking |

---

## Environment Tested

| Variable | Value |
|----------|-------|
| `PLAYWRIGHT_BASE_URL` | `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | *(staging)* |
| Seed company ID | *(set after seed)* |
| Seed jobsite ID | *(set after seed)* |
