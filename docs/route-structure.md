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
- `/api/company/inductions/programs`
- `/api/company/inductions/programs/[id]`
- `/api/company/inductions/requirements`
- `/api/company/inductions/requirements/[id]`
- `/api/company/inductions/completions`
- `/api/company/inductions/evaluate`
- `/api/company/toolbox/templates`, `/api/company/toolbox/sessions`, `/api/company/toolbox/sessions/[id]`
- `/api/company/contractors/[id]/documents`, `/api/company/contractors/[id]/evaluate`
- `/api/company/chemicals`, `/api/company/chemicals/[id]`
- `/api/company/safety-forms/definitions`, `/api/company/safety-forms/definitions/[id]`, `/api/company/safety-forms/definitions/[id]/versions` (GET list / POST publish)
- `/api/company/safety-forms/submissions`, `/api/company/safety-forms/submissions/[id]`
- `/api/company/integrations/webhooks`, `/api/company/integrations/webhooks/[id]`, `/api/company/integrations/webhooks/[id]/deliveries` (GET log / POST test send)
- `/api/company/integrations/hris/roster` (POST MVP batch metadata)
- `/api/company/field-sync/batch`

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

- `/company-inductions`, `/company-safety-forms`, `/company-integrations`
- `/dashboard`
- `/jobsites`
- `/jobsites/[jobsiteId]/overview`
- `/jobsites/[jobsiteId]/inductions`
- `/jobsites/[jobsiteId]/safety-forms`
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
