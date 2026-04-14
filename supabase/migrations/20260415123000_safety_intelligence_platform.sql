do $$
begin
  if not exists (select 1 from pg_type where typname = 'si_weather_sensitivity') then
    create type public.si_weather_sensitivity as enum ('low', 'medium', 'high');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_task_status') then
    create type public.si_task_status as enum ('planned', 'active', 'completed', 'cancelled', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_control_status') then
    create type public.si_control_status as enum ('required', 'recommended', 'verified', 'missing');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_bucket_run_status') then
    create type public.si_bucket_run_status as enum ('pending', 'bucketed', 'rules_complete', 'conflicts_complete', 'ai_reviewed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_conflict_severity') then
    create type public.si_conflict_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_conflict_status') then
    create type public.si_conflict_status as enum ('open', 'accepted', 'mitigated', 'dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_ai_review_type') then
    create type public.si_ai_review_type as enum ('document_generation', 'risk_intelligence', 'combined');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_ai_review_status') then
    create type public.si_ai_review_status as enum ('draft', 'reviewed', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_document_type') then
    create type public.si_document_type as enum ('jsa', 'csep', 'peshep', 'pshsep', 'permit', 'sop', 'work_plan', 'safety_narrative');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_document_status') then
    create type public.si_document_status as enum ('draft', 'in_review', 'approved', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_risk_band') then
    create type public.si_risk_band as enum ('low', 'moderate', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_score_scope') then
    create type public.si_score_scope as enum ('company', 'jobsite', 'trade', 'task', 'work_area', 'bucket_item');
  end if;
end
$$;

create table if not exists public.platform_trades (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_sub_trades (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.platform_trades(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_sub_trades_trade_code_uidx unique (trade_id, code)
);

create table if not exists public.platform_task_templates (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid null references public.platform_trades(id) on delete set null,
  sub_trade_id uuid null references public.platform_sub_trades(id) on delete set null,
  code text not null unique,
  name text not null,
  common_task boolean not null default true,
  equipment_used text[] not null default '{}'::text[],
  work_conditions text[] not null default '{}'::text[],
  hazard_families text[] not null default '{}'::text[],
  required_controls text[] not null default '{}'::text[],
  permit_triggers text[] not null default '{}'::text[],
  training_requirements text[] not null default '{}'::text[],
  weather_sensitivity public.si_weather_sensitivity not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_trades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  platform_trade_id uuid null references public.platform_trades(id) on delete set null,
  code text not null,
  name text not null,
  description text null,
  hazard_families text[] not null default '{}'::text[],
  required_controls text[] not null default '{}'::text[],
  permit_triggers text[] not null default '{}'::text[],
  training_requirements text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_trades_uidx unique (company_id, code)
);

create table if not exists public.company_sub_trades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_trade_id uuid not null references public.company_trades(id) on delete cascade,
  platform_sub_trade_id uuid null references public.platform_sub_trades(id) on delete set null,
  code text not null,
  name text not null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_sub_trades_uidx unique (company_id, company_trade_id, code)
);

create table if not exists public.company_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  company_trade_id uuid null references public.company_trades(id) on delete set null,
  company_sub_trade_id uuid null references public.company_sub_trades(id) on delete set null,
  platform_task_template_id uuid null references public.platform_task_templates(id) on delete set null,
  source_module text not null default 'manual',
  source_id uuid null,
  code text null,
  title text not null,
  description text null,
  equipment_used text[] not null default '{}'::text[],
  work_conditions text[] not null default '{}'::text[],
  hazard_families text[] not null default '{}'::text[],
  required_controls text[] not null default '{}'::text[],
  permit_triggers text[] not null default '{}'::text[],
  training_requirements text[] not null default '{}'::text[],
  weather_sensitivity public.si_weather_sensitivity not null default 'medium',
  crew_size integer null,
  work_area_label text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  status public.si_task_status not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_tasks_time_window_check
    check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.company_hazards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  family text not null,
  severity_hint public.si_conflict_severity not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_hazards_uidx unique (company_id, code)
);

create table if not exists public.company_controls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  control_type text not null default 'administrative',
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_controls_uidx unique (company_id, code)
);

create table if not exists public.company_permits_catalog (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  description text null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_permits_catalog_uidx unique (company_id, code)
);

create table if not exists public.platform_permit_trigger_rules (
  id uuid primary key default gen_random_uuid(),
  permit_code text not null,
  trade_code text null,
  task_template_code text null,
  hazard_family text null,
  work_condition text null,
  weather_condition text null,
  rationale text not null,
  required_controls text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_permit_trigger_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  platform_rule_id uuid null references public.platform_permit_trigger_rules(id) on delete set null,
  permit_code text not null,
  trade_code text null,
  task_code text null,
  hazard_family text null,
  work_condition text null,
  weather_condition text null,
  rationale text not null,
  required_controls text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_work_areas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  code text not null,
  label text not null,
  area_type text not null default 'work_zone',
  location_grid text null,
  parent_area_id uuid null references public.company_work_areas(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_work_areas_uidx unique (company_id, jobsite_id, code)
);

create table if not exists public.platform_conflict_rules (
  id uuid primary key default gen_random_uuid(),
  conflict_code text not null unique,
  conflict_type text not null,
  left_trade_code text null,
  left_task_code text null,
  left_hazard_family text null,
  right_trade_code text null,
  right_task_code text null,
  right_hazard_family text null,
  requires_same_area boolean not null default false,
  requires_time_overlap boolean not null default false,
  weather_condition text null,
  severity public.si_conflict_severity not null default 'medium',
  rationale text not null,
  recommended_controls text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_conflict_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  platform_rule_id uuid null references public.platform_conflict_rules(id) on delete set null,
  conflict_code text not null,
  conflict_type text not null,
  left_trade_code text null,
  left_task_code text null,
  left_hazard_family text null,
  right_trade_code text null,
  right_task_code text null,
  right_hazard_family text null,
  requires_same_area boolean not null default false,
  requires_time_overlap boolean not null default false,
  weather_condition text null,
  severity public.si_conflict_severity not null default 'medium',
  rationale text not null,
  recommended_controls text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_conflict_rules_uidx unique (company_id, conflict_code)
);

create table if not exists public.company_weather_conditions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  observation_time timestamptz not null default now(),
  condition_code text not null default 'clear',
  temperature_c numeric(5,2) null,
  wind_kph numeric(5,2) null,
  lightning_risk text null,
  precipitation_mm numeric(7,2) null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_task_hazards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_task_id uuid not null references public.company_tasks(id) on delete cascade,
  company_hazard_id uuid null references public.company_hazards(id) on delete set null,
  hazard_code text not null,
  hazard_family text not null,
  source text not null default 'task',
  severity_hint text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_task_controls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_task_id uuid not null references public.company_tasks(id) on delete cascade,
  company_control_id uuid null references public.company_controls(id) on delete set null,
  control_code text not null,
  requirement_source text not null default 'task',
  status public.si_control_status not null default 'required',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_task_permit_triggers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_task_id uuid not null references public.company_tasks(id) on delete cascade,
  company_permits_catalog_id uuid null references public.company_permits_catalog(id) on delete set null,
  permit_code text not null,
  trigger_source text not null default 'task',
  trigger_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_training_matrix_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  requirement_code text not null,
  trade_codes text[] not null default '{}'::text[],
  task_codes text[] not null default '{}'::text[],
  position_codes text[] not null default '{}'::text[],
  match_keywords text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_training_matrix_requirements_uidx unique (company_id, requirement_code)
);

create table if not exists public.company_task_training_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_task_id uuid not null references public.company_tasks(id) on delete cascade,
  company_training_matrix_requirement_id uuid null references public.company_training_matrix_requirements(id) on delete set null,
  requirement_code text not null,
  requirement_source text not null default 'task',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_bucket_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  source_module text not null,
  source_id uuid null,
  run_status public.si_bucket_run_status not null default 'pending',
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  intake_payload jsonb not null default '{}'::jsonb,
  bucket_summary jsonb not null default '{}'::jsonb,
  rules_summary jsonb not null default '{}'::jsonb,
  conflict_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_bucket_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  bucket_run_id uuid not null references public.company_bucket_runs(id) on delete cascade,
  company_task_id uuid null references public.company_tasks(id) on delete set null,
  work_area_id uuid null references public.company_work_areas(id) on delete set null,
  source_module text not null,
  source_id uuid null,
  bucket_key text not null,
  bucket_type text not null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  weather_condition_id uuid null references public.company_weather_conditions(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  bucket_payload jsonb not null default '{}'::jsonb,
  rule_results jsonb not null default '{}'::jsonb,
  conflict_results jsonb not null default '{}'::jsonb,
  ai_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_simultaneous_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  company_task_id uuid null references public.company_tasks(id) on delete set null,
  bucket_item_id uuid null references public.company_bucket_items(id) on delete cascade,
  work_area_id uuid null references public.company_work_areas(id) on delete set null,
  operation_label text not null,
  trade_code text null,
  sub_trade_code text null,
  task_code text null,
  task_title text not null,
  hazard_families text[] not null default '{}'::text[],
  permit_codes text[] not null default '{}'::text[],
  weather_sensitive boolean not null default false,
  starts_at timestamptz null,
  ends_at timestamptz null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.company_conflict_pairs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  bucket_run_id uuid null references public.company_bucket_runs(id) on delete cascade,
  left_operation_id uuid null references public.company_simultaneous_operations(id) on delete cascade,
  right_operation_id uuid null references public.company_simultaneous_operations(id) on delete cascade,
  conflict_code text not null,
  conflict_type text not null,
  severity public.si_conflict_severity not null default 'medium',
  status public.si_conflict_status not null default 'open',
  overlap_scope jsonb not null default '{}'::jsonb,
  rationale text not null,
  recommended_controls text[] not null default '{}'::text[],
  weather_condition text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_conflict_pairs_distinct_operations_check
    check (left_operation_id is distinct from right_operation_id)
);

create table if not exists public.company_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  bucket_run_id uuid not null references public.company_bucket_runs(id) on delete cascade,
  review_type public.si_ai_review_type not null,
  status public.si_ai_review_status not null default 'draft',
  input_snapshot jsonb not null default '{}'::jsonb,
  rules_snapshot jsonb not null default '{}'::jsonb,
  conflicts_snapshot jsonb not null default '{}'::jsonb,
  ai_summary jsonb not null default '{}'::jsonb,
  prompt_hash text null,
  model text null,
  reviewed_at timestamptz null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_ai_reviews_approval_time_check
    check (approved_at is null or reviewed_at is not null)
);

create table if not exists public.company_document_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type public.si_document_type not null,
  title text not null,
  template_key text not null,
  schema_version text not null default 'v1',
  sections jsonb not null default '[]'::jsonb,
  template_body jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_document_templates_uidx unique (company_id, template_key)
);

create table if not exists public.company_generated_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  bucket_run_id uuid null references public.company_bucket_runs(id) on delete set null,
  ai_review_id uuid null references public.company_ai_reviews(id) on delete set null,
  template_id uuid null references public.company_document_templates(id) on delete set null,
  source_document_id uuid null references public.documents(id) on delete set null,
  document_type public.si_document_type not null,
  title text not null,
  current_version integer not null default 1,
  status public.si_document_status not null default 'draft',
  storage_bucket text null,
  storage_path text null,
  html_preview text null,
  draft_json jsonb not null default '{}'::jsonb,
  risk_outputs jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  approved_at timestamptz null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_generated_documents_current_version_check
    check (current_version >= 1)
);

