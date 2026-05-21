# Safety360Docs Enterprise IT Readiness Packet

Status key: `Verified` means repo evidence exists. `Partial` means a control exists but needs environment, dashboard, or process evidence. `Needs Confirmation` means qualified human review or external evidence is still required.

This packet is an internal IT/Cyber validation draft. It is not a public trust center and should not be sent to customers until legal, privacy, security, and operations owners review it.

| Artifact | Status | Purpose | Evidence |
| --- | --- | --- | --- |
| [Security Overview](security-overview.md) | Partial | Summarizes current controls and non-claims. | [Next app](../../app), [RBAC](../../lib/rbac.ts), [Supabase migrations](../../supabase/migrations) |
| [Architecture Diagram](architecture-diagram.md) | Partial | Shows app, Vercel, Supabase, storage, CI, and cron boundaries. | [vercel.json](../../vercel.json), [Supabase config](../../supabase/config.toml) |
| [Data Flow Diagram](data-flow-diagram.md) | Partial | Maps auth, company data, files, AI, and audit events. | [company APIs](../../app/api/company), [security event migration](../../supabase/migrations/20260517163358_enterprise_it_readiness_controls.sql) |
| [Network Allowlist Guide](network-allowlist-guide.md) | Partial | Lists domains IT teams may need to allow. | [Vercel config](../../vercel.json), [Supabase clients](../../lib) |
| [Role/Permission Matrix](role-permission-matrix.md) | Verified | Maps app roles to key permissions. | [lib/rbac.ts](../../lib/rbac.ts), [lib/companyPermissions.ts](../../lib/companyPermissions.ts) |
| [Audit Logging Summary](audit-logging-summary.md) | Partial | Covers existing and new audit/event evidence. | [company security events helper](../../lib/companySecurityEvents.ts), [download audit](../../lib/downloadAudit.ts) |
| [Incident Response Summary](incident-response-summary.md) | Needs Confirmation | Draft response workflow for human owner review. | Process evidence required |
| [Backup/DR Summary](backup-dr-summary.md) | Needs Confirmation | Draft backup and restore claims requiring Supabase/Vercel evidence. | Dashboard evidence required |
| [Subprocessor List](subprocessor-list.md) | Needs Confirmation | Draft vendor inventory. | Contracts/privacy review required |
| [Security Questionnaire Answer Bank](security-questionnaire-answer-bank.md) | Partial | Conservative reusable answers for IT review. | This packet plus repo links |
| [IT Security Roadmap](it-security-roadmap.md) | Partial | 30/60/90 roadmap and validation lane. | This implementation |
| [Gap Register](gap-register.md) | Partial | Tracks open enterprise-readiness gaps. | This implementation |
| [File Evidence Controls](file-evidence-controls.md) | Partial | Documents upload/download/export controls. | Upload/export routes |
| [SSO/SCIM Requirements](sso-scim-requirements.md) | Needs Confirmation | Provider-neutral design requirements only. | No production SSO/SCIM claim |
| [SOC 2/ISO Binder](soc2-iso-readiness-binder.md) | Needs Confirmation | Binder structure for later assurance work. | Human-led evidence collection required |
| [OWASP Checklist](owasp-self-review-checklist.md) | Partial | Engineering self-review checklist. | [API RBAC audit](../api-rbac-audit.md) |
| [Pen-Test Prep](pen-test-prep-checklist.md) | Needs Confirmation | Pre-engagement checklist. | External tester required |
| [Remediation Ticket Template](remediation-ticket-template.md) | Verified | Standard remediation format. | This packet |
| [Validation Lane](validation-lane.md) | Partial | GitHub Actions, Vercel Preview, Supabase staging flow. | [.github/workflows](../../.github/workflows), [vercel.json](../../vercel.json) |

