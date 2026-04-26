# Post-pilot backlog (PDF checklist alignment)

Work here after **revenue pilot** is stable. Priority is **contract-driven** and **support-driven**, not page order of the beta-to-release PDF.

## P1 — high leverage / common pilot asks

| Item | Gap | Primary implementation direction |
|------|-----|----------------------------------|
| Global search (Phase 12) | `/search` is documents-only | New `GET /api/company/search` (or workspace-scoped) aggregating documents, JSAs, permits, field issues, incidents, training rows with unified RBAC filters |
| Document workflow states (Phase 5) | Narrower normalized labels | Align `documents.status` checks in DB + [`lib/documentStatus.ts`](../lib/documentStatus.ts) + admin review UI with required business states |
| Company-facing risk forecast (Phase 15 / Beta Gate 4) | Full Injury Weather UI is superadmin-heavy | Expose read-only Injury Weather or analytics “register” to company admins with strict `permissionMap` gates |
| Notifications (Phase 18) | Limited Resend coverage | Queue + templates per event type; start with highest-volume pilot pain (e.g. review queue, assignment) |

## P2 — depth and verticals

| Item | Gap | Direction |
|------|-----|-----------|
| Permit library (Phase 7) | Fixed permit type list in Permit Center UI | Data-driven taxonomy (config table or `lib` manifest) shared by UI + [`lib/permitCopilot.ts`](../lib/permitCopilot.ts) |
| Marketplace / templates (Phase 16) | Depends on SKU | Admin upload flows, purchase ledger UX hardening |
| Observation UX vs Field Issue Log (Phase 8) | Naming and form fields differ from PDF | Optional dedicated “observation” mode or documentation that maps PDF language to Field Issue Log |

## Tracking

Link each row to a ticket; when shipped, update [parity-modules-release-validation](./parity-modules-release-validation.md) and retire waivers in [pilot-sku](./pilot-sku.md).
