create or replace function public.admin_list_workspace_users()
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
    ur.role::text,
    coalesce(nullif(ur.team, ''), 'General')::text as team,
    case
      when coalesce(ur.account_status, 'active') = 'suspended' then 'Suspended'
      when au.email_confirmed_at is null then 'Pending'
      when au.last_sign_in_at is null then 'Active'
      when au.last_sign_in_at < now() - interval '30 days' then 'Inactive'
      else 'Active'
    end::text as status,
    au.created_at,
    au.last_sign_in_at,
    au.email_confirmed_at
  from auth.users au
  left join public.user_roles ur
    on ur.user_id = au.id
  where public.is_admin_role();
$$;

revoke all on function public.admin_list_workspace_users() from public;
grant execute on function public.admin_list_workspace_users() to authenticated;
