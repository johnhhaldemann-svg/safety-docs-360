# Support and onboarding runbook (launch alignment)

Use this to align **how you launch** (pilot, open beta, paid) with operations. Fill the **Organization configuration** tables before external pilots pay or receive production access.

**Pilot pack (this repo):** [pilot-sku](./pilot-sku.md) · [pilot-staging-and-env](./pilot-staging-and-env.md) · [pilot-qa-signoff](./pilot-qa-signoff.md) · [pilot-billing-cutover](./pilot-billing-cutover.md) · [pilot-notifications-inventory](./pilot-notifications-inventory.md) · [pilot-legal-and-agreements](./pilot-legal-and-agreements.md) · [pilot-production-cutover](./pilot-production-cutover.md)

## Organization configuration (fill in)

| Field | Value |
|-------|-------|
| Company / product legal name | |
| Public support email (`NEXT_PUBLIC_SUPPORT_EMAIL`) | |
| Internal engineering on-call email / phone | |
| Internal security escalation contact | |
| Customer-facing support hours (timezone) | |

## Launch mode

| Mode | Signup | Billing | Typical legal intensity |
|------|--------|---------|-------------------------|
| Internal / pilot | Invite-only | None | Low–medium (still PII) |
| Private beta | Waitlist or invite | Optional test mode | Medium |
| Open signup | Self-serve registration | Optional | Higher (privacy, terms visibility) |
| Paid from day one | As above | Stripe **live** + webhooks | Higher |

## Company onboarding

| Decision | Your answer |
|----------|-------------|
| Who creates companies? (platform admin only vs self-serve `company-register`) | |
| Default role for first user (e.g. `company_admin`) | |
| Invite email sender (`RESEND_FROM_EMAIL` / `COMPANY_INVITE_FROM_EMAIL`) | |
| Bounce / undeliverable handling | |
| Max invites per day (optional guardrail) | |

## Platform admin

| Item | Value |
|------|-------|
| Emails in `NEXT_PUBLIC_ADMIN_EMAILS` (comma-separated) | |
| Who receives **security** escalations (name + contact) | |
| Who receives **outage / availability** pages (name + contact) | |
| Who may run **raw SQL** against production (if anyone) | |

## User support (tier 0)

| Topic | Runbook entry |
|-------|----------------|
| Password reset | Supabase Auth email. If mail missing: spam folder, corporate allowlist, confirm Supabase SMTP. |
| Account suspension | Where `accountStatus` is set: document table/UI path. Who may reactivate: name + role. |
| Agreement version bumps | How users are notified (email template owner, in-app banner). Re-accept required? Y/N. Owner: |

## Refunds, credits, and disputes (Stripe)

| Scenario | Owner | SLA / steps |
|----------|-------|-------------|
| Refund request (subscription) | | |
| Refund request (one-time / credits) | | |
| Chargeback / dispute | | |
| Pilot “money back” promise (if any) | | |

## Privacy and marketing

- **Privacy**: public `/privacy` ([`app/privacy/page.tsx`](../app/privacy/page.tsx)) — customize body text before external launch; set optional `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel for the contact line.
- **Analytics**: if you enable Vercel Speed Insights or other trackers, disclose them on `/privacy` and in agreements as appropriate.
- **Terms**: [`/terms`](../app/terms/page.tsx) reflects configurable agreement content; have counsel review for external customers.

## Stripe (when billing is live)

- Live **`STRIPE_SECRET_KEY`**, **`STRIPE_WEBHOOK_SECRET`**, webhook URL pointing at production `/api/billing/stripe/webhook`.
- Test checkout and webhook delivery in Stripe dashboard after first deploy.
- Staging test mode and live cutover checklist: [pilot-billing-cutover](./pilot-billing-cutover.md). Refund ownership: table above.

## Incident response (minimal)

- **Credential leak**: rotate Supabase service role and any third-party keys; review Vercel deployment logs access.
- **Data mistake**: Supabase backups / PITR recovery window; document who can run SQL against production.

## Compliance promises

Do **not** promise SOC 2, HIPAA, or specific regulatory certifications in sales unless you have completed that work. This app can support safety workflows; customer contracts define obligations.
