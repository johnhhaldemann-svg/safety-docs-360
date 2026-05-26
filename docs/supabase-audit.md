# Supabase Production Audit

Audit date: May 26, 2026
Project: `safetydocs360`
Project ref: `mdqkfbnwxrasdmbsjcqv`
Scope: read-only production audit of Supabase security, storage, RLS, multi-tenant isolation signals, performance advisors, and runtime/config posture.

## Executive Summary

Production is healthy and several core safety controls are in place: every public table has RLS enabled, deployed Supabase Edge Functions are empty, the Supabase Realtime publication has no tables, public compatibility views are mostly `security_invoker`, and storage buckets are private.

The audit still found high-value hardening work before a broader pilot or production rollout. The most important items are direct execution access to public-schema `SECURITY DEFINER` functions, very broad `anon` and `authenticated` table grants across the public schema, authorization fallbacks that still consult user-editable `user_metadata`, broad/overlapping storage policies, and Node.js 20 runtime drift against Supabase's announced JavaScript client support window.

No database changes were made. Findings below are evidence-backed and intended to become follow-up remediation migrations or code tasks.

## Findings

| Severity | Area | Evidence | Risk | Recommended fix | Verification |
| --- | --- | --- | --- | --- | --- |
| High | Public executable privileged RPCs | Supabase security advisor reports 4 `anon_security_definer_function_executable` warnings. Read-only metadata confirms `anon` can execute `consume_company_invite`, `match_approved_knowledge`, `security_can_approve_gus_learning`, and `security_can_review_gus_learning`. | `SECURITY DEFINER` functions run with elevated privileges. Public execution creates a narrow but serious bypass path if function arguments, policy checks, or data filters are incomplete. | Revoke `EXECUTE` from `public` and `anon` for these functions unless anonymous access is explicitly required. Move policy helper functions into a private/unexposed schema where practical. Keep explicit `set search_path`. | Re-run Supabase security advisors and confirm no lint `0028_anon_security_definer_function_executable` remains. Add RPC-level tests for unauthenticated requests returning 401/403. |
| High | Broad public Data API grants | Metadata shows public tables with direct grants: `anon` has `select` on 215 tables, `insert` on 213, `update` on 215, and `delete` on 215; `authenticated` has `select` on 222, `insert` on 210, `update` on 212, and `delete` on 212. All 229 public tables have RLS enabled. | RLS is the main row guard, but broad grants expose a large API surface and increase blast radius if any policy is permissive, later altered, or created incorrectly. This also conflicts with Supabase's 2026 Data API direction toward explicit grants. | Convert to least-privilege table grants. Revoke broad `anon` grants first, grant only public insert/read surfaces intentionally needed, and keep `authenticated` grants aligned to actual client access. Preserve service-role/admin server access separately. | Query `has_table_privilege` counts after migration. Exercise login, document, company, training, billing, and public signup flows against staging. |
| High | User-editable metadata used as authorization fallback | `app/api/library/credits/route.ts` falls back to `user.user_metadata.credit_balance` and `user_metadata.purchased_document_ids` when ledger reads fail. `app/api/library/access/[id]/route.ts`, `app/api/library/workspace-excerpt/[id]/route.ts`, and `app/api/workspace/documents/route.ts` also fall back to `purchased_document_ids`. | Supabase user metadata is user-editable. If ledger reads fail or are blocked, purchased-document access and credit balances can be influenced by claims that should not authorize purchases. | Remove purchase/credit authorization fallbacks from `user_metadata`. Treat failed ledger reads as fail-closed or use server-side transaction tables via a carefully scoped service role after membership checks. Keep display-only profile metadata separate from authorization state. | Add tests where `user_metadata.purchased_document_ids` is set but no ledger/company purchase exists; access must be denied. Add tests for ledger read failure behavior. |
| Medium | Authenticated users can execute many public `SECURITY DEFINER` helpers | Supabase security advisor reports `authenticated_security_definer_function_executable`. Metadata confirms 31 public security-definer functions total, 20 executable by `authenticated`; all have explicit search path. | Some functions are legitimate RLS helpers, but direct REST RPC access from signed-in users expands privileged callable surface beyond policy evaluation. | Classify each function as public RPC, policy-only helper, trigger-only helper, or service-only RPC. Revoke direct `authenticated` execute for policy-only/service-only helpers and move helpers to a private schema. | Re-run advisors for lint `0029_authenticated_security_definer_function_executable`. Confirm app paths that call intentional RPCs still work. |
| Medium | Storage policies are broad and overlapping | All 7 buckets are private, but bucket limits and MIME allowlists are null. `storage.objects` has 27 authenticated policies, including generic names such as `allow authenticated read`, `allow authenticated upload`, and older documents-bucket admin/scope policies. | Private buckets help, but broad authenticated object policies can permit object listing, upload, replacement, or deletion outside intended company/jobsite prefixes if any predicate is too loose. Lack of file limits/MIME controls raises abuse and malware risk. | Remove generic storage policies after validating current predicates. Keep bucket-specific policies with company/jobsite path checks. Add bucket file-size and MIME restrictions for documents, receipts, profile photos, site visuals, and uploads. | Query `pg_policies` for storage after cleanup. Test upload/read/delete as company admin, member, unrelated company user, and unauthenticated user. |
| Medium | `vector` extension installed in `public` | Supabase security advisor lint `extension_in_public` and metadata show extension `vector` in schema `public`; other extensions are in `extensions`, `vault`, or `pg_catalog`. | Extensions in exposed schemas increase namespace and function exposure risk. Moving vector later is harder because functions and columns reference `public.vector`/`vector`. | Plan a staged migration to install/use `vector` in `extensions` or another non-exposed schema, then update function signatures and column references such as `match_approved_knowledge` and `match_company_memory_items`. | Advisor lint `0014_extension_in_public` clears; vector search tests continue to pass. |
| Medium | Leaked password protection disabled | Supabase security advisor reports `auth_leaked_password_protection`. | Users can choose passwords known to be compromised, increasing account takeover risk. | Enable leaked password protection in Supabase Auth settings. Consider increasing password requirements and enabling MFA for admin/superadmin users. | Re-run security advisors. Attempt account creation/password change with a known compromised test password in staging and confirm rejection. |
| Medium | Runtime pinned to Node.js 20 | `package.json` has `"node": "20.x"` and `.nvmrc` has `20.19.0`. Supabase announced support for Node.js 20 in its JavaScript packages ends June 30, 2026. | Future `@supabase/supabase-js`/auth/storage updates may stop supporting the runtime, and Node 20 has reached end-of-life upstream. | Move local, Vercel, and CI runtime to Node.js 22 LTS. Update `.nvmrc`, `package.json` engines, deployment settings, and lockfile under a dedicated runtime upgrade task. | Run install, lint, typecheck, tests, and build under Node 22. Verify Vercel deployment runtime. |
| Medium | Performance advisor backlog on FKs and RLS policies | Supabase performance advisors report `unindexed_foreign_keys`, `multiple_permissive_policies`, and `auth_db_connections_absolute`. Examples include unindexed FKs on `approved_knowledge`, `approved_sources`, `companies`, `company_analytics_snapshots`, `company_audit_customers`, `company_auditflow_*`, and duplicate permissive policies on `documents`, `document_downloads`, employee time-card tables, and `user_submissions`. | FK checks and deletes can slow down as data grows. Multiple permissive policies create extra policy evaluation work on hot tables, especially dashboard/document/training flows. | Batch-add covering indexes for hot FK columns first. Consolidate duplicate policies where behavior is identical. Switch Auth DB connection allocation from fixed count to percentage when appropriate for scaling. | Re-run performance advisors. Check query plans for document, auditflow, training, and dashboard routes before/after indexes. |
| Low | Legacy service-role typo still accepted | `lib/supabaseAdmin.ts` reads `SUPABASE_SERIVCE_ROLE_KEY` as a legacy fallback; `.env.example` documents the typo as still supported. | Operational drift can leave the real secret under multiple names, making rotation and incident response more error-prone. | Inventory Vercel/project env vars, move everything to `SUPABASE_SERVICE_ROLE_KEY`, then remove the typo fallback after a deprecation window. | System health scan still sees the service role after cleanup. Search repo/env documentation for `SUPABASE_SERIVCE_ROLE_KEY`. |
| Low | Views are mostly hardened, but one legacy view should remain restricted | Metadata shows 11 public compatibility views with `security_invoker = true` and `anon`/`authenticated` select grants. `legacy_rbac_cutover_audit` is not security invoker but has no `anon` or `authenticated` select grant. | Current posture is acceptable. The legacy audit view would become risky if grants are accidentally reintroduced because non-invoker views can bypass underlying RLS. | Keep `legacy_rbac_cutover_audit` service-role only or move it to a private schema. Add a regression query to ensure no `anon`/`authenticated` grants are added. | Query public views for `security_invoker=false` plus `anon`/`authenticated` access; expected result should be empty. |

