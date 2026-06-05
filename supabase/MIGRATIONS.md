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
- **Two schemas are dumped: `public` and `private`.** `public` holds the app tables and
  policies; `private` holds SECURITY DEFINER trigger functions that public triggers call.
  Dumping `public` alone leaves those triggers pointing at a non-existent `private` schema,
  so a fresh DB fails (`schema "private" does not exist`). The squash script passes
  `--schema public,private`.
- **`CREATE EXTENSION` is re-added by the script.** `supabase db dump` omits extension
  creation (extensions live in the `extensions` schema, outside the dumped schemas), but
  the schema references `"extensions"."vector"` (pgvector). The script injects
  `pgcrypto` + `vector` into the baseline preamble; without them a fresh DB fails with
  `type extensions.vector does not exist`.
- The RLS `auth_rls_initplan` fix (`20260604180000_…`) is already folded into the live
  prod schema, so it is captured by the dump automatically. (Auth calls are encapsulated
  in stable helper functions — `is_admin_role()`, `security_is_company_member()`, etc. —
  rather than inlined per policy, which is what satisfies the initplan advisor.)
- `0 identity/generated columns` means no special-casing is needed in the dump.

## Validation status (2026-06-05)
Baseline generated from prod and **validated green** on a fresh local database via
`npx supabase start` (which applies only `00000000000000_baseline.sql`). The bootstrapped
DB matched prod scope exactly: **253 public tables, 690 RLS policies, 41 functions**, the
`private` trigger functions, and the `vector` extension. The 209 incremental migrations are
archived under `supabase/migrations_archive/`.

**Still pending (run deliberately, with review):** the production reconcile —
`npx supabase migration repair --status applied 00000000000000` — so prod skips re-applying
the baseline it already effectively has. See step 4 above.
