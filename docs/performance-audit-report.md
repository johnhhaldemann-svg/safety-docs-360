# SafetyDocs360 Performance Audit Report

## Baseline Findings (Before Fixes)

- Supabase telemetry access from MCP timed out during this run (`Connection terminated due to connection timeout`), so baseline evidence was captured from code-path analysis and endpoint behavior.
- `select("*")` was present across core list-heavy surfaces (workspace documents, admin review queues, admin dashboard, and multiple company module routes).
- Dashboard startup fan-out remained high on company-scoped sessions:
  - initial: `/api/auth/me`, `/api/workspace/documents`, `/api/library/credits`
  - follow-up: `/api/company/users`, `/api/company/jobsites`, `/api/company/observations`, `/api/company/daps`, `/api/company/permits`, `/api/company/incidents`, `/api/company/reports`, `/api/company/analytics/summary`
- No active Realtime subscriptions were detected in app code (`channel`, `postgres_changes`, `realtime` searches returned no matches).

## Implemented Changes

### 1) Query Shape + Pagination

- `app/api/workspace/documents/route.ts`
  - Replaced `select("*")` with explicit metadata projection.
  - Added server pagination via `page` and `pageSize` query params.
  - Added pagination metadata in response (`hasMore`, `returned`, `page`, `pageSize`).
- `app/(app)/library/page.tsx`
  - Switched to paginated requests (`/api/workspace/documents?page=...&pageSize=25`).
  - Added incremental loading (`Load more documents`) to avoid oversized first payload.
- `app/(app)/admin/review-documents/page.tsx`
  - Replaced `select("*")` with explicit fields.
  - Added paginated loading (`PAGE_SIZE = 50`) and `Load more records`.
- `app/(app)/admin/page.tsx`
  - Replaced `select("*")` with explicit fields.
  - Added bounded range for dashboard preview (`.range(0, 199)`).
- `app/api/admin/companies/route.ts`
  - Replaced `select("*")` with explicit company columns.
- `app/api/company/analytics/summary/route.ts`
  - Replaced snapshot table `select("*")` reads/writes with explicit columns.
- Additional document list pages switched from `select("*")` to projected metadata fields:
  - `app/(app)/purchases/page.tsx`
  - `app/(app)/upload/page.tsx`
  - `app/(app)/admin/archive/page.tsx`
  - `app/(app)/my-submissions/page.tsx`

### 2) Realtime Scope

- Confirmed no broad Realtime listeners were active in the app codebase during this audit pass.
- No removals required in this pass.

### 3) Metadata vs Heavy Payload Access

- Document list surfaces now consume metadata-focused fields from `/api/workspace/documents`.
- Large list pages no longer default to loading every row and every column in one call.

### 4) Index + Cache Improvements

- Added migration: `supabase/migrations/20260327102000_documents_perf_indexes.sql`
  - Adds defensive, conditional indexes for high-frequency filters/sorts on `documents` and company module tables.
- `app/api/company/analytics/summary/route.ts`
  - Added short-lived server-side cache (60s TTL) keyed by `(companyId, since)`.
  - Added cache headers and explicit cache invalidation on snapshot upsert.

## Expected Impact

- Smaller response payloads on library and admin list pages.
- Lower first-render query pressure from list-heavy pages due to pagination.
- Reduced repeated analytics recomputation load due to summary route caching.
- Better query plan options for high-frequency company/document filters once indexes are applied.

## Re-measure Snapshot (Code-Level)

- Realtime subscription search (`channel`, `postgres_changes`, `realtime`) still returns no active subscriptions in app code.
- `select("*")` usage is now removed from the updated high-traffic list/document pages and key summary/list APIs.
- Remaining `select("*")` calls are concentrated in company module routes and a few detail/admin endpoints, which are the next optimization candidates after this pass.

## Follow-up Validation Checklist

1. Run Supabase performance advisor and DB telemetry again once connectivity is stable.
2. Compare p95 latency for:
   - `/dashboard`
   - `/library`
   - `/admin`
   - `/admin/review-documents`
3. Confirm response payload reduction for `/api/workspace/documents` on first load.
4. Apply migration `20260327102000_documents_perf_indexes.sql` and re-check slow query list.
5. If dashboard remains high-latency, next step is to consolidate company module fan-out behind a single summary endpoint.