## Fix Now / Fix Next / Monitor

Fix now:
- Revoke anonymous execution from the 4 public `SECURITY DEFINER` functions, especially the Gus learning approval/review checks and vector match RPC.
- Remove authorization fallbacks that trust `user_metadata` for credits and purchased document access.
- Start least-privilege cleanup of broad `anon` table grants, beginning with private company, billing, document, training, safety intelligence, and admin tables.
- Enable leaked password protection.

Fix next:
- Classify and relocate/revoke public authenticated `SECURITY DEFINER` functions.
- Tighten storage policies and add bucket file-size/MIME limits.
- Upgrade runtime from Node.js 20 to Node.js 22 LTS.
- Add indexes for high-traffic unindexed foreign keys and consolidate duplicate RLS policies on hot tables.

Monitor:
- Keep RLS coverage at 100 percent for exposed schemas.
- Keep Realtime publication empty unless a specific realtime feature is reviewed for RLS and tenant isolation.
- Keep Edge Functions empty or audit secrets/auth if functions are added.
- Re-run advisors after every migration and before pilot cutovers.

## Appendix A - Read-Only Metadata Snapshot

Production database:
- Project ref: `mdqkfbnwxrasdmbsjcqv`
- Postgres engine: 17
- Supabase Edge Functions: none deployed
- Local migration count: 187
- Latest local migration: `20260526173110_training_requirement_resources.sql`

