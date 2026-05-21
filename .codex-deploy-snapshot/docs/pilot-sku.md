# Pilot SKU (revenue-ready, 1–3 customers)

**Purpose:** One page that locks what paying pilots **buy** versus what stays **out of scope** or **waived** until post-pilot. Sales, support, and engineering should match this document.

## Included modules (default full-workspace pilot)

Unless the contract says otherwise, the **default pilot SKU** includes:

| Area | User-facing surfaces | Notes |
|------|----------------------|--------|
| Identity | Sign up / sign in / sign out; password reset via Supabase Auth | Invite-only or open per [support-onboarding-runbook](./support-onboarding-runbook.md) |
| Company & jobsite | Company profile, jobsites, team invites, jobsite assignments | RBAC per [api-rbac-audit](./api-rbac-audit.md) |
| Command & dashboard | Command Center, company dashboard | Adoption checklist in [release-readiness](./release-readiness.md) |
| Documents | Library, upload, search (**documents only** — see waivers) | Submit/admin review if sold below |
| Field | JSA Builder, Permit Center, Field Issue Log (corrective actions), Incident Log | “Observations” in sales copy may map to Field Issue Log + analytics |
| Programs | Company inductions, safety forms setup (if in contract) | Parity validation in [parity-modules-release-validation](./parity-modules-release-validation.md) |
| Intelligence | Safety Intelligence, Safety analytics, Risk Memory (facets) | AI requires configured keys per `.env.example` |
| Billing | Customer billing / invoices as enabled for the workspace | Stripe test vs live per [pilot-billing-cutover](./pilot-billing-cutover.md) |

## Optional add-ons (explicit in contract)

- Internal **admin document review** queue (`/admin/review-documents`) and related submit flows.
- **CSEP-only** or **full workspace** product flags (`workspaceProduct` / CSEP-only guards).
- **Marketplace** credit purchases and library unlocks.
- **Superadmin-only** tools (Injury Weather lab, etc.) are **not** part of the standard pilot SKU unless separately sold.

## Checklist waivers (acceptable for pilot if customer agrees)

Document these in the pilot contract or appendix:

| PDF / checklist item | Current product behavior | Pilot stance |
|----------------------|--------------------------|--------------|
| Phase 12 — global search | `/search` is **document search** only (library scope). | **Waived** or “phase 2” unless pilot pays for cross-module search. |
| Phase 5 — full submission status set | Core labels in UI lean on draft / in review / approved / archived patterns; not every PDF state name. | **Waived** unless review workflow requires more states. |
| Phase 7 — full permit type library | Permit Center exposes a **fixed set** of permit types in the primary form; more types may appear via copilot/JSA context. | **Waived** unless vertical mandates full catalog in UI. |
| Phase 15 — “Risk Forecast Register” | Company users see injury/risk signals in **analytics**; full Injury Weather dashboard is primarily **superadmin**. | Clarify in contract what pilots see; may be **waived** or partially met. |
| Phase 18 — full email matrix | Resend used for **invites** and **marketplace credit receipts**; other events may be in-app only. | List **pilot SLA** in [pilot-notifications-inventory](./pilot-notifications-inventory.md). |

## Role assumptions for pilot testing

Use **realistic** test accounts on staging:

| Role | Pilot test expectation |
|------|-------------------------|
| Platform superadmin | Staging only unless explicitly approved for prod smoke. |
| Company admin | Full company setup, billing visibility, team invites, review queues if in SKU. |
| Safety manager / jobsite lead | Jobsite-scoped field and document actions per RBAC. |
| Field user | Create JSAs, field issues, read assigned jobsites; **cannot** access other companies or admin-only routes. |

Sign-off: record names and dates in [pilot-qa-signoff](./pilot-qa-signoff.md).
