-- Efficient cross-tenant incident tally used by the Superadmin Command Center.
-- Replaces the JS-side GROUP BY that fetched up to 3000 rows into memory.
-- security definer so the API service role can call it without bypassing RLS on other tables.

create or replace function public.superadmin_top_incident_orgs(limit_count int default 5)
returns table(company_id uuid, incident_count bigint)
language sql
security definer
set search_path = public
as $$
  select company_id, count(*) as incident_count
  from public.company_incidents
  where company_id is not null
  group by company_id
  order by incident_count desc
  limit limit_count;
$$;

-- Only superadmin service-role calls this; revoke public execute.
revoke execute on function public.superadmin_top_incident_orgs(int) from public, anon, authenticated;
grant execute on function public.superadmin_top_incident_orgs(int) to service_role;
