do $$
begin
  if not exists (select 1 from pg_type where typname = 'si_ingestion_source_type') then
    create type public.si_ingestion_source_type as enum (
      'sor',
      'jsa',
      'incident_report',
      'corrective_action',
      'permit',
      'observation',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'si_ingestion_validation_status') then
    create type public.si_ingestion_validation_status as enum ('accepted', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'si_ingestion_insert_status') then
    create type public.si_ingestion_insert_status as enum ('pending', 'inserted', 'skipped', 'failed');
  end if;
end
$$;

create table if not exists public.ingestion_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  source_type public.si_ingestion_source_type not null,
  source_record_id text null,
  validation_status public.si_ingestion_validation_status not null,
  insert_status public.si_ingestion_insert_status not null default 'pending',
  validation_errors jsonb not null default '[]'::jsonb,
  raw_payload_hash text not null,
  sanitized_payload jsonb not null default '{}'::jsonb,
  removed_company_tokens text[] not null default '{}'::text[],
  bucket_id uuid null,
  insert_error text null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.safety_data_bucket (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  ingestion_audit_log_id uuid not null references public.ingestion_audit_log(id) on delete restrict,
  source_type public.si_ingestion_source_type not null,
  source_record_id text null,
  title text not null,
  summary text null,
  description text null,
  severity public.si_conflict_severity not null default 'medium',
  trade_code text null,
  category_code text null,
  source_created_at timestamptz not null,
  event_at timestamptz null,
  reported_at timestamptz null,
  due_at timestamptz null,
  valid_from timestamptz null,
  valid_to timestamptz null,
  raw_payload_hash text not null,
  removed_company_tokens text[] not null default '{}'::text[],
  sanitized_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  ai_ready boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint safety_data_bucket_title_nonempty check (length(trim(title)) > 0),
  constraint safety_data_bucket_validity_window_check
    check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index if not exists ingestion_audit_log_company_received_idx
  on public.ingestion_audit_log(company_id, received_at desc);
create index if not exists ingestion_audit_log_company_status_idx
  on public.ingestion_audit_log(company_id, validation_status, insert_status, received_at desc);
create index if not exists ingestion_audit_log_hash_idx
  on public.ingestion_audit_log(raw_payload_hash);
create index if not exists safety_data_bucket_company_created_idx
  on public.safety_data_bucket(company_id, jobsite_id, source_type, created_at desc);
create index if not exists safety_data_bucket_trade_category_idx
  on public.safety_data_bucket(company_id, trade_code, category_code, severity, source_created_at desc);
create index if not exists safety_data_bucket_ai_ready_idx
  on public.safety_data_bucket(company_id, ai_ready, source_created_at desc);
create unique index if not exists safety_data_bucket_source_uidx
  on public.safety_data_bucket(company_id, source_type, coalesce(source_record_id, ''), raw_payload_hash);
create index if not exists ingestion_audit_log_sanitized_payload_gin
  on public.ingestion_audit_log using gin (sanitized_payload);
create index if not exists safety_data_bucket_sanitized_payload_gin
  on public.safety_data_bucket using gin (sanitized_payload);
create index if not exists safety_data_bucket_normalized_payload_gin
  on public.safety_data_bucket using gin (normalized_payload);

drop trigger if exists set_ingestion_audit_log_updated_at on public.ingestion_audit_log;
create trigger set_ingestion_audit_log_updated_at
before update on public.ingestion_audit_log
for each row execute function public.set_updated_at();

drop trigger if exists set_safety_data_bucket_updated_at on public.safety_data_bucket;
create trigger set_safety_data_bucket_updated_at
before update on public.safety_data_bucket
for each row execute function public.set_updated_at();

alter table public.ingestion_audit_log enable row level security;
alter table public.safety_data_bucket enable row level security;

grant select, insert, update on public.ingestion_audit_log to authenticated;
grant select, insert on public.safety_data_bucket to authenticated;
grant select, insert, update, delete on public.ingestion_audit_log to service_role;
grant select, insert, update, delete on public.safety_data_bucket to service_role;

drop policy if exists ingestion_audit_log_select_manager_scope on public.ingestion_audit_log;
create policy ingestion_audit_log_select_manager_scope
on public.ingestion_audit_log
for select
to authenticated
using (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists ingestion_audit_log_insert_company_scope on public.ingestion_audit_log;
create policy ingestion_audit_log_insert_company_scope
on public.ingestion_audit_log
for insert
to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists ingestion_audit_log_update_company_scope on public.ingestion_audit_log;
create policy ingestion_audit_log_update_company_scope
on public.ingestion_audit_log
for update
to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

drop policy if exists ingestion_audit_log_delete_manager_scope on public.ingestion_audit_log;
create policy ingestion_audit_log_delete_manager_scope
on public.ingestion_audit_log
for delete
to authenticated
using (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists safety_data_bucket_select_company_scope on public.safety_data_bucket;
create policy safety_data_bucket_select_company_scope
on public.safety_data_bucket
for select
to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists safety_data_bucket_insert_company_scope on public.safety_data_bucket;
create policy safety_data_bucket_insert_company_scope
on public.safety_data_bucket
for insert
to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists safety_data_bucket_update_manager_scope on public.safety_data_bucket;
create policy safety_data_bucket_update_manager_scope
on public.safety_data_bucket
for update
to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_manage_safety_intelligence(company_id));

drop policy if exists safety_data_bucket_delete_manager_scope on public.safety_data_bucket;
create policy safety_data_bucket_delete_manager_scope
on public.safety_data_bucket
for delete
to authenticated
using (public.security_can_manage_safety_intelligence(company_id));
