# Pilot notifications — inventory and MVP SLA

This document lists **what exists today** in code and what pilots should **expect** versus a full checklist-style notification matrix.

## Email (Resend)

| Flow | Implementation | Env / config | Pilot SLA |
|------|------------------|----------------|-----------|
| Company user invite | [`lib/inviteEmail.ts`](../lib/inviteEmail.ts) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` or `COMPANY_INVITE_FROM_EMAIL` | **Must work** if pilots are invite-only |
| Marketplace credit purchase receipt | [`lib/billing/marketplaceCreditReceiptEmail.ts`](../lib/billing/marketplaceCreditReceiptEmail.ts) | `RESEND_API_KEY`, `BILLING_RECEIPT_FROM_EMAIL` (and related) | **Should work** if pilots buy credits |
| Password reset / magic link | **Supabase Auth** (not Resend in-app code path) | Supabase project email or custom SMTP | **Must work** — configure in Supabase dashboard |

If `RESEND_API_KEY` is missing, invite and receipt flows **degrade gracefully** with user-visible messages (see those modules).

## In-app

| Surface | Behavior | Pilot SLA |
|---------|----------|-----------|
| Company admin dashboard | “Notifications” tile shows a **count** derived from pending users, pending documents, and open invites ([`app/(app)/dashboard/company-admin-dashboard.tsx`](../app/(app)/dashboard/company-admin-dashboard.tsx)) | Treat as **summary**, not a full event feed |
| Toasts / inline errors | Per-page `sonner` or workspace primitives | Standard UX |

There is **no** single unified notification center covering every workflow event in the PDF checklist.

## Pilot contractual gaps

If the pilot contract requires **email** for events not listed above (e.g. every corrective action assignment, every document status change), treat that as **engineering work**: add a route-specific hook or outbound job and extend this table.

**Action:** Fill the right column below for your pilot.

| Event | Email today? | In-app today? | Pilot requires email? |
|-------|--------------|---------------|------------------------|
| Document submitted / approved | No dedicated Resend flow located | Dashboard / library status | ☐ |
| Corrective action assigned / overdue | No dedicated Resend flow located | Field Issue Log, dashboard metrics | ☐ |
| Permit expiring | No dedicated Resend flow located | Permits UI, analytics as configured | ☐ |
| Training expiring | No dedicated Resend flow located | Training Tracker matrix | ☐ |
| Incident submitted | No dedicated Resend flow located | Incident Log | ☐ |

Default for unspecified rows: **in-app or dashboard only** unless the contract says otherwise.