create table if not exists public.company_generated_document_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  generated_document_id uuid not null references public.company_generated_documents(id) on delete cascade,
  version_number integer not null,
  ai_review_id uuid null references public.company_ai_reviews(id) on delete set null,
  template_id uuid null references public.company_document_templates(id) on delete set null,
  status public.si_document_status not null,
  storage_bucket text null,
  storage_path text null,
  html_preview text null,
  draft_json jsonb not null default '{}'::jsonb,
  risk_outputs jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_generated_document_versions_uidx unique (generated_document_id, version_number),
  constraint company_generated_document_versions_version_check check (version_number >= 1)
);

create table if not exists public.company_safety_intelligence_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.company_safety_intelligence_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  entity_table text not null,
  entity_id uuid not null,
  change_type text not null,
  before_state jsonb null,
  after_state jsonb null,
  changed_at timestamptz not null default now(),
  changed_by uuid null references auth.users(id) on delete set null
);

create or replace function public.si_log_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
  after_state jsonb;
  entity_company_id uuid;
  entity_jobsite_id uuid;
  entity_id uuid;
begin
  before_state := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_state := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  entity_company_id := coalesce((to_jsonb(new)->>'company_id')::uuid, (to_jsonb(old)->>'company_id')::uuid);
  entity_jobsite_id := coalesce((to_jsonb(new)->>'jobsite_id')::uuid, (to_jsonb(old)->>'jobsite_id')::uuid);
  entity_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);

  insert into public.company_safety_intelligence_history (
    company_id,
    jobsite_id,
    entity_table,
    entity_id,
    change_type,
    before_state,
    after_state,
    changed_by
  )
  values (
    entity_company_id,
    entity_jobsite_id,
    tg_table_name,
    entity_id,
    lower(tg_op),
    before_state,
    after_state,
    auth.uid()
  );

  insert into public.company_safety_intelligence_audit_log (
    company_id,
    jobsite_id,
    entity_type,
    entity_id,
    action,
    actor_user_id,
    actor_role,
    event_payload
  )
  values (
    entity_company_id,
    entity_jobsite_id,
    tg_table_name,
    entity_id,
    lower(tg_op),
    auth.uid(),
    public.current_app_role(),
    coalesce(after_state, before_state, '{}'::jsonb)
  );

  return coalesce(new, old);
