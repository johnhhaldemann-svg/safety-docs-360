-- Mutate policies on company_training_requirements only looked at company_memberships.role.
-- The app authorizes from user_roles (and permissions); membership can lag or disagree, causing
-- "new row violates row-level security policy" while the API returns 200 intent to save.
-- Also allow legacy membership role strings that normalize to manager/safety_manager in the app.
create or replace function public.security_can_mutate_company_training_requirements(target_company_id uuid)
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
      from public.company_memberships m
      where m.company_id = target_company_id
        and m.user_id = auth.uid()
        and coalesce(m.status, '') = 'active'
        and coalesce(m.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'operations_manager',
          'safety_director',
          'safety_director_safety_manager'
        )
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and coalesce(ur.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'platform_admin',
          'super_admin',
          'admin'
        )
    );
$$;

grant execute on function public.security_can_mutate_company_training_requirements(uuid) to authenticated;

drop policy if exists "company_training_requirements_insert_lead" on public.company_training_requirements;
create policy "company_training_requirements_insert_lead"
on public.company_training_requirements
for insert
to authenticated
with check (public.security_can_mutate_company_training_requirements(company_id));

drop policy if exists "company_training_requirements_update_lead" on public.company_training_requirements;
create policy "company_training_requirements_update_lead"
on public.company_training_requirements
for update
to authenticated
using (public.security_can_mutate_company_training_requirements(company_id))
with check (public.security_can_mutate_company_training_requirements(company_id));

drop policy if exists "company_training_requirements_delete_lead" on public.company_training_requirements;
create policy "company_training_requirements_delete_lead"
on public.company_training_requirements
for delete
to authenticated
using (public.security_can_mutate_company_training_requirements(company_id));
