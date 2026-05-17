-- Company onboarding tracked employees.
--
-- These employees are company roster records only. They never create auth users,
-- company_memberships, company_invites, or seat/license usage.

create table if not exists public.company_employee_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  external_employee_id text null,
  full_name text not null,
  email text null,
  email_normalized text null,
  phone text null,
  phone_normalized text null,
  job_title text null,
  trade_specialty text null,
  readiness_status text not null default 'ready',
  years_experience integer null,
  status text not null default 'active',
  certifications text[] not null default '{}'::text[],
  certification_expirations jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  archived_at timestamptz null,
  archived_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_employee_profiles_name_nonempty check (length(trim(full_name)) > 0),
  constraint company_employee_profiles_readiness_check check (
    readiness_status in ('ready', 'travel_ready', 'limited', 'needs_training', 'onboarding')
  ),
  constraint company_employee_profiles_status_check check (
    status in ('active', 'inactive', 'archived')
  ),
  constraint company_employee_profiles_years_check check (
    years_experience is null or years_experience >= 0
  )
);

create index if not exists company_employee_profiles_company_status_idx
  on public.company_employee_profiles(company_id, status, full_name);

create unique index if not exists company_employee_profiles_company_external_id_unique
  on public.company_employee_profiles(company_id, external_employee_id)
  where external_employee_id is not null and external_employee_id <> '';

create unique index if not exists company_employee_profiles_company_email_unique
  on public.company_employee_profiles(company_id, email_normalized)
  where email_normalized is not null and email_normalized <> '';

drop trigger if exists set_company_employee_profiles_updated_at on public.company_employee_profiles;
create trigger set_company_employee_profiles_updated_at
before update on public.company_employee_profiles
for each row execute function public.set_updated_at();

create table if not exists public.company_employee_jobsite_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.company_employee_profiles(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  status text not null default 'active',
  archived_at timestamptz null,
  archived_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_employee_jobsite_assignments_status_check check (status in ('active', 'archived'))
);

create index if not exists company_employee_jobsite_assignments_company_jobsite_idx
  on public.company_employee_jobsite_assignments(company_id, jobsite_id, status);

create index if not exists company_employee_jobsite_assignments_employee_idx
  on public.company_employee_jobsite_assignments(employee_id, status);

create unique index if not exists company_employee_jobsite_assignments_active_unique
  on public.company_employee_jobsite_assignments(company_id, employee_id, jobsite_id)
  where status = 'active';

drop trigger if exists set_company_employee_jobsite_assignments_updated_at on public.company_employee_jobsite_assignments;
create trigger set_company_employee_jobsite_assignments_updated_at
before update on public.company_employee_jobsite_assignments
for each row execute function public.set_updated_at();

create table if not exists public.company_employee_training_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.company_employee_profiles(id) on delete cascade,
  requirement_id uuid null references public.company_training_requirements(id) on delete set null,
  title text not null,
  completed_on date null,
  expires_on date null,
  provider text null,
  source text not null default 'manual',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_employee_training_records_title_nonempty check (length(trim(title)) > 0),
  constraint company_employee_training_records_date_order check (
    expires_on is null or completed_on is null or expires_on >= completed_on
  )
);

create index if not exists company_employee_training_records_employee_idx
  on public.company_employee_training_records(company_id, employee_id, expires_on);

create index if not exists company_employee_training_records_requirement_idx
  on public.company_employee_training_records(company_id, requirement_id);

drop trigger if exists set_company_employee_training_records_updated_at on public.company_employee_training_records;
create trigger set_company_employee_training_records_updated_at
before update on public.company_employee_training_records
for each row execute function public.set_updated_at();

create table if not exists public.company_onboarding_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  import_type text not null,
  source text not null default 'manual_upload',
  entity_counts jsonb not null default '{}'::jsonb,
  accepted_count integer not null default 0,
  skipped_count integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_onboarding_imports_type_check check (
    import_type in ('employees', 'jobsites', 'training_records', 'mixed')
  ),
  constraint company_onboarding_imports_counts_check check (
    accepted_count >= 0 and skipped_count >= 0
  )
);

