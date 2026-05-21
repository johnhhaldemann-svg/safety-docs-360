create table if not exists public.platform_rule_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  precedence integer not null default 100,
  version text not null default '2026-04-14',
  merge_behavior text not null default 'extend',
  selectors jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_rule_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  precedence integer not null default 200,
  version text not null default '2026-04-14',
  merge_behavior text not null default 'extend',
  selectors jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_rule_overrides_company_code_uidx unique (company_id, code)
);

create table if not exists public.jobsite_rule_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  code text not null,
  label text not null,
  precedence integer not null default 300,
  version text not null default '2026-04-14',
  merge_behavior text not null default 'extend',
  selectors jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint jobsite_rule_overrides_jobsite_code_uidx unique (jobsite_id, code)
);

alter table public.documents
  add column if not exists generated_document_id uuid null references public.company_generated_documents(id) on delete set null;

create index if not exists company_rule_overrides_company_idx
  on public.company_rule_overrides(company_id, active, precedence);
create index if not exists jobsite_rule_overrides_jobsite_idx
  on public.jobsite_rule_overrides(company_id, jobsite_id, active, precedence);

alter table public.platform_rule_templates enable row level security;
alter table public.company_rule_overrides enable row level security;
alter table public.jobsite_rule_overrides enable row level security;

grant select on public.platform_rule_templates to authenticated;
grant select, insert, update, delete on public.platform_rule_templates to service_role;
grant select, insert, update, delete on public.company_rule_overrides to authenticated;
grant select, insert, update, delete on public.jobsite_rule_overrides to authenticated;

drop policy if exists platform_rule_templates_select_all on public.platform_rule_templates;
create policy platform_rule_templates_select_all
on public.platform_rule_templates
for select to authenticated
using (true);

drop policy if exists company_rule_overrides_select_member_scope on public.company_rule_overrides;
create policy company_rule_overrides_select_member_scope
on public.company_rule_overrides
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_rule_overrides_insert_manager_scope on public.company_rule_overrides;
create policy company_rule_overrides_insert_manager_scope
on public.company_rule_overrides
for insert to authenticated
with check (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists company_rule_overrides_update_manager_scope on public.company_rule_overrides;
create policy company_rule_overrides_update_manager_scope
on public.company_rule_overrides
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists company_rule_overrides_delete_manager_scope on public.company_rule_overrides;
create policy company_rule_overrides_delete_manager_scope
on public.company_rule_overrides
for delete to authenticated
using (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists jobsite_rule_overrides_select_member_scope on public.jobsite_rule_overrides;
create policy jobsite_rule_overrides_select_member_scope
on public.jobsite_rule_overrides
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists jobsite_rule_overrides_insert_manager_scope on public.jobsite_rule_overrides;
create policy jobsite_rule_overrides_insert_manager_scope
on public.jobsite_rule_overrides
for insert to authenticated
with check (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists jobsite_rule_overrides_update_manager_scope on public.jobsite_rule_overrides;
create policy jobsite_rule_overrides_update_manager_scope
on public.jobsite_rule_overrides
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists jobsite_rule_overrides_delete_manager_scope on public.jobsite_rule_overrides;
create policy jobsite_rule_overrides_delete_manager_scope
on public.jobsite_rule_overrides
for delete to authenticated
using (public.security_can_manage_safety_intelligence(company_id));

drop trigger if exists set_platform_rule_templates_updated_at on public.platform_rule_templates;
create trigger set_platform_rule_templates_updated_at
before update on public.platform_rule_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_company_rule_overrides_updated_at on public.company_rule_overrides;
create trigger set_company_rule_overrides_updated_at
before update on public.company_rule_overrides
for each row execute function public.set_updated_at();

drop trigger if exists set_jobsite_rule_overrides_updated_at on public.jobsite_rule_overrides;
create trigger set_jobsite_rule_overrides_updated_at
before update on public.jobsite_rule_overrides
for each row execute function public.set_updated_at();

insert into public.platform_rule_templates (
  code,
  label,
  precedence,
  version,
  merge_behavior,
  selectors,
  outputs,
  metadata
)
values
  (
    'platform_hot_work',
    'Platform hot work defaults',
    100,
    '2026-04-14',
    'extend',
    '{"taskKeywords":["weld","hot work","torch","cutting","grinding"]}'::jsonb,
    '{"hazardFamilies":["hot_work","fire","fumes"],"hazardCategories":["Hot work","Fire","Fumes"],"permitTriggers":["hot_work_permit"],"requiredControls":["fire_watch","spark_containment","flammable_clearance"],"trainingRequirements":["hot_work_training"],"ppeRequirements":["welding_hood","face_shield","gloves"],"equipmentChecks":["welder_inspection","fire_extinguisher_present"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'platform_electrical',
    'Platform electrical defaults',
    100,
    '2026-04-14',
    'extend',
    '{"taskKeywords":["energized","electrical","switchgear","troubleshoot","panel"]}'::jsonb,
    '{"hazardFamilies":["electrical","arc_flash"],"hazardCategories":["Electrical","Arc flash"],"permitTriggers":["energized_electrical_permit"],"requiredControls":["loto","qualified_worker","shock_boundaries"],"trainingRequirements":["qualified_electrical_worker","nfpa70e"],"ppeRequirements":["arc_flash_ppe","electrical_gloves"],"equipmentChecks":["meter_calibration","ppe_inspection"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'platform_excavation',
    'Platform excavation defaults',
    100,
    '2026-04-14',
    'extend',
    '{"taskKeywords":["excavat","trench","dig","groundbreaking"]}'::jsonb,
    '{"hazardFamilies":["excavation","collapse","utility_strike"],"hazardCategories":["Excavation","Collapse","Utility strike"],"permitTriggers":["excavation_permit"],"requiredControls":["competent_person","barricade","locate_utilities","access_egress"],"trainingRequirements":["competent_person_excavation"],"ppeRequirements":["high_visibility_vest","hard_hat"],"equipmentChecks":["excavation_inspection","soil_classification"],"weatherRestrictions":["stop_for_heavy_rain","reinspect_after_weather_change"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'platform_no_a_frame_ladders',
    'Platform no A-frame ladder restriction',
    150,
    '2026-04-14',
    'extend',
    '{"taskKeywords":["ladder","elevated","mewp","scaffold"]}'::jsonb,
    '{"siteRestrictions":["No A-frame ladders."],"prohibitedEquipment":["a_frame_ladder"],"requiredControls":["use_site_approved_access_equipment"]}'::jsonb,
    '{"exampleRestriction":true}'::jsonb
  )
on conflict (code) do update
set
  label = excluded.label,
  precedence = excluded.precedence,
  version = excluded.version,
  merge_behavior = excluded.merge_behavior,
  selectors = excluded.selectors,
  outputs = excluded.outputs,
  metadata = excluded.metadata,
  active = true;
