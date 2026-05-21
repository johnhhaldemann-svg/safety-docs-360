begin;

create or replace function public.normalize_legacy_rbac_role(raw_role text)
returns text
language sql
immutable
as $$
  select case
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'superadmin' then 'super_admin'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'platformadmin' then 'platform_admin'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'internal_reviewer_employee' then 'internal_reviewer'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'operations_manager' then 'manager'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in ('safety_director', 'safety_director_safety_manager') then 'safety_manager'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in ('superintendent', 'superintendent_project_manager') then 'project_manager'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in ('field_user_observer', 'observer') then 'field_user'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'read_only_client' then 'read_only'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in (
      'platform_admin',
      'sales_demo',
      'internal_reviewer',
      'employee',
      'super_admin',
      'admin',
      'manager',
      'company_admin',
      'safety_manager',
      'project_manager',
      'field_supervisor',
      'foreman',
      'field_user',
      'read_only',
      'company_user',
      'editor',
      'viewer'
    ) then lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g'))
    else 'viewer'
  end;
$$;

revoke all on function public.normalize_legacy_rbac_role(text) from public;
grant execute on function public.normalize_legacy_rbac_role(text) to service_role;

with legacy_auth as (
  select
    au.id as user_id,
    coalesce(
      nullif(au.raw_app_meta_data ->> 'role', ''),
      nullif(au.raw_user_meta_data ->> 'role', '')
    ) as raw_role,
    coalesce(
      nullif(au.raw_app_meta_data ->> 'team', ''),
      nullif(au.raw_user_meta_data ->> 'team', '')
    ) as raw_team,
    coalesce(
      nullif(au.raw_app_meta_data ->> 'company_id', ''),
      nullif(au.raw_user_meta_data ->> 'company_id', '')
    ) as raw_company_id,
    coalesce(
      nullif(au.raw_app_meta_data ->> 'account_status', ''),
      nullif(au.raw_user_meta_data ->> 'account_status', '')
    ) as raw_account_status
  from auth.users au
),
normalized as (
  select
    la.user_id,
    public.normalize_legacy_rbac_role(la.raw_role) as role,
    coalesce(nullif(trim(la.raw_team), ''), 'General') as team,
    case
      when lower(trim(coalesce(la.raw_account_status, ''))) = 'pending' then 'pending'
      when lower(trim(coalesce(la.raw_account_status, ''))) = 'suspended' then 'suspended'
      else 'active'
    end as account_status,
    c.id as company_id,
    la.raw_role,
    la.raw_company_id
  from legacy_auth la
  left join public.companies c
    on c.id::text = nullif(trim(coalesce(la.raw_company_id, '')), '')
),
insertable as (
  select n.*
  from normalized n
  left join public.user_roles ur on ur.user_id = n.user_id
  where ur.user_id is null
    and (
      n.role <> 'viewer'
      or n.company_id is not null
      or nullif(trim(coalesce(n.raw_role, '')), '') is not null
      or nullif(trim(coalesce(n.raw_company_id, '')), '') is not null
    )
)
insert into public.user_roles (
  user_id,
  role,
  team,
  company_id,
  account_status,
  created_by,
  updated_by
)
select
  user_id,
  role,
  team,
  company_id,
  account_status,
  user_id,
  user_id
from insertable
on conflict (user_id) do nothing;

with legacy_company as (
  select
    ur.user_id,
    ur.company_id,
    ur.role,
    case
      when ur.account_status = 'pending' then 'pending'
      when ur.account_status = 'suspended' then 'suspended'
      else 'active'
    end as status,
    ur.created_by,
    ur.updated_by
  from public.user_roles ur
  where ur.company_id is not null
    and ur.role in (
      'company_admin',
      'manager',
      'safety_manager',
      'project_manager',
      'field_supervisor',
      'foreman',
      'field_user',
      'read_only',
      'company_user'
    )
)
insert into public.company_memberships (
  user_id,
  company_id,
  role,
  status,
  created_by,
  updated_by
)
select
  user_id,
  company_id,
  role,
  status,
  created_by,
  updated_by
from legacy_company
on conflict (user_id, company_id) do update
set
  role = excluded.role,
  status = excluded.status,
  updated_by = excluded.updated_by,
  updated_at = now();

create or replace view public.legacy_rbac_cutover_audit as
with legacy_auth as (
  select
    au.id as user_id,
    au.email,
    coalesce(
      nullif(au.raw_app_meta_data ->> 'role', ''),
      nullif(au.raw_user_meta_data ->> 'role', '')
    ) as raw_role,
    coalesce(
      nullif(au.raw_app_meta_data ->> 'company_id', ''),
      nullif(au.raw_user_meta_data ->> 'company_id', '')
    ) as raw_company_id,
    coalesce(
      nullif(au.raw_app_meta_data ->> 'account_status', ''),
      nullif(au.raw_user_meta_data ->> 'account_status', '')
    ) as raw_account_status
  from auth.users au
),
normalized as (
  select
    la.*,
    public.normalize_legacy_rbac_role(la.raw_role) as metadata_role,
    case
      when lower(trim(coalesce(la.raw_account_status, ''))) = 'pending' then 'pending'
      when lower(trim(coalesce(la.raw_account_status, ''))) = 'suspended' then 'suspended'
      else 'active'
    end as metadata_account_status
  from legacy_auth la
)
select
  n.user_id,
  n.email,
  n.raw_role,
  n.metadata_role,
  ur.role as canonical_role,
  n.raw_company_id,
  ur.company_id as canonical_company_id,
  cm.company_id as membership_company_id,
  n.metadata_account_status,
  ur.account_status as canonical_account_status,
  case
    when ur.user_id is null and (n.raw_role is not null or n.raw_company_id is not null) then 'missing_user_roles'
    when n.raw_company_id is not null and c.id is null then 'metadata_company_not_found'
    when ur.company_id is not null and cm.company_id is null and ur.role in (
      'company_admin',
      'manager',
      'safety_manager',
      'project_manager',
      'field_supervisor',
      'foreman',
      'field_user',
      'read_only',
      'company_user'
    ) then 'missing_company_membership'
    when n.raw_role is not null and public.normalize_legacy_rbac_role(n.raw_role) <> ur.role then 'metadata_role_differs_from_canonical'
    when n.raw_account_status is not null and n.metadata_account_status <> ur.account_status then 'metadata_status_differs_from_canonical'
    else 'ok'
  end as audit_status
from normalized n
left join public.user_roles ur on ur.user_id = n.user_id
left join public.companies c on c.id::text = n.raw_company_id
left join public.company_memberships cm
  on cm.user_id = n.user_id
 and cm.company_id = ur.company_id;

revoke all on public.legacy_rbac_cutover_audit from public;
revoke all on public.legacy_rbac_cutover_audit from anon;
revoke all on public.legacy_rbac_cutover_audit from authenticated;
grant select on public.legacy_rbac_cutover_audit to service_role;

comment on view public.legacy_rbac_cutover_audit is
  'Locked-down verification view for the legacy RBAC metadata cutover. Query with the service role before removing legacy compatibility objects.';

commit;
