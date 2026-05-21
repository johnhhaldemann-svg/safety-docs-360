# Incident Response Summary

This is a draft operating summary. It should be reviewed by the business owner, legal/privacy reviewer, and technical lead before it is used externally.

| Area | Status | Draft Control | Evidence Needed |
| --- | --- | --- | --- |
| Incident intake | Needs Confirmation | Security issues should be triaged through a designated owner and tracked as remediation tickets. | Confirm mailbox, escalation owner, and ticket system. |
| Triage | Partial | App now has company security events for high-value customer-impacting actions. | [security event ledger](../../lib/companySecurityEvents.ts), production event samples required. |
| Containment | Needs Confirmation | Disable affected user/company access, rotate exposed secrets, pause integrations, or block routes as needed. | Runbook owner and approval matrix required. |
| Investigation | Partial | Use GitHub commits, Vercel deployment/log evidence, Supabase audit/query evidence, and company security events. | Vercel/Supabase log retention evidence required. |
| Notification | Needs Confirmation | Legal/privacy owner decides customer, regulator, and subprocessor notices. | Counsel-approved breach notification procedure required. |
| Post-incident review | Needs Confirmation | Capture root cause, timeline, impact, corrective actions, and prevention tasks. | Retrospective template and owner approval required. |

