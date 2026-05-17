# SOC 2 / ISO Readiness Binder

This binder is a structure only. It is not a certification claim.

| Binder Section | Status | Evidence Target |
| --- | --- | --- |
| Company overview and system description | Needs Confirmation | Approved architecture narrative, data categories, user groups. |
| Access control | Partial | [RBAC](../../lib/rbac.ts), [role matrix](role-permission-matrix.md), production screenshots. |
| Change management | Partial | GitHub PR/commit history, CI runs, deployment approvals. |
| Secure SDLC | Partial | [API RBAC audit](../api-rbac-audit.md), tests, lint, code review evidence. |
| Data protection | Partial | Supabase RLS migrations, storage signed URL routes, encryption/provider docs. |
| Logging and monitoring | Partial | `company_security_events`, Vercel logs, Supabase logs. |
| Incident response | Needs Confirmation | [incident response draft](incident-response-summary.md), owner-approved runbook. |
| Vendor management | Needs Confirmation | [subprocessor draft](subprocessor-list.md), DPAs, security pages. |
| Backup and DR | Needs Confirmation | [backup/DR draft](backup-dr-summary.md), restore test evidence. |
| Risk assessment | Needs Confirmation | Gap register, risk register, remediation tickets. |

