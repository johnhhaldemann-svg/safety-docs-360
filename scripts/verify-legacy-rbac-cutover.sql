-- Run with a privileged database connection after applying
-- 20260508182109_legacy_rbac_data_cutover.sql.
--
-- Expected cutover result:
-- - audit_status = ok for all rows, except explicitly waived historical metadata drift.
-- - canonical operational tables have rows at least equal to their compatibility projections.

select
  audit_status,
  count(*) as users
from public.legacy_rbac_cutover_audit
group by audit_status
order by audit_status;

select *
from public.legacy_rbac_cutover_audit
where audit_status <> 'ok'
order by audit_status, email nulls last;

select
  (select count(*) from public.user_roles) as user_roles,
  (select count(*) from public.company_memberships) as company_memberships,
  (select count(*) from public.company_jobsites) as company_jobsites,
  (select count(*) from public.company_jsas) as company_jsas,
  (select count(*) from public.company_jsa_activities) as company_jsa_activities,
  (select count(*) from public.company_corrective_actions) as company_corrective_actions,
  (select count(*) from public.company_permits) as company_permits,
  (select count(*) from public.company_incidents) as company_incidents,
  (select count(*) from public.company_reports) as company_reports;

select
  'compat_company_jobsites' as compatibility_view,
  (select count(*) from public.compat_company_jobsites) as compatibility_rows,
  (select count(*) from public.company_jobsites) as canonical_rows
union all
select
  'compat_company_corrective_actions',
  (select count(*) from public.compat_company_corrective_actions),
  (select count(*) from public.company_corrective_actions)
union all
select
  'compat_company_permits',
  (select count(*) from public.compat_company_permits),
  (select count(*) from public.company_permits)
union all
select
  'compat_company_incidents',
  (select count(*) from public.compat_company_incidents),
  (select count(*) from public.company_incidents)
union all
select
  'compat_company_reports',
  (select count(*) from public.compat_company_reports),
  (select count(*) from public.company_reports);
