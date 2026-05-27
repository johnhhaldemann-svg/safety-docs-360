# Supabase Data Readiness Audit

Audit date: May 27, 2026

Production project: `safetydocs360` (`mdqkfbnwxrasdmbsjcqv`)

Staging project: `safetydocs360-staging` (`dacafxrcrijqevgjotjc`)

Scope: aggregate-only Supabase cleanup and data readiness review. No customer row details were exported, and no production data or schema changes were made.

## Executive Summary

Production has the latest local migration history applied through `20260527112609_ai_improvement_workflow`, but it is not ready for broad customer demonstration without staged cleanup. The main gaps are missing operational data, missing platform/reference data, broad API/security surfaces, and an empty staging project that still needs the recovered baseline bootstrap.

Staging is currently empty from the Supabase API. Bootstrap and verify staging before applying cleanup migrations or any data scripts.

## Current Production Snapshot

Migration health:
- Remote migration count: 195.
- Latest remote migration: `20260527112609`.
- Local migration count: 195.

Safety readiness:
- Active companies: 13.
- Companies missing active membership: 5.
- Companies missing a subscription: 1.
- Companies missing an active jobsite: 6.
- Companies missing employee profiles: 11.
- Companies missing training requirements: 9.
- Companies missing training records: 11.
- Companies missing JSAs: 10.
- Companies missing permits: 9.
- Companies missing incidents: 9.
- Companies missing corrective actions: 8.
- Companies missing reports: 11.
- Companies missing schedule items: 12.
- Companies missing emergency profiles: 13.
- Companies missing risk scores: 13.
- Companies missing risk recommendations: 12.
- Companies missing memory items: 10.

Jobsite readiness:
- Active jobsites: 42.
- Jobsites missing emergency profile: 42.
- Jobsites missing schedule items: 41.
- Jobsites missing site map: 41.
- Jobsites missing weather address: 40.
- Jobsites missing start or end date: 14.
- Jobsites missing project number: 3.
- Jobsites missing location: 2.
- Jobsites missing project manager: 2.
- Jobsites missing safety lead: 2.
- Weather-enabled jobsites missing NWS grid metadata: 0.

Platform and reference data:
- `approved_sources`: 0.
- `approved_knowledge`: 0.
- `research_queue`: 0.
- `knowledge_change_log`: 0.
- `library_documents`: 0.
- `library_categories`: 0.
- `osha_predictability_baselines`: 0.
- `platform_predictability_aggregates`: 0.
- `platform_sub_trades`: 0.
- `platform_trades`: 5.
- `platform_task_templates`: 5.
- `platform_permit_trigger_rules`: 4.
- `platform_conflict_rules`: 6.
- `platform_jurisdictions`: 6.
- `platform_jurisdiction_standards`: 12.
- `hr_document_templates`: 22.
- `time_card_roles`: 6.
- `time_card_categories`: 18.
- `time_card_tasks`: 56.

Storage posture:
- Buckets: `company-documents`, `documents`, `finance-receipts`, `library`, `profile-photos`, `sumissions`, `userdocs`.
- All buckets are private.
- All buckets are missing `file_size_limit`.
- All buckets are missing `allowed_mime_types`.
- `sumissions` appears to be a legacy typo bucket and needs object/policy review before removal or rename.
- `storage.objects` has overlapping authenticated policies, including generic `allow authenticated read` and `allow authenticated upload`.

Security posture:
- All public tables currently have RLS enabled.
- Security advisors still report `extension_in_public`, executable public `SECURITY DEFINER` functions, executable authenticated `SECURITY DEFINER` functions, and disabled leaked-password protection.
- Performance advisors still report unindexed foreign keys, multiple permissive policies, and absolute Auth DB connection allocation.

## Implemented Tooling

Run the aggregate readiness audit with:

```powershell
npm run db:data-readiness -- --target=staging
```

Production requires an explicit read-only acknowledgement:

```powershell
npm run db:data-readiness -- --target=production --allow-production-read
```

The command uses [supabase/readiness/data_readiness_audit.sql](../supabase/readiness/data_readiness_audit.sql), which returns only category, metric, count/value, status, and notes. It preflights expected app tables before running the full audit and refuses to treat production as staging.

## Cleanup Sequence

1. Bootstrap staging first.
   - Put the real staging database password in gitignored `.env.staging.local`.
   - Run `npm run db:staging:verify`.
   - Run `npm run db:staging:bootstrap` if the staging project is still empty.
   - Re-run `npm run db:staging:verify` and `npm run db:data-readiness -- --target=staging`.

2. Prove security cleanup on staging.
   - Revoke unintended `anon` execution from public `SECURITY DEFINER` functions.
   - Classify signed-in executable privileged RPCs as public RPC, policy helper, trigger helper, service-only RPC, or legacy.
   - Reduce `anon` and `authenticated` table grants to least privilege.
   - Keep RLS enabled on every exposed public table.
   - Re-run Supabase security and performance advisors after every migration.

3. Prove storage cleanup on staging.
   - Add bucket size and MIME limits.
   - Replace generic `storage.objects` policies with bucket-specific policies.
   - Inspect `sumissions` object count and callers before changing or removing it.
   - Verify upload, download, replace, and delete as company admin, member, unrelated company user, and unauthenticated user.

4. Backfill only safe data automatically.
   - Seed platform/reference data and sandbox/demo data through reviewed migrations or scripts.
   - Do not invent real customer safety records, incidents, training completions, billing payments, or emergency profiles.
   - For real companies and jobsites, create owner-facing missing-data checklists and require manual review.

5. Production cleanup comes after PR review.
   - No direct production SQL.
   - No production deployment from AI.
   - Super Admin approval is required before production-impacting migration, merge, or deployment.

## Manual Owner Review

Review in Supabase Dashboard:
- API exposure and grants for `anon` and `authenticated`.
- Auth leaked-password protection setting.
- Storage buckets, MIME allowlists, size limits, and policies.
- Staging migration history and table list after bootstrap.
- Empty or near-empty platform/reference tables.
- Owner/customer-ready gates before any customer-facing demo.

Review in the app on staging:
- Company setup.
- Jobsite setup and emergency action profile.
- JSA, permit, incident, corrective action, and report flows.
- Training matrix and employee training records.
- Document upload, preview, download, and marketplace/library access.
- Billing flows where enabled.
- Gus answers using approved sources and no invented safety requirements.

## References

- Supabase Data API exposure and explicit grants: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Supabase API security and RLS: https://supabase.com/docs/guides/api/securing-your-api
- Supabase RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Node.js 20 deprecation notice: https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20
