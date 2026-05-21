# Audit Logging Summary

| Audit Area | Status | Evidence | Gaps |
| --- | --- | --- | --- |
| Central company security event ledger | Partial | [migration](../../supabase/migrations/20260517163358_enterprise_it_readiness_controls.sql), [helper](../../lib/companySecurityEvents.ts), [events API](../../app/api/company/security/events/route.ts) | Needs deployed migration, retention policy, and production validation screenshots. |
| Company user invites | Verified | [company users POST](../../app/api/company/users/route.ts) | Email delivery evidence still dashboard/provider based. |
| Role/status changes and removals | Verified | [company users PATCH/DELETE](../../app/api/company/users/[id]/route.ts) | Add more before/after field detail if customer audit exports require it. |
| Upload link creation | Verified | [report attachment upload](../../app/api/company/reports/[id]/attachments/upload-url/route.ts), [corrective action upload](../../app/api/company/corrective-actions/[id]/upload-url/route.ts), [field audit upload](../../app/api/company/field-audits/observations/[id]/upload-url/route.ts) | Storage completion callbacks are not yet centralized. |
| Downloads and export links | Partial | [download audit helper](../../lib/downloadAudit.ts), [library access route](../../app/api/library/access/[id]/route.ts), [report export route](../../app/api/company/reports/export/route.ts) | Normalize all legacy download routes into the company ledger. |
| Security-sensitive AI actions | Partial | [Safety Intelligence AI review route](../../app/api/company/safety-intelligence/ai/review/route.ts) | Review other AI routes for coverage. |
| Data request workflow | Verified | [data request APIs](../../app/api/company/data-requests/route.ts) | Human privacy handling SOP still required. |

