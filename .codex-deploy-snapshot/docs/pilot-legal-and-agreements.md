# Pilot legal, privacy, and agreement strategy

Use before taking **payment** or **production PII** from external pilots.

## Privacy (`/privacy`)

- Source: [`app/privacy/page.tsx`](../app/privacy/page.tsx).
- **Before go-live:** Replace generic body copy with your data categories, subprocessors you actually use (Supabase, Vercel, Stripe, Resend, OpenAI if enabled), retention, and contact for privacy requests.
- Set **`NEXT_PUBLIC_SUPPORT_EMAIL`** in Vercel so the public contact line is not a placeholder.

## Terms and waivers (`/terms`)

- Source: [`app/terms/page.tsx`](../app/terms/page.tsx); legal clauses may also pull from [`lib/legal.ts`](../lib/legal.ts) depending on surface.
- **Before go-live:** Have counsel review configurable agreement content for your jurisdiction and pilot industry.
- Align in-app **acceptance** flow with admin agreement version bumps ([`app/(app)/layout.tsx`](../app/(app)/layout.tsx) agreement gate).

## Agreement version bumps

| Decision | Owner | Your choice |
|----------|-------|-------------|
| Who approves new agreement text? | | |
| Do users re-accept on next login? | | |
| How are existing pilots notified (email + in-app)? | | |

Document the operational answer in [support-onboarding-runbook](./support-onboarding-runbook.md) § User support.

## What not to claim

Per [support-onboarding-runbook](./support-onboarding-runbook.md): do not promise SOC 2, HIPAA, or certifications you have not completed. Pilot contracts should describe the product as software to support safety workflows, not professional advice.

## Sign-off

| Review | Owner | Date |
|--------|-------|------|
| Privacy page | | |
| Terms / liability | | |
| Support email live | | |
