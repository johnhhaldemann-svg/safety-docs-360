# Network Allowlist Guide

| Destination | Status | Purpose | Evidence / Confirmation |
| --- | --- | --- | --- |
| Safety360Docs production domain | Needs Confirmation | User access to the application. | Confirm production hostname in Vercel dashboard before sharing. |
| Vercel deployment domains | Partial | Preview and production hosting. | [vercel.json](../../vercel.json), Vercel dashboard evidence required. |
| Supabase project REST/Auth/Storage domains | Needs Confirmation | Auth, database API, and storage. | Confirm project ref and region in Supabase dashboard. |
| Email provider sending domain | Needs Confirmation | Company invite email delivery. | [invite email helper](../../lib/inviteEmail.ts), provider dashboard required. |
| Microsoft Graph / login endpoints | Partial | Microsoft Project integration OAuth and sync when enabled. | [Microsoft Project integration](../../app/api/company/integrations/microsoft-project) |
| AI provider endpoints | Needs Confirmation | Safety Intelligence drafting/review actions. | Review environment variables and provider contracts before listing. |

Outbound firewall guidance should be finalized from the deployed environment variables, not inferred only from code.

