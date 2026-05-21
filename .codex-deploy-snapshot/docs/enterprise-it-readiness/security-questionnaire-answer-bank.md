# Security Questionnaire Answer Bank

Use these answers as drafts only. Replace `Needs Confirmation` items with verified evidence before customer submission.

| Question | Draft Answer | Status | Evidence |
| --- | --- | --- | --- |
| Do you enforce authentication? | Yes. API routes use `authorizeRequest` or shared wrappers before protected data access. | Partial | [lib/rbac.ts](../../lib/rbac.ts), [API RBAC audit](../api-rbac-audit.md) |
| Do you support company-level data segregation? | Company data is keyed by `company_id`; app checks and Supabase RLS enforce company scope across many tables. | Partial | [company scope helper](../../lib/companyScope.ts), [RLS migration](../../supabase/migrations/20260326133000_company_rls_hardening.sql) |
| Do you have role-based access control? | Yes. Roles and permissions are centralized and used by route handlers. | Verified | [lib/rbac.ts](../../lib/rbac.ts), [role matrix](role-permission-matrix.md) |
| Do you provide audit logs? | A company-scoped security event ledger has been added for high-value actions and exposed to company admins/managers. | Partial | [migration](../../supabase/migrations/20260517163358_enterprise_it_readiness_controls.sql), [events API](../../app/api/company/security/events/route.ts) |
| Do you support SSO or SCIM? | Not as a production claim. Requirements and design are drafted for future provider-neutral SAML/OIDC and SCIM. | Needs Confirmation | [SSO/SCIM requirements](sso-scim-requirements.md) |
| Are you SOC 2 or ISO 27001 certified? | No claim in this packet. Readiness binder structure is prepared only. | Needs Confirmation | [SOC 2/ISO binder](soc2-iso-readiness-binder.md) |
| Have you completed a penetration test? | No completed pen-test claim in this packet. Prep checklist is drafted. | Needs Confirmation | [Pen-Test Prep](pen-test-prep-checklist.md) |
| How are files protected? | File routes use signed upload/download/export links with company-scoped storage paths. | Partial | [File Evidence Controls](file-evidence-controls.md) |
| How are privacy requests tracked? | `company_data_requests` tracks export/deletion/correction/privacy review requests with statuses and evidence fields. | Verified | [data request API](../../app/api/company/data-requests/route.ts), [migration](../../supabase/migrations/20260517163358_enterprise_it_readiness_controls.sql) |

