# Production cutover and 48-hour watch (pilot)

Follow after **staging** sign-off in [pilot-qa-signoff](./pilot-qa-signoff.md). Full reference: [production-deployment](./production-deployment.md).

## Deploy order (non-negotiable)

1. **Supabase:** apply all pending migrations to the **production** project (`supabase link` + `supabase db push` or approved CI workflow with prod ref).
2. **Vercel:** deploy the commit that matches those migrations.
3. **Verify crons:** set `CRON_SECRET` in Vercel Production; confirm scheduled routes return `200` with auth (see [lib/cronAuth.ts](../lib/cronAuth.ts)).

## Immediate smoke (first 30 minutes)

| Check | Pass? |
|-------|--------|
| `/`, `/login`, `/terms`, `/privacy` | ☐ |
| Sign in as prod smoke user; open Command Center | ☐ |
| One company-scoped API call succeeds (e.g. workspace summary) | ☐ |
| Stripe webhook **live** endpoint receives test event (if billing live) | ☐ |

Extended list: [release-readiness](./release-readiness.md) § Production smoke.

## 48-hour watch plan

| Item | Detail |
|------|--------|
| **On-call** | Name and phone from [support-onboarding-runbook](./support-onboarding-runbook.md) escalation table |
| **Logs** | Vercel deployment and function logs; Supabase Auth and API errors |
| **Rollback** | Prefer forward-fix for schema; app rollback via Vercel **Redeploy** previous deployment if code-only |
| **Customer comms** | Single support inbox; template “we are investigating” if incident |

## Post–48 hours

- Export pilot sign-off summary into [parity-modules-release-validation](./parity-modules-release-validation.md) §6.
- File top support issues for [post-pilot-checklist-backlog](./post-pilot-checklist-backlog.md).
