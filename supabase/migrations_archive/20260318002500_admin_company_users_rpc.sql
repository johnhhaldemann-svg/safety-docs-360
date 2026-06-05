create or replace function public.admin_list_company_users(target_company_id uuid)
returns table (
  id uuid,
  email text,
  name text,
  role text,
  team text,
  status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    au.id,
    au.email::text,
    coalesce(
      nullif(au.raw_user_meta_data ->> 'full_name', ''),
      nullif(au.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(au.email, ''), '@', 1)
    )::text as name,
    coalesce(cm.role, ur.role, 'company_user')::text as role,
    coalesce(nullif(ur.team, ''), nullif(c.name, ''), 'General')::text as team,
    case
      when coalesce(cm.status, ur.account_status, 'active') = 'suspended' then 'Suspended'
      when coalesce(cm.status, ur.account_status, 'active') = 'pending' then 'Pending'
      when au.email_confirmed_at is null then 'Pending'
      when au.last_sign_in_at is null then 'Active'
      when au.last_sign_in_at < now() - interval '30 days' then 'Inactive'
      else 'Active'
    end::text as status,
    au.created_at,
    au.last_sign_in_at,
    au.email_confirmed_at
  from public.company_memberships cm
  join auth.users au
    on au.id = cm.user_id
  left join public.user_roles ur
    on ur.user_id = cm.user_id
  left join public.companies c
    on c.id = cm.company_id
  where cm.company_id = target_company_id
    and public.is_admin_role();
$$;

revoke all on function public.admin_list_company_users(uuid) from public;
grant execute on function public.admin_list_company_users(uuid) to authenticated;