end
$$;

create or replace function public.si_bump_generated_document_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.current_version := coalesce(new.current_version, 1);
    return new;
  end if;

  if
    new.status is distinct from old.status
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.html_preview is distinct from old.html_preview
    or new.draft_json is distinct from old.draft_json
    or new.risk_outputs is distinct from old.risk_outputs
    or new.provenance is distinct from old.provenance
  then
    new.current_version := old.current_version + 1;
  else
    new.current_version := old.current_version;
  end if;

  return new;
end
$$;

create or replace function public.si_store_generated_document_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_generated_document_versions (
    company_id,
    jobsite_id,
    generated_document_id,
    version_number,
    ai_review_id,
    template_id,
    status,
    storage_bucket,
    storage_path,
    html_preview,
    draft_json,
    risk_outputs,
    provenance,
    created_by
  )
  values (
    new.company_id,
    new.jobsite_id,
    new.id,
    new.current_version,
    new.ai_review_id,
    new.template_id,
    new.status,
    new.storage_bucket,
    new.storage_path,
    new.html_preview,
    new.draft_json,
    new.risk_outputs,
    new.provenance,
    coalesce(new.updated_by, new.created_by, auth.uid())
  )
  on conflict (generated_document_id, version_number) do update
  set
    status = excluded.status,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    html_preview = excluded.html_preview,
    draft_json = excluded.draft_json,
    risk_outputs = excluded.risk_outputs,
    provenance = excluded.provenance;

  return new;
