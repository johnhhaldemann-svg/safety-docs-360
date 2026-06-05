alter table public.company_jobsite_emergency_profiles
  add column if not exists secondary_assembly_area text null,
  add column if not exists command_post_location text null,
  add column if not exists weather_shelter_location text null,
  add column if not exists lightning_plan text null,
  add column if not exists tornado_plan text null,
  add column if not exists fire_extinguisher_locations text null,
  add column if not exists spill_kit_locations text null,
  add column if not exists rescue_equipment_locations text null,
  add column if not exists nearest_medical_route text null,
  add column if not exists media_contact_name text null,
  add column if not exists media_contact_phone text null,
  add column if not exists media_statement_instructions text null,
  add column if not exists regulatory_contact_name text null,
  add column if not exists regulatory_contact_phone text null,
  add column if not exists regulatory_reporting_instructions text null,
  add column if not exists call_chain jsonb not null default '[]'::jsonb,
  add column if not exists utility_contacts jsonb not null default '[]'::jsonb,
  add column if not exists after_hours_contacts jsonb not null default '[]'::jsonb,
  add column if not exists backup_contacts jsonb not null default '[]'::jsonb,
  add column if not exists incident_notification_timeline jsonb not null default '[]'::jsonb,
  add column if not exists post_incident_requirements jsonb not null default '[]'::jsonb,
  add column if not exists revision_date date null;

create table if not exists public.company_jobsite_emergency_defaults (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  emergency_contact_name text null,
  emergency_contact_phone text null,
  responder_access_instructions text null,
  responder_site_address text null,
  assembly_area text null,
  secondary_assembly_area text null,
  command_post_location text null,
  evacuation_shelter_notes text null,
  weather_shelter_location text null,
  lightning_plan text null,
  tornado_plan text null,
  aed_location text null,
  first_aid_location text null,
  fire_extinguisher_locations text null,
  spill_kit_locations text null,
  rescue_equipment_locations text null,
  nearest_medical_name text null,
  nearest_medical_address text null,
  nearest_medical_phone text null,
  nearest_medical_route text null,
  media_contact_name text null,
  media_contact_phone text null,
  media_statement_instructions text null,
  regulatory_contact_name text null,
  regulatory_contact_phone text null,
  regulatory_reporting_instructions text null,
  call_chain jsonb not null default '[]'::jsonb,
  utility_contacts jsonb not null default '[]'::jsonb,
  after_hours_contacts jsonb not null default '[]'::jsonb,
  backup_contacts jsonb not null default '[]'::jsonb,
  incident_notification_timeline jsonb not null default '[]'::jsonb,
  post_incident_requirements jsonb not null default '[]'::jsonb,
  notes text null,
  revision_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  constraint company_jobsite_emergency_defaults_unique_company unique (company_id),
  constraint company_jobsite_emergency_defaults_phone_length_check check (
    emergency_contact_phone is null or length(trim(emergency_contact_phone)) <= 40
  ),
  constraint company_jobsite_emergency_defaults_medical_phone_length_check check (
    nearest_medical_phone is null or length(trim(nearest_medical_phone)) <= 40
  )
);

create index if not exists company_jobsite_emergency_defaults_company_idx
on public.company_jobsite_emergency_defaults(company_id)
where archived_at is null;

drop trigger if exists set_company_jobsite_emergency_defaults_updated_at on public.company_jobsite_emergency_defaults;
create trigger set_company_jobsite_emergency_defaults_updated_at
before update on public.company_jobsite_emergency_defaults
for each row execute function public.set_updated_at();

alter table public.company_jobsite_emergency_defaults enable row level security;

grant select, insert, update, delete on public.company_jobsite_emergency_defaults to authenticated;
grant select, insert, update, delete on public.company_jobsite_emergency_defaults to service_role;

drop policy if exists company_jobsite_emergency_defaults_select_scope on public.company_jobsite_emergency_defaults;
create policy company_jobsite_emergency_defaults_select_scope
on public.company_jobsite_emergency_defaults for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_emergency_defaults_insert_scope on public.company_jobsite_emergency_defaults;
create policy company_jobsite_emergency_defaults_insert_scope
on public.company_jobsite_emergency_defaults for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_jobsite_emergency_defaults_update_scope on public.company_jobsite_emergency_defaults;
create policy company_jobsite_emergency_defaults_update_scope
on public.company_jobsite_emergency_defaults for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_jobsite_emergency_defaults_delete_scope on public.company_jobsite_emergency_defaults;
create policy company_jobsite_emergency_defaults_delete_scope
on public.company_jobsite_emergency_defaults for delete to authenticated
using (public.security_can_write_company_data(company_id));
