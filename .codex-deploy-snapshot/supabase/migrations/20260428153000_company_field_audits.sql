-- Company-facing field audits with itemized observations for Safety Intelligence.

create table if not exists public.company_jobsite_audits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  audit_date date null,
  auditors text,
  selected_trade text not null default 'general_contractor',
  template_source text not null default 'built_in',
  status text not null default 'submitted',
  score_summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_by uuid null references auth.users(id) on delete set null,
  constraint company_jobsite_audits_status_check check (status in ('draft', 'submitted', 'archived')),
  constraint company_jobsite_audits_template_source_check check (template_source in ('field', 'hs', 'env', 'mixed', 'built_in'))
);

create index if not exists company_jobsite_audits_scope_idx
  on public.company_jobsite_audits(company_id, jobsite_id, audit_date desc, created_at desc);

create index if not exists company_jobsite_audits_trade_idx
  on public.company_jobsite_audits(company_id, selected_trade, created_at desc);

drop trigger if exists set_company_jobsite_audits_updated_at on public.company_jobsite_audits;
create trigger set_company_jobsite_audits_updated_at
before update on public.company_jobsite_audits
for each row execute function public.set_updated_at();

create table if not exists public.company_jobsite_audit_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_id uuid not null references public.company_jobsite_audits(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  source_key text not null,
  template_source text not null,
  trade_code text null,
  sub_trade_code text null,
  task_code text null,
  category_code text null,
  category_label text null,
  item_label text not null,
  status text not null,
  severity text not null default 'medium',
  notes text null,
  photo_count integer not null default 0,
  evidence_metadata jsonb not null default '{}'::jsonb,
  corrective_action_id uuid null references public.company_corrective_actions(id) on delete set null,
  ai_bucket_id uuid null references public.safety_data_bucket(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_jobsite_audit_observations_status_check check (status in ('pass', 'fail', 'na')),
  constraint company_jobsite_audit_observations_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint company_jobsite_audit_observations_photo_count_check check (photo_count >= 0),
  constraint company_jobsite_audit_observations_item_label_nonempty check (length(trim(item_label)) > 0),
  constraint company_jobsite_audit_observations_source_unique unique (audit_id, source_key)
);

create index if not exists company_jobsite_audit_observations_scope_idx
  on public.company_jobsite_audit_observations(company_id, jobsite_id, status, created_at desc);

create index if not exists company_jobsite_audit_observations_trade_idx
  on public.company_jobsite_audit_observations(company_id, trade_code, category_code, severity, created_at desc);

drop trigger if exists set_company_jobsite_audit_observations_updated_at on public.company_jobsite_audit_observations;
create trigger set_company_jobsite_audit_observations_updated_at
before update on public.company_jobsite_audit_observations
for each row execute function public.set_updated_at();

create or replace function public.security_can_submit_company_field_audit(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'company_admin',
          'manager',
          'safety_manager',
          'project_manager',
          'field_supervisor',
          'foreman',
          'field_user',
          'read_only',
          'company_user'
        )
    );
$$;

alter table public.company_jobsite_audits enable row level security;
alter table public.company_jobsite_audit_observations enable row level security;

grant select, insert, update on public.company_jobsite_audits to authenticated;
grant select, insert, update on public.company_jobsite_audit_observations to authenticated;
grant select, insert, update, delete on public.company_jobsite_audits to service_role;
grant select, insert, update, delete on public.company_jobsite_audit_observations to service_role;

drop policy if exists company_jobsite_audits_select_scope on public.company_jobsite_audits;
create policy company_jobsite_audits_select_scope
on public.company_jobsite_audits
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_audits_insert_scope on public.company_jobsite_audits;
create policy company_jobsite_audits_insert_scope
on public.company_jobsite_audits
for insert to authenticated
with check (public.security_can_submit_company_field_audit(company_id));

drop policy if exists company_jobsite_audits_update_scope on public.company_jobsite_audits;
create policy company_jobsite_audits_update_scope
on public.company_jobsite_audits
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_submit_company_field_audit(company_id));

drop policy if exists company_jobsite_audit_observations_select_scope on public.company_jobsite_audit_observations;
create policy company_jobsite_audit_observations_select_scope
on public.company_jobsite_audit_observations
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_audit_observations_insert_scope on public.company_jobsite_audit_observations;
create policy company_jobsite_audit_observations_insert_scope
on public.company_jobsite_audit_observations
for insert to authenticated
with check (public.security_can_submit_company_field_audit(company_id));

drop policy if exists company_jobsite_audit_observations_update_scope on public.company_jobsite_audit_observations;
create policy company_jobsite_audit_observations_update_scope
on public.company_jobsite_audit_observations
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_submit_company_field_audit(company_id));