end
$$;

create table if not exists public.company_risk_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  bucket_run_id uuid null references public.company_bucket_runs(id) on delete cascade,
  bucket_item_id uuid null references public.company_bucket_items(id) on delete cascade,
  score_scope public.si_score_scope not null default 'task',
  score numeric(6,2) not null,
  band public.si_risk_band not null,
  score_date date not null default current_date,
  score_window_days integer not null default 30,
  trade_code text null,
  task_code text null,
  work_area_id uuid null references public.company_work_areas(id) on delete set null,
  components jsonb not null default '{}'::jsonb,
  trend_hints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists company_tasks_scope_idx
  on public.company_tasks(company_id, jobsite_id, status, updated_at desc);
create index if not exists platform_permit_trigger_rules_lookup_idx
  on public.platform_permit_trigger_rules(permit_code, trade_code, task_template_code);
create unique index if not exists platform_permit_trigger_rules_uidx
  on public.platform_permit_trigger_rules(
    permit_code,
    coalesce(trade_code, ''),
    coalesce(task_template_code, ''),
    coalesce(hazard_family, ''),
    coalesce(work_condition, ''),
    coalesce(weather_condition, '')
  );
create index if not exists company_permit_trigger_rules_lookup_idx
  on public.company_permit_trigger_rules(company_id, permit_code, trade_code, task_code);
create unique index if not exists company_permit_trigger_rules_uidx
  on public.company_permit_trigger_rules(
    company_id,
    permit_code,
    coalesce(trade_code, ''),
    coalesce(task_code, ''),
    coalesce(hazard_family, ''),
    coalesce(work_condition, ''),
    coalesce(weather_condition, '')
  );
create index if not exists platform_conflict_rules_lookup_idx
  on public.platform_conflict_rules(conflict_code, left_trade_code, right_trade_code);
create index if not exists company_conflict_rules_lookup_idx
  on public.company_conflict_rules(company_id, conflict_code, left_trade_code, right_trade_code);
create index if not exists company_bucket_runs_scope_idx
  on public.company_bucket_runs(company_id, jobsite_id, run_status, updated_at desc);
create index if not exists company_bucket_items_scope_idx
  on public.company_bucket_items(company_id, jobsite_id, ai_ready, updated_at desc);
create index if not exists company_bucket_items_time_idx
  on public.company_bucket_items(company_id, work_area_id, starts_at, ends_at);
create index if not exists company_simultaneous_operations_scope_idx
  on public.company_simultaneous_operations(company_id, jobsite_id, starts_at, ends_at);
create index if not exists company_conflict_pairs_scope_idx
  on public.company_conflict_pairs(company_id, jobsite_id, status, updated_at desc);
create index if not exists company_generated_documents_scope_idx
  on public.company_generated_documents(company_id, jobsite_id, status, updated_at desc);
create index if not exists company_ai_reviews_scope_idx
  on public.company_ai_reviews(company_id, jobsite_id, status, updated_at desc);
create index if not exists company_risk_scores_scope_idx
  on public.company_risk_scores(company_id, jobsite_id, created_at desc);
create index if not exists company_risk_scores_time_series_idx
  on public.company_risk_scores(company_id, score_date desc, score_scope, trade_code, task_code);
create index if not exists company_task_hazards_company_task_idx
  on public.company_task_hazards(company_id, company_task_id, hazard_code);
create index if not exists company_task_controls_company_task_idx
  on public.company_task_controls(company_id, company_task_id, control_code);
