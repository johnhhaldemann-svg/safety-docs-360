# Backup / Disaster Recovery Summary

| Claim | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Application source is versioned in GitHub. | Verified | [.github/workflows](../../.github/workflows), repository history | Confirm branch protection and backup owner. |
| Deployments are intended to run through Vercel. | Partial | [vercel.json](../../vercel.json), package scripts in [package.json](../../package.json) | Need Vercel project backup/rollback screenshots. |
| Primary data is in Supabase Postgres. | Verified | [Supabase migrations](../../supabase/migrations) | Need hosted backup schedule, PITR status, and restore test evidence. |
| Uploaded/generated files use Supabase Storage. | Partial | [storage server helper](../../lib/supabaseStorageServer.ts), signed URL routes | Need bucket versioning/retention/deletion policy confirmation. |
| Restore objectives are not yet formally approved. | Needs Confirmation | None | Define RPO/RTO, restoration owner, and annual restore test cadence. |

Do not claim a tested DR program until a staging restore or documented provider restore validation has been completed.

