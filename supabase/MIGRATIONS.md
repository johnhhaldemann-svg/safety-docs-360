# Supabase migrations — squash to a bootstrappable baseline

## Why this exists

The incremental migration history in `supabase/migrations/` **cannot bootstrap a fresh
database**. Root cause (confirmed against the live prod schema):

1. **43 tables are never created by any migration** — they are assumed to already exist.
   The earliest migration, `20260318000000_core_security_rls.sql`, runs
   `CREATE POLICY ... ON public.submissions` (and other tables) and references
   `public.is_admin_role()`, but no migration ever runs `CREATE TABLE public.submissions`.
   Orphaned tables include: `submissions`, `subscriptions`, `documents`, `profiles`, all
   `library_*`, `employee_time_*`, `company_finance_*`, `pshsep_*`, `company_jsas`, and more.
2. **Function-ordering bug** — `public.is_admin_role()` is used in migration #1 but not
   defined until `20260318000900_user_roles.sql` (migration #9).

Production works only because it still carries the original, un-tracked baseline schema.
A **fresh** database (Supabase preview branch, new staging, local `supabase db reset`)
fails on migration #1. This was verified: a created preview branch reached
`MIGRATIONS_FAILED` with 0 tables.

The fix is to **squash** the history into a single declarative baseline generated from the
current production schema, so any fresh database can be provisioned from one file.

Scope reference (prod schema as of 2026-06-04): 253 tables, 41 functions, 172 triggers,
24 enums, 3 sequences, 783 foreign keys, 690 RLS policies, 0 identity/generated columns.

## How to do it

### Prerequisites
- Supabase CLI (already a dev dependency — use `npx supabase`).
- The database password (Supabase Dashboard → project **safetydocs360** →
  **Project Settings → Database → Database password**; reset it there if unknown).

### Steps

```bash
# 1. Authenticate the CLI (interactive, one time).
npx supabase login

# 2. Generate the baseline + archive the incrementals.
#    The helper script links the project, runs `supabase db dump`, writes
#    supabase/migrations/00000000000000_baseline.sql, and moves the existing
#    incremental migrations into supabase/migrations_archive/.
node scripts/squash-migrations.mjs

# 3. Validate on a throwaway database before trusting it.
#    Either spin up a Supabase preview branch (must reach MIGRATIONS_PASSED, then delete),
#    or locally:  npx supabase db reset   (applies only the baseline; must succeed clean).
```

### 4. Reconcile production (do this LAST, with a human watching)

Production already has the 209 incremental migrations recorded in
`supabase_migrations.schema_migrations`. After squashing, the repo only contains the
baseline (`00000000000000`), which prod has **not** recorded — so a `db push` would try to
re-create existing objects. Mark the baseline as already-applied on prod so it is skipped:

```bash
npx supabase migration repair --status applied 00000000000000
```

> ⚠️ This touches production migration history. Run it deliberately, confirm with
> `npx supabase migration list`, and keep the archived incrementals until prod is verified.

### 5. Open the PR

Commit the new `00000000000000_baseline.sql`, the moved `migrations_archive/`, and this
doc. Note in the PR that the baseline was branch-validated to green.

## Notes
- The baseline must come from `pg_dump` (via `supabase db dump`) for full fidelity —
  constraints, indexes, RLS, triggers, grants, comments. Hand-reconstructing it from
  catalog queries is not reliable for a schema of this size.
- The RLS `auth_rls_initplan` fix (`20260604180000_…`) is already folded into the live
  prod schema, so it is captured by the dump automatically.
- `0 identity/generated columns` means no special-casing is needed in the dump.
