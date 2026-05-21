-- security_is_company_member reads company_memberships while RLS on that table
-- calls the same helper, causing infinite recursion ("stack depth limit exceeded")
-- for any policy that scans memberships (e.g. company_training_requirements).
-- Run as definer so the membership lookup bypasses RLS, matching is_admin_role().
create or replace function public.security_is_company_member(target_company_id uuid)
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
    )
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
    );
$$;

grant execute on function public.security_is_company_member(uuid) to authenticated;
