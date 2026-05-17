# Subprocessor List

Draft list for legal/privacy validation. Do not publish until contracts, regions, DPAs, and data categories are confirmed.

| Vendor / Service | Status | Purpose | Data Categories | Evidence Needed |
| --- | --- | --- | --- | --- |
| Vercel | Partial | Application hosting, preview deployments, cron execution. | Application traffic, logs, deployment metadata. | Confirm account, region, plan, DPA, log retention. |
| Supabase | Partial | Auth, Postgres, RLS, Storage. | User accounts, company data, documents, audit records. | Confirm project region, backups, auth settings, DPA. |
| GitHub | Partial | Source control and CI. | Source code, CI metadata, limited secrets in Actions. | Confirm org/repo controls and branch protection. |
| Email provider | Needs Confirmation | Invite and notification delivery. | Recipient email, invite metadata. | Confirm provider, sending domain, retention, DPA. |
| AI provider(s) | Needs Confirmation | Safety Intelligence drafting/review. | Prompts, generated outputs, jobsite context as configured. | Confirm provider list, data retention, no-training terms, regions. |
| Microsoft | Partial | Microsoft Project OAuth/sync when enabled. | OAuth tokens, project/task metadata. | Confirm tenant app registration and permissions. |