create index if not exists company_onboarding_imports_company_created_idx
  on public.company_onboarding_imports(company_id, created_at desc);

alter table public.company_employee_profiles enable row level security;
alter table public.company_employee_jobsite_assignments enable row level security;
alter table public.company_employee_training_records enable row level security;
alter table public.company_onboarding_imports enable row level security;

grant select, insert, update, delete on public.company_employee_profiles to authenticated;
grant select, insert, update, delete on public.company_employee_jobsite_assignments to authenticated;
grant select, insert, update, delete on public.company_employee_training_records to authenticated;
grant select, insert, update, delete on public.company_onboarding_imports to authenticated;

drop policy if exists "company_employee_profiles_select_company_scope" on public.company_employee_profiles;
create policy "company_employee_profiles_select_company_scope"
on public.company_employee_profiles
for select
to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists "company_employee_profiles_insert_manager_scope" on public.company_employee_profiles;
create policy "company_employee_profiles_insert_manager_scope"
on public.company_employee_profiles
for insert
to authenticated
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_profiles_update_manager_scope" on public.company_employee_profiles;
create policy "company_employee_profiles_update_manager_scope"
on public.company_employee_profiles
for update
to authenticated
using (public.security_is_company_manager(company_id))
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_profiles_delete_manager_scope" on public.company_employee_profiles;
create policy "company_employee_profiles_delete_manager_scope"
on public.company_employee_profiles
for delete
to authenticated
using (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_jobsite_assignments_select_company_scope" on public.company_employee_jobsite_assignments;
create policy "company_employee_jobsite_assignments_select_company_scope"
on public.company_employee_jobsite_assignments
for select
to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists "company_employee_jobsite_assignments_insert_manager_scope" on public.company_employee_jobsite_assignments;
create policy "company_employee_jobsite_assignments_insert_manager_scope"
on public.company_employee_jobsite_assignments
for insert
to authenticated
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_jobsite_assignments_update_manager_scope" on public.company_employee_jobsite_assignments;
create policy "company_employee_jobsite_assignments_update_manager_scope"
on public.company_employee_jobsite_assignments
for update
to authenticated
using (public.security_is_company_manager(company_id))
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_jobsite_assignments_delete_manager_scope" on public.company_employee_jobsite_assignments;
create policy "company_employee_jobsite_assignments_delete_manager_scope"
on public.company_employee_jobsite_assignments
for delete
to authenticated
using (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_training_records_select_company_scope" on public.company_employee_training_records;
create policy "company_employee_training_records_select_company_scope"
on public.company_employee_training_records
for select
to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists "company_employee_training_records_insert_manager_scope" on public.company_employee_training_records;
create policy "company_employee_training_records_insert_manager_scope"
on public.company_employee_training_records
for insert
to authenticated
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_training_records_update_manager_scope" on public.company_employee_training_records;
create policy "company_employee_training_records_update_manager_scope"
on public.company_employee_training_records
for update
to authenticated
using (public.security_is_company_manager(company_id))
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_employee_training_records_delete_manager_scope" on public.company_employee_training_records;
create policy "company_employee_training_records_delete_manager_scope"
on public.company_employee_training_records
for delete
to authenticated
using (public.security_is_company_manager(company_id));

drop policy if exists "company_onboarding_imports_select_company_scope" on public.company_onboarding_imports;
create policy "company_onboarding_imports_select_company_scope"
on public.company_onboarding_imports
for select
to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists "company_onboarding_imports_insert_manager_scope" on public.company_onboarding_imports;
create policy "company_onboarding_imports_insert_manager_scope"
on public.company_onboarding_imports
for insert
to authenticated
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_onboarding_imports_update_manager_scope" on public.company_onboarding_imports;
create policy "company_onboarding_imports_update_manager_scope"
on public.company_onboarding_imports
for update
to authenticated
using (public.security_is_company_manager(company_id))
with check (public.security_is_company_manager(company_id));

drop policy if exists "company_onboarding_imports_delete_manager_scope" on public.company_onboarding_imports;
create policy "company_onboarding_imports_delete_manager_scope"
on public.company_onboarding_imports
for delete
to authenticated
using (public.security_is_company_manager(company_id));
