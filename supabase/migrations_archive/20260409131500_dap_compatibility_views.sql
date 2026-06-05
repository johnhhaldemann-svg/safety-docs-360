begin;

create or replace view public.company_daps
with (security_invoker = true) as
select
  id,
  company_id,
  jobsite_id,
  title,
  description,
  status,
  severity,
  category,
  owner_user_id,
  due_at,
  created_at,
  updated_at,
  created_by,
  updated_by
from public.company_jsas;

grant select on public.company_daps to authenticated;

create or replace view public.company_dap_activities
with (security_invoker = true) as
select
  id,
  company_id,
  jsa_id as dap_id,
  jobsite_id,
  work_date,
  trade,
  activity_name,
  area,
  crew_size,
  hazard_category,
  hazard_description,
  mitigation,
  permit_required,
  permit_type,
  planned_risk_level,
  status,
  created_at,
  updated_at,
  created_by,
  updated_by
from public.company_jsa_activities;

grant select on public.company_dap_activities to authenticated;

commit;
