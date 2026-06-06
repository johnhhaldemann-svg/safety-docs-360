-- Replace v1 of superadmin_top_incident_orgs with a version that JOINs company
-- names, eliminating the extra round-trip in the metrics API route.

create or replace function public.superadmin_top_incident_orgs(limit_count int default 5)
returns table(company_id uuid, company_name text, incident_count bigint)
language sql
security definer
set search_path = public
as $$
  select ci.company_id,
         coalesce(c.name, 'Unknown company') as company_name,
         count(*) as incident_count
  from public.company_incidents ci
  left join public.companies c on c.id = ci.company_id
  where ci.company_id is not null
  group by ci.company_id, c.name
  order by incident_count desc
  limit limit_count;
$$;

revoke execute on function public.superadmin_top_incident_orgs(int) from public, anon, authenticated;
grant execute on function public.superadmin_top_incident_orgs(int) to service_role;
