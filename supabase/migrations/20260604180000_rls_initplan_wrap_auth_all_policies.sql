-- Complete the RLS auth-initplan fix across ALL public policies.
--
-- Supabase's performance linter flags policies whose USING / WITH CHECK call
-- `auth.uid()` / `auth.role()` / `auth.jwt()` / `auth.email()` directly, because
-- Postgres re-evaluates them once per row. Wrapping each call in a scalar subquery
-- `(select auth.uid())` lets the planner evaluate it once (InitPlan), which removes
-- the `auth_rls_initplan` warning and improves RLS performance at scale.
--
-- A prior migration (20260603131958_rls_auth_uid_initplan_fix.sql) only covered some
-- policies; a live advisor run on 2026-06-04 showed 138 policies across 65 tables
-- still flagged. This migration rewrites every remaining public policy programmatically.
--
-- The transform is semantics-preserving: `(select auth.uid())` returns the same value
-- as `auth.uid()`. It is idempotent — already-wrapped calls are protected by placeholder
-- substitution before bare calls are wrapped, and only policies whose expression actually
-- changes are altered, so re-running this migration is a no-op.
--
-- NOTE (not addressed here): the linter also reports 45 `multiple_permissive_policies`
-- warnings. Consolidating overlapping permissive policies changes access semantics and
-- must be done per-table by hand with review; it is intentionally out of scope for this
-- mechanical, semantics-preserving migration.

do $$
declare
  r record;
  nq text;
  nc text;
  ddl text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    -- Protect already-wrapped calls (deparsed form "( SELECT auth.uid() AS uid)") with
    -- placeholders, wrap remaining bare calls, then restore. Applied to USING (qual)...
    nq := r.qual;
    if nq is not null then
      nq := regexp_replace(nq, '\(\s*SELECT\s+auth\.uid\(\)[^)]*\)',   '@@UID@@',   'gi');
      nq := regexp_replace(nq, '\(\s*SELECT\s+auth\.role\(\)[^)]*\)',  '@@ROLE@@',  'gi');
      nq := regexp_replace(nq, '\(\s*SELECT\s+auth\.jwt\(\)[^)]*\)',   '@@JWT@@',   'gi');
      nq := regexp_replace(nq, '\(\s*SELECT\s+auth\.email\(\)[^)]*\)', '@@EMAIL@@', 'gi');
      nq := regexp_replace(nq, 'auth\.uid\(\)',   '(select auth.uid())',   'gi');
      nq := regexp_replace(nq, 'auth\.role\(\)',  '(select auth.role())',  'gi');
      nq := regexp_replace(nq, 'auth\.jwt\(\)',   '(select auth.jwt())',   'gi');
      nq := regexp_replace(nq, 'auth\.email\(\)', '(select auth.email())', 'gi');
      nq := replace(nq, '@@UID@@',   '(select auth.uid())');
      nq := replace(nq, '@@ROLE@@',  '(select auth.role())');
      nq := replace(nq, '@@JWT@@',   '(select auth.jwt())');
      nq := replace(nq, '@@EMAIL@@', '(select auth.email())');
    end if;

    -- ...and to WITH CHECK (with_check).
    nc := r.with_check;
    if nc is not null then
      nc := regexp_replace(nc, '\(\s*SELECT\s+auth\.uid\(\)[^)]*\)',   '@@UID@@',   'gi');
      nc := regexp_replace(nc, '\(\s*SELECT\s+auth\.role\(\)[^)]*\)',  '@@ROLE@@',  'gi');
      nc := regexp_replace(nc, '\(\s*SELECT\s+auth\.jwt\(\)[^)]*\)',   '@@JWT@@',   'gi');
      nc := regexp_replace(nc, '\(\s*SELECT\s+auth\.email\(\)[^)]*\)', '@@EMAIL@@', 'gi');
      nc := regexp_replace(nc, 'auth\.uid\(\)',   '(select auth.uid())',   'gi');
      nc := regexp_replace(nc, 'auth\.role\(\)',  '(select auth.role())',  'gi');
      nc := regexp_replace(nc, 'auth\.jwt\(\)',   '(select auth.jwt())',   'gi');
      nc := regexp_replace(nc, 'auth\.email\(\)', '(select auth.email())', 'gi');
      nc := replace(nc, '@@UID@@',   '(select auth.uid())');
      nc := replace(nc, '@@ROLE@@',  '(select auth.role())');
      nc := replace(nc, '@@JWT@@',   '(select auth.jwt())');
      nc := replace(nc, '@@EMAIL@@', '(select auth.email())');
    end if;

    -- Only alter policies whose expression actually changed (idempotent).
    if (r.qual is distinct from nq) or (r.with_check is distinct from nc) then
      ddl := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if r.qual is not null then
        ddl := ddl || format(' using (%s)', nq);
      end if;
      if r.with_check is not null then
        ddl := ddl || format(' with check (%s)', nc);
      end if;
      execute ddl;
      raise notice 'rewrote RLS policy %.% : %', r.tablename, r.policyname, r.policyname;
    end if;
  end loop;
end $$;
