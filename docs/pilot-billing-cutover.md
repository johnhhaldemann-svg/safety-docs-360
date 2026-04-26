# Pilot billing: Stripe test on staging, live cutover

## Staging (required before pilot money)

1. In **Stripe Dashboard**, stay in **Test mode**.
2. In Vercel **Preview** or staging project env:
   - `STRIPE_SECRET_KEY` = `sk_test_…`
   - `STRIPE_WEBHOOK_SECRET` = signing secret for a **test** webhook endpoint pointing at your staging origin, e.g. `https://<staging>/api/billing/stripe/webhook`
3. Deploy staging; run **Stripe CLI** or Dashboard “Send test webhook” to confirm `200` responses and idempotency (check Vercel logs).
4. Walk through **customer billing** in the app (`/customer/billing` and related invoice routes) as a test company admin: view subscription state, invoices list if applicable.
5. **Marketplace credit receipt** email (if pilots buy credits): requires `RESEND_API_KEY` and billing receipt from-address vars per [.env.example](../.env.example) — verify in Resend dashboard.

| Staging check | Done? | Evidence |
|---------------|-------|----------|
| Test checkout completes | ☐ | Stripe Dashboard payment intent |
| Webhook delivery success | ☐ | Screenshot or log line |
| In-app billing matches Stripe state | ☐ | |

## Production live cutover (only when contract requires live billing)

Follow [support-onboarding-runbook](./support-onboarding-runbook.md) Stripe section and:

1. Replace env with **live** `STRIPE_SECRET_KEY` and **live** `STRIPE_WEBHOOK_SECRET` for a webhook URL on the **production** domain only.
2. Redeploy Vercel after env changes.
3. Run one **small real** transaction or Stripe test card in live mode per Stripe docs (if applicable), then verify webhook and in-app invoice row.
4. Document **refund and dispute** handling: owner, SLA, and Stripe Dashboard steps (fill in [support-onboarding-runbook](./support-onboarding-runbook.md) § Refunds).

## Rollback

- Revert Vercel env to test keys **only** on a non-production project; for production incidents, disable new checkouts via Stripe Dashboard or feature flag rather than leaving prod on test keys long term.

## Pilot “billing visible” minimum

- Customer can see **plan name**, **billing status**, and **invoice list or placeholder** consistent with their contract.
- Internal admin can reconcile Stripe Customer ID to company row (document where that link lives for support).
