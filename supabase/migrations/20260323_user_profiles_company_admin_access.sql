drop policy if exists "user_profiles_select_self_or_admin" on public.user_profiles;
create policy "user_profiles_select_self_or_admin"
on public.user_profiles
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    join public.company_memberships target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and target.user_id = public.user_profiles.user_id
  )
  or exists (
    select 1
    from public.user_roles actor
    join public.user_roles target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and actor.company_id is not null
      and target.user_id = public.user_profiles.user_id
  )
);

drop policy if exists "user_profiles_insert_self" on public.user_profiles;
create policy "user_profiles_insert_self"
on public.user_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    join public.company_memberships target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and target.user_id = public.user_profiles.user_id
  )
  or exists (
    select 1
    from public.user_roles actor
    join public.user_roles target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and actor.company_id is not null
      and target.user_id = public.user_profiles.user_id
  )
);

drop policy if exists "user_profiles_update_self" on public.user_profiles;
create policy "user_profiles_update_self"
on public.user_profiles
for update
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    join public.company_memberships target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and target.user_id = public.user_profiles.user_id
  )
  or exists (
    select 1
    from public.user_roles actor
    join public.user_roles target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and actor.company_id is not null
      and target.user_id = public.user_profiles.user_id
  )
)
with check (
  auth.uid() = user_id
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    join public.company_memberships target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and target.user_id = public.user_profiles.user_id
  )
  or exists (
    select 1
    from public.user_roles actor
    join public.user_roles target on target.company_id = actor.company_id
    where actor.user_id = auth.uid()
      and actor.role = 'company_admin'
      and actor.company_id is not null
      and target.user_id = public.user_profiles.user_id
  )
);