create index if not exists company_task_permit_triggers_company_task_idx
  on public.company_task_permit_triggers(company_id, company_task_id, permit_code);
create index if not exists company_task_training_requirements_company_task_idx
  on public.company_task_training_requirements(company_id, company_task_id, requirement_code);
create index if not exists company_bucket_items_payload_gin
  on public.company_bucket_items using gin (bucket_payload);
create index if not exists company_bucket_items_rule_results_gin
  on public.company_bucket_items using gin (rule_results);
create index if not exists company_conflict_pairs_overlap_gin
  on public.company_conflict_pairs using gin (overlap_scope);
create index if not exists company_generated_documents_risk_outputs_gin
  on public.company_generated_documents using gin (risk_outputs);
create index if not exists company_generated_document_versions_scope_idx
  on public.company_generated_document_versions(company_id, generated_document_id, version_number desc);
create index if not exists company_safety_intelligence_audit_log_scope_idx
  on public.company_safety_intelligence_audit_log(company_id, jobsite_id, occurred_at desc);
create index if not exists company_safety_intelligence_history_scope_idx
  on public.company_safety_intelligence_history(company_id, entity_table, entity_id, changed_at desc);

drop trigger if exists set_platform_trades_updated_at on public.platform_trades;
create trigger set_platform_trades_updated_at
before update on public.platform_trades
for each row execute function public.set_updated_at();
drop trigger if exists set_platform_sub_trades_updated_at on public.platform_sub_trades;
create trigger set_platform_sub_trades_updated_at
before update on public.platform_sub_trades
for each row execute function public.set_updated_at();
drop trigger if exists set_platform_task_templates_updated_at on public.platform_task_templates;
create trigger set_platform_task_templates_updated_at
before update on public.platform_task_templates
for each row execute function public.set_updated_at();
drop trigger if exists set_company_trades_updated_at on public.company_trades;
create trigger set_company_trades_updated_at before update on public.company_trades for each row execute function public.set_updated_at();
drop trigger if exists set_company_sub_trades_updated_at on public.company_sub_trades;
create trigger set_company_sub_trades_updated_at before update on public.company_sub_trades for each row execute function public.set_updated_at();
drop trigger if exists set_company_tasks_updated_at on public.company_tasks;
create trigger set_company_tasks_updated_at before update on public.company_tasks for each row execute function public.set_updated_at();
drop trigger if exists set_company_hazards_updated_at on public.company_hazards;
create trigger set_company_hazards_updated_at before update on public.company_hazards for each row execute function public.set_updated_at();
drop trigger if exists set_company_controls_updated_at on public.company_controls;
create trigger set_company_controls_updated_at before update on public.company_controls for each row execute function public.set_updated_at();
drop trigger if exists set_company_permits_catalog_updated_at on public.company_permits_catalog;
create trigger set_company_permits_catalog_updated_at before update on public.company_permits_catalog for each row execute function public.set_updated_at();
drop trigger if exists set_platform_permit_trigger_rules_updated_at on public.platform_permit_trigger_rules;
create trigger set_platform_permit_trigger_rules_updated_at before update on public.platform_permit_trigger_rules for each row execute function public.set_updated_at();
drop trigger if exists set_company_permit_trigger_rules_updated_at on public.company_permit_trigger_rules;
create trigger set_company_permit_trigger_rules_updated_at before update on public.company_permit_trigger_rules for each row execute function public.set_updated_at();
drop trigger if exists set_company_work_areas_updated_at on public.company_work_areas;
create trigger set_company_work_areas_updated_at before update on public.company_work_areas for each row execute function public.set_updated_at();
drop trigger if exists set_platform_conflict_rules_updated_at on public.platform_conflict_rules;
create trigger set_platform_conflict_rules_updated_at before update on public.platform_conflict_rules for each row execute function public.set_updated_at();
drop trigger if exists set_company_conflict_rules_updated_at on public.company_conflict_rules;
create trigger set_company_conflict_rules_updated_at before update on public.company_conflict_rules for each row execute function public.set_updated_at();
drop trigger if exists set_company_training_matrix_requirements_updated_at on public.company_training_matrix_requirements;
create trigger set_company_training_matrix_requirements_updated_at before update on public.company_training_matrix_requirements for each row execute function public.set_updated_at();
drop trigger if exists set_company_bucket_runs_updated_at on public.company_bucket_runs;
create trigger set_company_bucket_runs_updated_at before update on public.company_bucket_runs for each row execute function public.set_updated_at();
drop trigger if exists set_company_bucket_items_updated_at on public.company_bucket_items;
create trigger set_company_bucket_items_updated_at before update on public.company_bucket_items for each row execute function public.set_updated_at();
drop trigger if exists set_company_simultaneous_operations_updated_at on public.company_simultaneous_operations;
create trigger set_company_simultaneous_operations_updated_at before update on public.company_simultaneous_operations for each row execute function public.set_updated_at();
drop trigger if exists set_company_conflict_pairs_updated_at on public.company_conflict_pairs;
create trigger set_company_conflict_pairs_updated_at before update on public.company_conflict_pairs for each row execute function public.set_updated_at();
drop trigger if exists set_company_ai_reviews_updated_at on public.company_ai_reviews;
create trigger set_company_ai_reviews_updated_at before update on public.company_ai_reviews for each row execute function public.set_updated_at();
drop trigger if exists set_company_document_templates_updated_at on public.company_document_templates;
create trigger set_company_document_templates_updated_at before update on public.company_document_templates for each row execute function public.set_updated_at();
drop trigger if exists set_company_generated_documents_updated_at on public.company_generated_documents;
create trigger set_company_generated_documents_updated_at before update on public.company_generated_documents for each row execute function public.set_updated_at();
drop trigger if exists bump_company_generated_document_version on public.company_generated_documents;
create trigger bump_company_generated_document_version
before insert or update on public.company_generated_documents
for each row execute function public.si_bump_generated_document_version();
drop trigger if exists store_company_generated_document_version on public.company_generated_documents;
create trigger store_company_generated_document_version
after insert or update on public.company_generated_documents
for each row execute function public.si_store_generated_document_version();
drop trigger if exists log_company_bucket_runs_history on public.company_bucket_runs;
create trigger log_company_bucket_runs_history
after insert or update or delete on public.company_bucket_runs
for each row execute function public.si_log_history();
drop trigger if exists log_company_permit_trigger_rules_history on public.company_permit_trigger_rules;
create trigger log_company_permit_trigger_rules_history
after insert or update or delete on public.company_permit_trigger_rules
for each row execute function public.si_log_history();
drop trigger if exists log_company_conflict_rules_history on public.company_conflict_rules;
create trigger log_company_conflict_rules_history
after insert or update or delete on public.company_conflict_rules
for each row execute function public.si_log_history();
drop trigger if exists log_company_training_matrix_requirements_history on public.company_training_matrix_requirements;
create trigger log_company_training_matrix_requirements_history
after insert or update or delete on public.company_training_matrix_requirements
for each row execute function public.si_log_history();
drop trigger if exists log_company_conflict_pairs_history on public.company_conflict_pairs;
create trigger log_company_conflict_pairs_history
after insert or update or delete on public.company_conflict_pairs
for each row execute function public.si_log_history();
drop trigger if exists log_company_ai_reviews_history on public.company_ai_reviews;
create trigger log_company_ai_reviews_history
after insert or update or delete on public.company_ai_reviews
for each row execute function public.si_log_history();
drop trigger if exists log_company_generated_documents_history on public.company_generated_documents;
create trigger log_company_generated_documents_history
after insert or update or delete on public.company_generated_documents
for each row execute function public.si_log_history();
drop trigger if exists log_company_risk_scores_history on public.company_risk_scores;
create trigger log_company_risk_scores_history
after insert or update or delete on public.company_risk_scores
for each row execute function public.si_log_history();

