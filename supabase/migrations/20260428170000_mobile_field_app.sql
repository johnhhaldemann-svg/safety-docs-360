begin;

create table if not exists public.company_mobile_feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  feature text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_mobile_feature_entitlements_feature_check check (
    feature in (
      'mobile_dashboard',
      'mobile_jsa',
      'mobile_field_issues',
      'mobile_field_audits',
      'mobile_photos',
      'mobile_signatures'
    )
  ),
  constraint company_mobile_feature_entitlements_unique unique (company_id, user_id, feature)
);

alter table public.company_jsas
drop constraint if exists company_jsas_status_check;
alter table public.company_jsas
add constraint company_jsas_status_check check (
  status in ('draft', 'pending_review', 'active', 'closed', 'archived')
);

alter table public.company_jobsite_audits
drop constraint if exists company_jobsite_audits_status_check;
alter table public.company_jobsite_audits
add constraint company_jobsite_audits_status_check check (
  status in ('draft', 'pending_review', 'submitted', 'archived')
);

create index if not exists company_mobile_feature_entitlements_scope_idx
  on public.company_mobile_feature_entitlements(company_id, user_id, feature);

drop trigger if exists set_company_mobile_feature_entitlements_updated_at on public.company_mobile_feature_entitlements;
create trigger set_company_mobile_feature_entitlements_updated_at
before update on public.company_mobile_feature_entitlements
for each row execute function public.set_updated_at();

alter table public.company_mobile_feature_entitlements enable row level security;
grant select, insert, update, delete on public.company_mobile_feature_entitlements to authenticated;

drop policy if exists company_mobile_feature_entitlements_select_scope on public.company_mobile_feature_entitlements;
create policy company_mobile_feature_entitlements_select_scope
on public.company_mobile_feature_entitlements
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_mobile_feature_entitlements_mutate_scope on public.company_mobile_feature_entitlements;
create policy company_mobile_feature_entitlements_mutate_scope
on public.company_mobile_feature_entitlements
for all to authenticated
using (public.security_can_write_company_data(company_id))
with check (public.security_can_write_company_data(company_id));

create table if not exists public.company_jsa_signoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jsa_id uuid not null references public.company_jsas(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  signed_by uuid null references auth.users(id) on delete set null,
  crew_acknowledged boolean not null default false,
  supervisor_reviewed boolean not null default false,
  signature_text text null,
  signature_image_path text null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_jsa_signoffs_unique unique (company_id, jsa_id, signed_by)
);

create index if not exists company_jsa_signoffs_jsa_idx
  on public.company_jsa_signoffs(company_id, jsa_id, signed_at desc);

create table if not exists public.company_jsa_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jsa_id uuid not null references public.company_jsas(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  file_path text not null,
  file_name text not null,
  mime_type text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists company_jsa_evidence_jsa_idx
  on public.company_jsa_evidence(company_id, jsa_id, created_at desc);

alter table public.company_jsa_evidence enable row level security;
grant select, insert on public.company_jsa_evidence to authenticated;

drop policy if exists company_jsa_evidence_select_scope on public.company_jsa_evidence;
create policy company_jsa_evidence_select_scope
on public.company_jsa_evidence
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jsa_evidence_insert_scope on public.company_jsa_evidence;
create policy company_jsa_evidence_insert_scope
on public.company_jsa_evidence
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop trigger if exists set_company_jsa_signoffs_updated_at on public.company_jsa_signoffs;
create trigger set_company_jsa_signoffs_updated_at
before update on public.company_jsa_signoffs
for each row execute function public.set_updated_at();

alter table public.company_jsa_signoffs enable row level security;
grant select, insert, update on public.company_jsa_signoffs to authenticated;

drop policy if exists company_jsa_signoffs_select_scope on public.company_jsa_signoffs;
create policy company_jsa_signoffs_select_scope
on public.company_jsa_signoffs
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jsa_signoffs_insert_scope on public.company_jsa_signoffs;
create policy company_jsa_signoffs_insert_scope
on public.company_jsa_signoffs
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_jsa_signoffs_update_scope on public.company_jsa_signoffs;
create policy company_jsa_signoffs_update_scope
on public.company_jsa_signoffs
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

create table if not exists public.company_jobsite_audit_observation_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_id uuid not null references public.company_jobsite_audits(id) on delete cascade,
  observation_id uuid not null references public.company_jobsite_audit_observations(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  file_path text not null,
  file_name text not null,
  mime_type text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists company_jobsite_audit_observation_evidence_obs_idx
  on public.company_jobsite_audit_observation_evidence(company_id, observation_id, created_at desc);

alter table public.company_jobsite_audit_observation_evidence enable row level security;
grant select, insert on public.company_jobsite_audit_observation_evidence to authenticated;

drop policy if exists company_jobsite_audit_observation_evidence_select_scope on public.company_jobsite_audit_observation_evidence;
create policy company_jobsite_audit_observation_evidence_select_scope
on public.company_jobsite_audit_observation_evidence
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_audit_observation_evidence_insert_scope on public.company_jobsite_audit_observation_evidence;
create policy company_jobsite_audit_observation_evidence_insert_scope
on public.company_jobsite_audit_observation_evidence
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

create table if not exists public.company_jobsite_audit_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_id uuid not null references public.company_jobsite_audits(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  file_path text not null,
  file_name text not null,
  mime_type text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists company_jobsite_audit_evidence_audit_idx
  on public.company_jobsite_audit_evidence(company_id, audit_id, created_at desc);

alter table public.company_jobsite_audit_evidence enable row level security;
grant select, insert on public.company_jobsite_audit_evidence to authenticated;

drop policy if exists company_jobsite_audit_evidence_select_scope on public.company_jobsite_audit_evidence;
create policy company_jobsite_audit_evidence_select_scope
on public.company_jobsite_audit_evidence
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_audit_evidence_insert_scope on public.company_jobsite_audit_evidence;
create policy company_jobsite_audit_evidence_insert_scope
on public.company_jobsite_audit_evidence
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

create table if not exists public.company_jobsite_audit_signoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_id uuid not null references public.company_jobsite_audits(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  signed_by uuid null references auth.users(id) on delete set null,
  signature_text text not null,
  signature_image_path text null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_jobsite_audit_signoffs_unique unique (company_id, audit_id, signed_by)
);

create index if not exists company_jobsite_audit_signoffs_audit_idx
  on public.company_jobsite_audit_signoffs(company_id, audit_id, signed_at desc);

drop trigger if exists set_company_jobsite_audit_signoffs_updated_at on public.company_jobsite_audit_signoffs;
create trigger set_company_jobsite_audit_signoffs_updated_at
before update on public.company_jobsite_audit_signoffs
for each row execute function public.set_updated_at();

alter table public.company_jobsite_audit_signoffs enable row level security;
grant select, insert, update on public.company_jobsite_audit_signoffs to authenticated;

drop policy if exists company_jobsite_audit_signoffs_select_scope on public.company_jobsite_audit_signoffs;
create policy company_jobsite_audit_signoffs_select_scope
on public.company_jobsite_audit_signoffs
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_audit_signoffs_insert_scope on public.company_jobsite_audit_signoffs;
create policy company_jobsite_audit_signoffs_insert_scope
on public.company_jobsite_audit_signoffs
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_jobsite_audit_signoffs_update_scope on public.company_jobsite_audit_signoffs;
create policy company_jobsite_audit_signoffs_update_scope
on public.company_jobsite_audit_signoffs
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

commit;
