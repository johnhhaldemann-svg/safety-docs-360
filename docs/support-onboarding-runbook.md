# Support and onboarding runbook (launch alignment)

Use this to align **how you launch** (pilot, open beta, paid) with operations. Replace placeholders with your decisions and contacts.

## Launch mode

| Mode | Signup | Billing | Typical legal intensity |
|------|--------|---------|-------------------------|
| Internal / pilot | Invite-only | None | Low–medium (still PII) |
| Private beta | Waitlist or invite | Optional test mode | Medium |
| Open signup | Self-serve registration | Optional | Higher (privacy, terms visibility) |
| Paid from day one | As above | Stripe **live** + webhooks | Higher |

## Company onboarding

- **Who creates companies?** (platform admin only vs self-serve `company-register`).
- **Default roles** for the first user (e.g. `company_admin`).
- **Invite flow**: email provider (`RESEND_FROM_EMAIL`), bounce handling, resend policy.

## Platform admin

- Document emails in `NEXT_PUBLIC_ADMIN_EMAILS` (see [README](../README.md)).
- **Escalation path**: who receives security or outage pages (on-call or founder list).

## User support (tier 0)

- **Password reset**: Supabase Auth email; document what users should do if mail is missing (spam folder, allowlist).
- **Account suspension**: where `accountStatus` is set and who may reactivate.
- **Agreement version bumps**: how you notify users and whether re-acceptance is required (see admin legal settings).

## Privacy and marketing

- **Privacy**: public `/privacy` ([`app/privacy/page.tsx`](../app/privacy/page.tsx)) — customize body text before external launch; set optional `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel for the contact line.
- **Analytics**: if you enable Vercel Speed Insights or other trackers, disclose them on `/privacy` and in agreements as appropriate.
- **Terms**: [`/terms`](../app/terms/page.tsx) reflects configurable agreement content; have counsel review for external customers.

## Stripe (when billing is live)

- Live **`STRIPE_SECRET_KEY`**, **`STRIPE_WEBHOOK_SECRET`**, webhook URL pointing at production `/api/billing/stripe/webhook`.
- Test checkout and webhook delivery in Stripe dashboard after first deploy.
- Document refund and invoice dispute handling internally.

## Incident response (minimal)

- **Credential leak**: rotate Supabase service role and any third-party keys; review Vercel deployment logs access.
- **Data mistake**: Supabase backups / PITR recovery window; document who can run SQL against production.

## Compliance promises

Do **not** promise SOC 2, HIPAA, or specific regulatory certifications in sales unless you have completed that work. This app can support safety workflows; customer contracts define obligations.
