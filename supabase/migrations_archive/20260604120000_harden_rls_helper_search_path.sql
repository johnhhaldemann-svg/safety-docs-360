-- Pin search_path on three RLS predicate helpers that were missing it.
-- security_is_company_member already has `security definer set search_path = public`;
-- these three must match so a rogue search_path cannot redirect table lookups.

create or replace function public.security_is_company_manager(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
security definer
set search_path = public
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
security definer
set search_path = public
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
