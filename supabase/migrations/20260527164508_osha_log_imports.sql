-- OSHA log imports are private company-scoped prevention signals.
-- Raw files stay in the private documents bucket; parsed case rows are deidentified.

create table if not exists public.company_osha_log_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites (id) on delete set null,
  original_file_name text not null,
  storage_path text not null,
  file_mime_type text null,
  file_size_bytes bigint not null default 0,
  import_year integer null,
  status text not null default 'needs_review',
  parser_version text not null,
  parse_method text null,
  parsed_count integer not null default 0,
  skipped_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_osha_log_imports_status_check check (status in ('processed', 'needs_review', 'failed')),
  constraint company_osha_log_imports_parse_method_check check (
    parse_method is null or parse_method in ('csv', 'xlsx', 'pdf_text')
  ),
  constraint company_osha_log_imports_year_check check (
    import_year is null or (import_year >= 1970 and import_year <= 2100)
  ),
  constraint company_osha_log_imports_file_size_check check (file_size_bytes >= 0),
  constraint company_osha_log_imports_counts_check check (parsed_count >= 0 and skipped_count >= 0)
);

create index if not exists company_osha_log_imports_company_created_idx
  on public.company_osha_log_imports (company_id, created_at desc);

create index if not exists company_osha_log_imports_company_jobsite_idx
  on public.company_osha_log_imports (company_id, jobsite_id, created_at desc)
  where jobsite_id is not null;

drop trigger if exists set_company_osha_log_imports_updated_at on public.company_osha_log_imports;
create trigger set_company_osha_log_imports_updated_at
before update on public.company_osha_log_imports
for each row execute function public.set_updated_at();

comment on table public.company_osha_log_imports is
  'Company-scoped OSHA/equivalent injury log uploads. Files are private; parsed rows are deidentified prevention signals.';

create table if not exists public.company_osha_log_cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  import_id uuid not null references public.company_osha_log_imports (id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites (id) on delete set null,
  case_number text null,
  occurred_on date null,
  department text null,
  location text null,
  injury_type text not null default 'other',
  body_part text not null default 'other',
  exposure_event_type text not null default 'other',
  injury_source text not null default 'other',
  days_away_from_work integer not null default 0,
  days_restricted integer not null default 0,
  job_transfer boolean not null default false,
  recordable boolean not null default true,
  fatality boolean not null default false,
  severity text not null default 'medium',
  repeat_pattern_key text not null,
  deidentified_summary text not null,
  source_row_number integer not null,
  parser_confidence text not null default 'low',
  created_at timestamptz not null default now(),
  constraint company_osha_log_cases_injury_type_check check (
    injury_type in (
      'abrasion',
      'amputation',
      'burn',
      'chemical_burn',
      'cold_injury',
      'concussion',
      'contusion',
      'crush_injury',
      'dislocation',
      'foreign_body',
      'fracture',
      'heat_illness',
      'hearing_loss',
      'insect_animal',
      'internal_injury',
      'laceration',
      'multiple_injuries',
      'poisoning',
      'puncture',
      'respiratory',
      'sprain',
      'strain',
      'vision_loss',
      'other'
    )
  ),
  constraint company_osha_log_cases_body_part_check check (
    body_part in ('back', 'hand', 'fingers', 'knee', 'shoulder', 'eye', 'foot', 'other')
  ),
  constraint company_osha_log_cases_exposure_event_type_check check (
    exposure_event_type in (
      'caught_in_between',
      'caught_on_object',
      'confined_space',
      'contact_with_equipment',
      'drowning',
      'electrical',
      'excavation_collapse',
      'explosion',
      'exposure_harmful_substance',
      'fall_same_level',
      'fall_to_lower_level',
      'fire',
      'motor_vehicle',
      'noise_exposure',
      'overexertion',
      'repetitive_motion',
      'slip_trip_without_fall',
      'struck_against_object',
      'struck_by_object',
      'struck_by_vehicle',
      'structure_collapse',
      'temperature_extreme',
      'workplace_violence',
      'other'
    )
  ),
  constraint company_osha_log_cases_injury_source_check check (
    injury_source in ('ladder', 'scaffold', 'hand_tools', 'heavy_equipment', 'material_handling', 'electrical_system', 'other')
  ),
  constraint company_osha_log_cases_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint company_osha_log_cases_parser_confidence_check check (parser_confidence in ('high', 'medium', 'low')),
  constraint company_osha_log_cases_days_check check (days_away_from_work >= 0 and days_restricted >= 0),
  constraint company_osha_log_cases_source_row_check check (source_row_number > 0)
);

create index if not exists company_osha_log_cases_company_pattern_idx
  on public.company_osha_log_cases (company_id, repeat_pattern_key, created_at desc);

create index if not exists company_osha_log_cases_company_jobsite_idx
  on public.company_osha_log_cases (company_id, jobsite_id, occurred_on desc)
  where jobsite_id is not null;

create index if not exists company_osha_log_cases_company_date_idx
  on public.company_osha_log_cases (company_id, occurred_on desc)
  where occurred_on is not null;

comment on table public.company_osha_log_cases is
  'Deidentified parsed injury-history signals from OSHA/equivalent logs for repeat-injury prevention.';

comment on column public.company_osha_log_cases.deidentified_summary is
  'Short normalized summary that excludes employee names and raw private row text.';

alter table public.company_osha_log_imports enable row level security;
alter table public.company_osha_log_cases enable row level security;

grant select, insert, update, delete on public.company_osha_log_imports to authenticated;
grant select, insert, delete on public.company_osha_log_cases to authenticated;
grant select, insert, update, delete on public.company_osha_log_imports to service_role;
grant select, insert, update, delete on public.company_osha_log_cases to service_role;

drop policy if exists "company_osha_log_imports_select_scope" on public.company_osha_log_imports;
create policy "company_osha_log_imports_select_scope"
on public.company_osha_log_imports
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
);

drop policy if exists "company_osha_log_imports_insert_scope" on public.company_osha_log_imports;
create policy "company_osha_log_imports_insert_scope"
on public.company_osha_log_imports
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
);

drop policy if exists "company_osha_log_imports_update_scope" on public.company_osha_log_imports;
create policy "company_osha_log_imports_update_scope"
on public.company_osha_log_imports
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
);

drop policy if exists "company_osha_log_imports_delete_scope" on public.company_osha_log_imports;
create policy "company_osha_log_imports_delete_scope"
on public.company_osha_log_imports
for delete
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_imports.company_id
  )
);

drop policy if exists "company_osha_log_cases_select_scope" on public.company_osha_log_cases;
create policy "company_osha_log_cases_select_scope"
on public.company_osha_log_cases
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_cases.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_cases.company_id
  )
);

drop policy if exists "company_osha_log_cases_insert_scope" on public.company_osha_log_cases;
create policy "company_osha_log_cases_insert_scope"
on public.company_osha_log_cases
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_cases.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_cases.company_id
  )
);

drop policy if exists "company_osha_log_cases_delete_scope" on public.company_osha_log_cases;
create policy "company_osha_log_cases_delete_scope"
on public.company_osha_log_cases
for delete
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_cases.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_osha_log_cases.company_id
  )
);

alter table public.company_risk_events
  drop constraint if exists company_risk_events_module_check;

alter table public.company_risk_events
  add constraint company_risk_events_module_check check (
    module_name in (
      'permits',
      'incidents',
      'corrective_actions',
      'jsa_activity',
      'sor_record',
      'risk_memory',
      'inductions',
      'toolbox',
      'contractor_prequal',
      'sds',
      'safety_forms',
      'integrations',
      'osha_logs'
    )
  );