create or replace function public.security_can_manage_safety_intelligence(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.security_is_company_manager(target_company_id);
$$;

grant execute on function public.security_can_manage_safety_intelligence(uuid) to authenticated;

alter table public.platform_trades enable row level security;
alter table public.platform_sub_trades enable row level security;
alter table public.platform_task_templates enable row level security;
alter table public.platform_permit_trigger_rules enable row level security;
alter table public.platform_conflict_rules enable row level security;

grant select on public.platform_trades to authenticated;
grant select on public.platform_sub_trades to authenticated;
grant select on public.platform_task_templates to authenticated;
grant select on public.platform_permit_trigger_rules to authenticated;
grant select on public.platform_conflict_rules to authenticated;
grant select, insert, update, delete on public.platform_trades to service_role;
grant select, insert, update, delete on public.platform_sub_trades to service_role;
grant select, insert, update, delete on public.platform_task_templates to service_role;
grant select, insert, update, delete on public.platform_permit_trigger_rules to service_role;
grant select, insert, update, delete on public.platform_conflict_rules to service_role;

drop policy if exists platform_trades_select_all on public.platform_trades;
create policy platform_trades_select_all on public.platform_trades
for select to authenticated using (true);
drop policy if exists platform_sub_trades_select_all on public.platform_sub_trades;
create policy platform_sub_trades_select_all on public.platform_sub_trades
for select to authenticated using (true);
drop policy if exists platform_task_templates_select_all on public.platform_task_templates;
create policy platform_task_templates_select_all on public.platform_task_templates
for select to authenticated using (true);
drop policy if exists platform_permit_trigger_rules_select_all on public.platform_permit_trigger_rules;
create policy platform_permit_trigger_rules_select_all on public.platform_permit_trigger_rules
for select to authenticated using (true);
drop policy if exists platform_conflict_rules_select_all on public.platform_conflict_rules;
create policy platform_conflict_rules_select_all on public.platform_conflict_rules
for select to authenticated using (true);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'company_trades',
    'company_sub_trades',
    'company_tasks',
    'company_hazards',
    'company_controls',
    'company_permits_catalog',
    'company_work_areas',
    'company_weather_conditions',
    'company_task_hazards',
    'company_task_controls',
    'company_task_permit_triggers',
    'company_training_matrix_requirements',
    'company_task_training_requirements',
    'company_bucket_runs',
    'company_bucket_items',
    'company_simultaneous_operations',
    'company_conflict_pairs',
    'company_permit_trigger_rules',
    'company_conflict_rules',
    'company_ai_reviews',
    'company_document_templates',
    'company_generated_documents',
    'company_generated_document_versions',
    'company_safety_intelligence_audit_log',
    'company_safety_intelligence_history',
    'company_risk_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_select_member_scope', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.security_is_company_member(company_id))',
      tbl || '_select_member_scope',
      tbl
    );
  end loop;