RLS:
- Public tables: 229
- RLS enabled: 229
- RLS disabled: 0
- RLS forced: 0

Data API grants:
- `anon`: select 215, insert 213, update 215, delete 215 public tables.
- `authenticated`: select 222, insert 210, update 212, delete 212 public tables.

Public views:
- `company_dap_activities`, `company_daps`, and 9 `compat_company_*` views are `security_invoker = true` and selectable by `anon`/`authenticated`.
- `legacy_rbac_cutover_audit` is not `security_invoker`, but `anon_select=false` and `authenticated_select=false`.

Security-definer functions:
- Public `SECURITY DEFINER` functions: 31
- Executable by `anon`: 4
- Executable by `authenticated`: 20
- Missing explicit search path: 0

Storage:
- Buckets: `company-documents`, `documents`, `finance-receipts`, `library`, `profile-photos`, `sumissions`, `userdocs`.
- All listed buckets are private.
- All listed buckets have null `file_size_limit`.
- All listed buckets have null `allowed_mime_types`.
- `storage.objects` policies: 27 authenticated policies.

Extensions:
- `pg_stat_statements` in `extensions`
- `pgcrypto` in `extensions`
- `plpgsql` in `pg_catalog`
- `supabase_vault` in `vault`
- `uuid-ossp` in `extensions`
- `vector` in `public`

Realtime:
- `supabase_realtime` publication tables: none.

## Appendix B - Advisor Categories

Security advisors:
- `extension_in_public`: `vector` installed in `public`.
- `anon_security_definer_function_executable`: 4 public executable privileged functions.
- `authenticated_security_definer_function_executable`: 20 signed-in executable privileged functions.
- `auth_leaked_password_protection`: disabled.

Performance advisors:
- `unindexed_foreign_keys`: many foreign key constraints lack covering indexes.
- `multiple_permissive_policies`: duplicate permissive policies exist on hot tables such as `documents`, `document_downloads`, employee time-card tables, and `user_submissions`.
- `auth_db_connections_absolute`: Auth is configured with an absolute DB connection count rather than a percentage strategy.

## Appendix C - References

- Supabase RLS, views, `security_invoker`, JWT metadata, and security-definer guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database linter: https://supabase.com/docs/guides/database/database-linter
- Supabase password security: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Supabase Data API exposure change: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Supabase changelog with Node.js 20 deprecation notice: https://supabase.com/changelog

## Commands And Checks Run

- `git status --short`
- Read `package.json`, `.nvmrc`, `supabase/config.toml`, `.env.example`, and selected Supabase/API source files.
- `rg` searches for Supabase keys, service role usage, storage signed URL usage, `user_metadata` purchase/credit fallbacks, views, and storage policies.
- Supabase MCP `_get_advisors` for security.
- Supabase MCP `_get_advisors` for performance.
- Supabase MCP `_execute_sql` read-only metadata query for RLS, grants, views, functions, storage, extensions, and Realtime.
- Supabase MCP `_list_edge_functions`.

No lint/typecheck/build was run because this task added a Markdown audit report only and did not change application or schema behavior.
