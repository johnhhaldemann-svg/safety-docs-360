# Pen-Test Prep Checklist

| Item | Status | Required Before Test |
| --- | --- | --- |
| Scope | Needs Confirmation | Domains, APIs, roles, test tenant, excluded production actions. |
| Test accounts | Needs Confirmation | Platform admin, company admin, manager, safety manager, field user, read only. |
| Test data | Needs Confirmation | Seed company/jobsites/documents/files with no real customer data. |
| Environment | Needs Confirmation | Use Vercel Preview + Supabase staging unless production test is approved. |
| Rules of engagement | Needs Confirmation | Rate limits, safe hours, contacts, severity definitions, stop conditions. |
| Logging | Partial | Confirm `company_security_events`, Vercel logs, Supabase logs, and CI/deploy evidence are available. |
| Remediation workflow | Verified | Use [remediation ticket template](remediation-ticket-template.md). |

