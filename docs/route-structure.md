# Safety Ops Route Structure

This project is organized by company-scoped modules and jobsite surfaces.

## Core Company APIs

- `/api/company/users`
- `/api/company/jobsite-assignments`
- `/api/company/jobsites`
- `/api/company/daps`
- `/api/company/dap-activities`
- `/api/company/observations`
- `/api/company/observations/[id]`
- `/api/company/corrective-actions` (legacy-compatible surface still in use)
- `/api/company/permits`
- `/api/company/incidents`
- `/api/company/reports`
- `/api/company/reports/[id]/attachments`
- `/api/company/analytics/summary`

## Jobsite Surfaces

- `/api/jobsites/[jobsiteId]/overview`
- `/api/jobsites/[jobsiteId]/live-view`
- `/api/jobsites/[jobsiteId]/dap`
- `/api/jobsites/[jobsiteId]/permits`
- `/api/jobsites/[jobsiteId]/incidents`
- `/api/jobsites/[jobsiteId]/reports`
- `/api/jobsites/[jobsiteId]/documents`
- `/api/jobsites/[jobsiteId]/analytics`
- `/api/jobsites/[jobsiteId]/team`

## Primary UI Surfaces

- `/dashboard`
- `/jobsites`
- `/jobsites/[jobsiteId]/overview`
- `/jobsites/[jobsiteId]/live-view`
- `/daps`
- `/field-id-exchange`
- `/permits`
- `/incidents`
- `/reports`
- `/analytics`

## Security Boundaries

- Company scope enforced in route handlers via `getCompanyScope`.
- Jobsite scope enforced via `getJobsiteAccessScope` + `isJobsiteAllowed`.
- Shared role checks from `lib/companyPermissions.ts`.
- DB-level RLS and storage policies in `supabase/migrations/*`.
