-- Harden multi-tenant boundaries: companies RLS, compat views (invoker),
-- remove permissive UPDATE policies, tighten signup insert checks, library read policies,
-- and fix mutable search_path on security helpers.

-- ---------------------------------------------------------------------------
-- 1) Security helper functions: immutable search_path (Supabase linter)
-- ---------------------------------------------------------------------------
create or replace function public.security_is_company_member(target_company_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
    )
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
    );
$$;

create or replace function public.security_is_company_manager(target_company_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'platform_admin',
          'super_admin',
          'admin',
          'company_admin',
          'manager',
          'safety_manager'
        )
    );
$$;

create or replace function public.security_can_write_company_data(target_company_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'platform_admin',
          'super_admin',
          'admin',
          'company_admin',
          'manager',
          'safety_manager',
          'project_manager',
          'foreman',
          'field_user',
          'internal_reviewer',
          'employee',
          'company_user',
          'editor'
        )
    );
$$;

create or replace function public.security_has_jobsite_access(target_company_id uuid, target_jobsite_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select
    target_jobsite_id is null
    or public.security_is_company_manager(target_company_id)
    or exists (
      select 1
      from public.company_jobsite_assignments cja
      where cja.user_id = auth.uid()
        and cja.company_id = target_company_id
        and cja.jobsite_id = target_jobsite_id
    );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) companies: RLS (table uses id, not company_id — was skipped by bulk migration)
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;

drop policy if exists companies_select_scope on public.companies;
create policy companies_select_scope
on public.companies
for select
to authenticated
using (public.is_admin_role() or public.security_is_company_member(id));

-- Direct client inserts are blocked; workspace creation uses SECURITY DEFINER RPCs.
drop policy if exists companies_insert_platform_admin on public.companies;
create policy companies_insert_platform_admin
on public.companies
for insert
to authenticated
with check (public.is_admin_role());

drop policy if exists companies_update_scope on public.companies;
create policy companies_update_scope
on public.companies
for update
to authenticated
using (public.is_admin_role() or public.security_is_company_manager(id))
with check (public.is_admin_role() or public.security_is_company_manager(id));

drop policy if exists companies_delete_scope on public.companies;
create policy companies_delete_scope
on public.companies
for delete
to authenticated
using (public.is_admin_role() or public.security_is_company_manager(id));

revoke all on table public.companies from anon;

-- ---------------------------------------------------------------------------
-- 3) Compatibility views: enforce invoker RLS (Postgres 15+)
-- ---------------------------------------------------------------------------
do $$
declare
  vname text;
begin
  foreach vname in array[
    'compat_company_users',
    'compat_company_jobsites',
    'compat_company_daps',
    'compat_company_observations',
    'compat_company_corrective_actions',
    'compat_company_permits',
    'compat_company_incidents',
    'compat_company_reports',
    'compat_company_documents'
  ]
  loop
    if exists (
      select 1 from pg_views where schemaname = 'public' and viewname = vname
    ) then
      execute format(
        'alter view public.%I set (security_invoker = true)',
        vname
      );
    end if;
  end loop;
end
$$;

do $$
declare
  vname text;
begin
  foreach vname in array[
    'compat_company_users',
    'compat_company_jobsites',
    'compat_company_daps',
    'compat_company_observations',
    'compat_company_corrective_actions',
    'compat_company_permits',
    'compat_company_incidents',
    'compat_company_reports',
    'compat_company_documents'
  ]
  loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = vname
    ) then
      execute format('revoke all on table public.%I from anon', vname);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 4) submissions: drop permissive "for now" updates; restore scoped policies
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated can update submissions for now" on public.submissions;

drop policy if exists submissions_select_own_or_admin on public.submissions;
create policy submissions_select_own_or_admin
on public.submissions
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_role());

drop policy if exists submissions_insert_own_or_admin on public.submissions;
create policy submissions_insert_own_or_admin
on public.submissions
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin_role());

drop policy if exists submissions_update_own_or_admin on public.submissions;
create policy submissions_update_own_or_admin
on public.submissions
for update
to authenticated
using (auth.uid() = user_id or public.is_admin_role())
with check (auth.uid() = user_id or public.is_admin_role());

-- ---------------------------------------------------------------------------
-- 5) peshep_submissions: same model as submissions (has user_id), if table exists
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'peshep_submissions'
  ) then
    execute 'drop policy if exists "authenticated can update peshep submissions for now" on public.peshep_submissions';
    execute 'drop policy if exists peshep_submissions_select_own_or_admin on public.peshep_submissions';
    execute $p$
      create policy peshep_submissions_select_own_or_admin
      on public.peshep_submissions
      for select
      to authenticated
      using (auth.uid() = user_id or public.is_admin_role())
    $p$;
    execute 'drop policy if exists peshep_submissions_insert_own_or_admin on public.peshep_submissions';
    execute $p$
      create policy peshep_submissions_insert_own_or_admin
      on public.peshep_submissions
      for insert
      to authenticated
      with check (auth.uid() = user_id or public.is_admin_role())
    $p$;
    execute 'drop policy if exists peshep_submissions_update_own_or_admin on public.peshep_submissions';
    execute $p$
      create policy peshep_submissions_update_own_or_admin
      on public.peshep_submissions
      for update
      to authenticated
      using (auth.uid() = user_id or public.is_admin_role())
      with check (auth.uid() = user_id or public.is_admin_role())
    $p$;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 6) company_signup_requests: replace wide-open insert with basic validation
-- ---------------------------------------------------------------------------
drop policy if exists company_signup_requests_public_insert on public.company_signup_requests;
drop policy if exists "company_signup_requests_public_insert" on public.company_signup_requests;
create policy company_signup_requests_public_insert
on public.company_signup_requests
for insert
to anon, authenticated
with check (
  length(trim(company_name)) > 0
  and length(trim(primary_contact_email)) > 0
  and length(trim(primary_contact_name)) > 0
  and coalesce(status, 'pending') = 'pending'
);

-- ---------------------------------------------------------------------------
-- 7) Library reference tables: RLS enabled but missing policies
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'library_categories'
  ) then
    execute 'drop policy if exists library_categories_select_authenticated on public.library_categories';
    execute $p$
      create policy library_categories_select_authenticated
      on public.library_categories
      for select
      to authenticated
      using (true)
    $p$;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'library_tags'
  ) then
    execute 'drop policy if exists library_tags_select_authenticated on public.library_tags';
    execute $p$
      create policy library_tags_select_authenticated
      on public.library_tags
      for select
      to authenticated
      using (true)
    $p$;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'library_document_tags'
  ) then
    execute 'drop policy if exists library_document_tags_select_authenticated on public.library_document_tags';
    execute $p$
      create policy library_document_tags_select_authenticated
      on public.library_document_tags
      for select
      to authenticated
      using (true)
    $p$;
  end if;
end
$$;
