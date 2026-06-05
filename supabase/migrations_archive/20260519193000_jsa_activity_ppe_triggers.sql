alter table public.company_jsa_activities
  add column if not exists ppe_requirements text[] not null default '{}'::text[],
  add column if not exists ppe_acknowledged boolean not null default false,
  add column if not exists ppe_trigger_sources jsonb not null default '[]'::jsonb;

create index if not exists company_jsa_activities_ppe_requirements_gin_idx
  on public.company_jsa_activities using gin (ppe_requirements);

create or replace view public.company_dap_activities
with (security_invoker = true)
as
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
  updated_by,
  ppe_requirements,
  ppe_acknowledged,
  ppe_trigger_sources
from public.company_jsa_activities;

grant select on public.company_dap_activities to authenticated;
