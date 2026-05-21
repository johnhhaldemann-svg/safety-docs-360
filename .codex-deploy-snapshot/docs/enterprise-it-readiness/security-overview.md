# Security Overview

Scope: Safety360Docs application controls visible in the repository as of 2026-05-17. Hosted Supabase, Vercel, domain, logging-retention, legal, and backup claims need dashboard or owner confirmation before customer use.

| Claim | Status | Evidence | Review Notes |
| --- | --- | --- | --- |
| Safety360Docs is a Next.js application intended to run on Vercel. | Verified | [package.json](../../package.json), [vercel.json](../../vercel.json) | Confirm production project/team in Vercel dashboard. |
| Authentication is implemented through Supabase Auth helpers and server-side route authorization. | Verified | [lib/rbac.ts](../../lib/rbac.ts), [lib/supabase/server.ts](../../lib/supabase/server.ts) | Hosted Auth settings still need dashboard screenshots. |
| Company data is scoped by `company_id` and protected by app checks plus Supabase RLS for many company tables. | Partial | [company scope helper](../../lib/companyScope.ts), [RLS hardening migration](../../supabase/migrations/20260326133000_company_rls_hardening.sql) | Run Supabase advisors and spot-check current hosted schema. |
| Roles and permissions are centralized in the app. | Verified | [lib/rbac.ts](../../lib/rbac.ts), [lib/companyPermissions.ts](../../lib/companyPermissions.ts) | Customer-facing role names should be reviewed for clarity. |
| Company invites, role/status updates, removals, upload links, downloads, exports, AI review actions, and data requests now have a centralized security ledger path. | Partial | [migration](../../supabase/migrations/20260517163358_enterprise_it_readiness_controls.sql), [helper](../../lib/companySecurityEvents.ts), [company users API](../../app/api/company/users/route.ts) | Requires migration deployment and retention policy. |
| Public security certifications are not currently claimed in this packet. | Verified | [gap register](gap-register.md), [SOC 2/ISO binder](soc2-iso-readiness-binder.md) | Do not claim SOC 2, ISO 27001, completed pen test, or production SSO/SCIM until verified. |

