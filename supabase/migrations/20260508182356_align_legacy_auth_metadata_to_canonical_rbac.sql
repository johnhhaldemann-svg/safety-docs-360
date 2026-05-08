with stale_legacy_metadata as (
  select
    audit.user_id,
    ur.role,
    coalesce(nullif(ur.team, ''), 'General') as team,
    ur.company_id,
    ur.account_status
  from public.legacy_rbac_cutover_audit audit
  join public.user_roles ur on ur.user_id = audit.user_id
  where audit.audit_status in (
    'metadata_role_differs_from_canonical',
    'metadata_status_differs_from_canonical'
  )
)
update auth.users au
set raw_app_meta_data = jsonb_strip_nulls(
  coalesce(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'role', stale.role,
    'team', stale.team,
    'company_id', stale.company_id,
    'account_status', stale.account_status
  )
)
from stale_legacy_metadata stale
where au.id = stale.user_id;