end
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'company_trades',
    'company_sub_trades',
    'company_tasks',
    'company_hazards',
    'company_controls',
    'company_permits_catalog',
    'company_permit_trigger_rules',
    'company_work_areas',
    'company_conflict_rules',
    'company_weather_conditions',
    'company_task_hazards',
    'company_task_controls',
    'company_task_permit_triggers',
    'company_training_matrix_requirements',
    'company_task_training_requirements',
    'company_bucket_runs',
    'company_bucket_items',
    'company_simultaneous_operations'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_insert_write_scope', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_update_write_scope', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_delete_write_scope', tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.security_can_write_company_data(company_id))',
      tbl || '_insert_write_scope',
      tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.security_is_company_member(company_id)) with check (public.security_can_write_company_data(company_id))',
      tbl || '_update_write_scope',
      tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.security_can_write_company_data(company_id))',
      tbl || '_delete_write_scope',
      tbl
    );
  end loop;
end
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'company_conflict_pairs',
    'company_ai_reviews',
    'company_document_templates',
    'company_generated_documents',
    'company_generated_document_versions',
    'company_safety_intelligence_audit_log',
    'company_safety_intelligence_history',
    'company_risk_scores'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_insert_manager_scope', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_update_manager_scope', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_delete_manager_scope', tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.security_can_manage_safety_intelligence(company_id))',
      tbl || '_insert_manager_scope',
      tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.security_is_company_member(company_id)) with check (public.security_can_manage_safety_intelligence(company_id))',
      tbl || '_update_manager_scope',
      tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.security_can_manage_safety_intelligence(company_id))',
      tbl || '_delete_manager_scope',
      tbl
    );
  end loop;
end
$$;

drop policy if exists company_safety_intelligence_audit_log_select_member_scope on public.company_safety_intelligence_audit_log;
drop policy if exists company_safety_intelligence_audit_log_select_manager_scope on public.company_safety_intelligence_audit_log;
create policy company_safety_intelligence_audit_log_select_manager_scope on public.company_safety_intelligence_audit_log
for select to authenticated using (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists company_safety_intelligence_history_select_member_scope on public.company_safety_intelligence_history;
drop policy if exists company_safety_intelligence_history_select_manager_scope on public.company_safety_intelligence_history;
create policy company_safety_intelligence_history_select_manager_scope on public.company_safety_intelligence_history
for select to authenticated using (public.security_can_manage_safety_intelligence(company_id));

revoke insert, update, delete on public.company_generated_document_versions from authenticated;
revoke insert, update, delete on public.company_safety_intelligence_audit_log from authenticated;
revoke insert, update, delete on public.company_safety_intelligence_history from authenticated;
grant select on public.company_generated_document_versions to authenticated;
grant select on public.company_safety_intelligence_audit_log to authenticated;
grant select on public.company_safety_intelligence_history to authenticated;
grant select, insert, update, delete on public.company_generated_document_versions to service_role;
grant select, insert, update, delete on public.company_safety_intelligence_audit_log to service_role;
grant select, insert, update, delete on public.company_safety_intelligence_history to service_role;

insert into public.company_tasks (
  company_id,
  jobsite_id,
  source_module,
  source_id,
  title,
  description,
  hazard_families,
  required_controls,
  permit_triggers,
  weather_sensitivity,
  crew_size,
  work_area_label,
  starts_at,
  status,
  metadata,
  created_at,
  updated_at,
  created_by,
  updated_by
)
select
  a.company_id,
  a.jobsite_id,
  'company_jsa_activity',
  a.id,
  a.activity_name,
  a.hazard_description,
  case when coalesce(trim(a.hazard_category), '') = '' then '{}'::text[] else array[lower(replace(trim(a.hazard_category), ' ', '_'))] end,
  case when coalesce(trim(a.mitigation), '') = '' then '{}'::text[] else array[trim(a.mitigation)] end,
  case when a.permit_required and coalesce(trim(a.permit_type), '') <> '' then array[lower(replace(trim(a.permit_type), ' ', '_'))] else '{}'::text[] end,
  case
    when lower(coalesce(a.activity_name, '')) like '%crane%' then 'high'
    when lower(coalesce(a.activity_name, '')) like '%excavat%' then 'high'
    when lower(coalesce(a.activity_name, '')) like '%roof%' then 'high'
    else 'medium'
  end::public.si_weather_sensitivity,
  a.crew_size,
  a.area,
  coalesce(case when a.work_date is not null then a.work_date::timestamptz end, a.created_at),
  case
    when a.status = 'completed' then 'completed'
    when a.status = 'cancelled' then 'cancelled'
    when a.status = 'monitored' then 'active'
    else 'planned'
  end::public.si_task_status,
  jsonb_build_object(
    'planned_risk_level', a.planned_risk_level,
    'trade', a.trade,
    'original_status', a.status
  ),
  a.created_at,
  a.updated_at,
  a.created_by,
  a.updated_by
from public.company_jsa_activities a
where not exists (
  select 1
  from public.company_tasks existing
  where existing.source_module = 'company_jsa_activity'
    and existing.source_id = a.id
);

insert into public.company_bucket_runs (
  company_id,
  jobsite_id,
  source_module,
  source_id,
  run_status,
  intake_payload,
  bucket_summary,
  created_at,
  updated_at,
  created_by,
  updated_by
)
select
  a.company_id,
  a.jobsite_id,
  'company_jsa_activity',
  a.id,
  'bucketed',
  jsonb_build_object(
    'trade', a.trade,
    'activity_name', a.activity_name,
    'area', a.area,
    'crew_size', a.crew_size,
    'hazard_category', a.hazard_category,
    'permit_required', a.permit_required,
    'permit_type', a.permit_type
  ),
  jsonb_build_object(
    'bucket_key', concat('jsa_activity:', a.id::text),
    'source_status', a.status
  ),
  a.created_at,
  a.updated_at,
  a.created_by,
  a.updated_by
from public.company_jsa_activities a
where not exists (
  select 1
  from public.company_bucket_runs r
  where r.source_module = 'company_jsa_activity'
    and r.source_id = a.id
);

insert into public.company_bucket_items (
  company_id,
  jobsite_id,
  bucket_run_id,
  company_task_id,
  source_module,
  source_id,
  bucket_key,
  bucket_type,
  starts_at,
  raw_payload,
  bucket_payload,
  ai_ready,
  created_at,
  updated_at,
  created_by,
  updated_by
)
select
  r.company_id,
  r.jobsite_id,
  r.id,
  t.id,
  'company_jsa_activity',
  a.id,
  concat('jsa_activity:', a.id::text),
  'task_execution',
  coalesce(case when a.work_date is not null then a.work_date::timestamptz end, a.created_at),
  jsonb_build_object(
    'trade', a.trade,
    'activity_name', a.activity_name,
    'area', a.area,
    'hazard_category', a.hazard_category,
    'hazard_description', a.hazard_description,
    'mitigation', a.mitigation,
    'permit_required', a.permit_required,
    'permit_type', a.permit_type
  ),
  jsonb_build_object(
    'trade', a.trade,
    'task', a.activity_name,
    'work_area_label', a.area,
    'hazard_families', case when coalesce(trim(a.hazard_category), '') = '' then '[]'::jsonb else to_jsonb(array[lower(replace(trim(a.hazard_category), ' ', '_'))]) end,
    'required_controls', case when coalesce(trim(a.mitigation), '') = '' then '[]'::jsonb else to_jsonb(array[trim(a.mitigation)]) end,
    'permit_triggers', case when a.permit_required and coalesce(trim(a.permit_type), '') <> '' then to_jsonb(array[lower(replace(trim(a.permit_type), ' ', '_'))]) else '[]'::jsonb end
  ),
  true,
  a.created_at,
  a.updated_at,
  a.created_by,
  a.updated_by
from public.company_jsa_activities a
join public.company_bucket_runs r
  on r.source_module = 'company_jsa_activity'
 and r.source_id = a.id
left join public.company_tasks t
  on t.source_module = 'company_jsa_activity'
 and t.source_id = a.id
where not exists (
  select 1
  from public.company_bucket_items bi
  where bi.source_module = 'company_jsa_activity'
    and bi.source_id = a.id
);
