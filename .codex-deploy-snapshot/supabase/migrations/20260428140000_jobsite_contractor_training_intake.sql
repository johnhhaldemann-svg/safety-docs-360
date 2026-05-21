create table if not exists public.contractor_employee_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text null,
  email_normalized text null,
  phone text null,
  phone_normalized text null,
  contractor_company_name text null,
  trade_specialty text null,
  job_title text null,
  readiness_status text not null default 'ready',
  years_experience integer null,
  certifications text[] not null default '{}'::text[],
  certification_expirations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint contractor_employee_profiles_name_nonempty check (length(trim(full_name)) > 0),
  constraint contractor_employee_profiles_readiness_check check (
    readiness_status in ('ready', 'travel_ready', 'limited', 'needs_training', 'onboarding')
  ),
  constraint contractor_employee_profiles_years_check check (
    years_experience is null or years_experience >= 0
  )
);

create unique index if not exists contractor_employee_profiles_email_norm_unique
  on public.contractor_employee_profiles(email_normalized)
  where email_normalized is not null and email_normalized <> '';

create unique index if not exists contractor_employee_profiles_phone_norm_unique
  on public.contractor_employee_profiles(phone_normalized)
  where phone_normalized is not null and phone_normalized <> '';

drop trigger if exists set_contractor_employee_profiles_updated_at on public.contractor_employee_profiles;
create trigger set_contractor_employee_profiles_updated_at
before update on public.contractor_employee_profiles
for each row execute function public.set_updated_at();

create table if not exists public.jobsite_contractor_training_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint jobsite_contractor_training_requirements_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists jobsite_contractor_training_requirements_scope_idx
  on public.jobsite_contractor_training_requirements(company_id, jobsite_id, sort_order);

drop trigger if exists set_jobsite_contractor_training_requirements_updated_at on public.jobsite_contractor_training_requirements;
create trigger set_jobsite_contractor_training_requirements_updated_at
before update on public.jobsite_contractor_training_requirements
for each row execute function public.set_updated_at();

create table if not exists public.contractor_employee_jobsite_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  contractor_id uuid null references public.company_contractors(id) on delete set null,
  contractor_employee_id uuid not null references public.contractor_employee_profiles(id) on delete cascade,
  status text not null default 'active',
  archived_at timestamptz null,
  archived_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint contractor_employee_jobsite_assignments_status_check check (status in ('active', 'archived')),
  constraint contractor_employee_jobsite_assignments_unique unique (company_id, jobsite_id, contractor_employee_id)
);

create index if not exists contractor_employee_jobsite_assignments_scope_idx
  on public.contractor_employee_jobsite_assignments(company_id, jobsite_id, status);

drop trigger if exists set_contractor_employee_jobsite_assignments_updated_at on public.contractor_employee_jobsite_assignments;
create trigger set_contractor_employee_jobsite_assignments_updated_at
before update on public.contractor_employee_jobsite_assignments
for each row execute function public.set_updated_at();

create table if not exists public.contractor_employee_training_records (
  id uuid primary key default gen_random_uuid(),
  contractor_employee_id uuid not null references public.contractor_employee_profiles(id) on delete cascade,
  requirement_id uuid null references public.jobsite_contractor_training_requirements(id) on delete set null,
  title text not null,
  completed_on date null,
  expires_on date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint contractor_employee_training_records_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists contractor_employee_training_records_employee_idx
  on public.contractor_employee_training_records(contractor_employee_id, expires_on);

create unique index if not exists contractor_employee_training_records_employee_requirement_unique
  on public.contractor_employee_training_records(contractor_employee_id, requirement_id);

drop trigger if exists set_contractor_employee_training_records_updated_at on public.contractor_employee_training_records;
create trigger set_contractor_employee_training_records_updated_at
before update on public.contractor_employee_training_records
for each row execute function public.set_updated_at();

create table if not exists public.contractor_employee_intake_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  assignment_id uuid not null references public.contractor_employee_jobsite_assignments(id) on delete cascade,
  contractor_employee_id uuid not null references public.contractor_employee_profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists contractor_employee_intake_tokens_assignment_idx
  on public.contractor_employee_intake_tokens(assignment_id, created_at desc);

alter table public.contractor_employee_profiles enable row level security;
alter table public.jobsite_contractor_training_requirements enable row level security;
alter table public.contractor_employee_jobsite_assignments enable row level security;
alter table public.contractor_employee_training_records enable row level security;
alter table public.contractor_employee_intake_tokens enable row level security;

grant select, insert, update on public.contractor_employee_profiles to authenticated;
grant select, insert, update, delete on public.jobsite_contractor_training_requirements to authenticated;
grant select, insert, update on public.contractor_employee_jobsite_assignments to authenticated;
grant select, insert, update on public.contractor_employee_training_records to authenticated;
grant select, insert, update on public.contractor_employee_intake_tokens to authenticated;

drop policy if exists "jobsite_contractor_training_requirements_company_scope" on public.jobsite_contractor_training_requirements;
create policy "jobsite_contractor_training_requirements_company_scope"
on public.jobsite_contractor_training_requirements for all to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships m where m.user_id = auth.uid() and m.company_id = jobsite_contractor_training_requirements.company_id)
  or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.company_id = jobsite_contractor_training_requirements.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships m where m.user_id = auth.uid() and m.company_id = jobsite_contractor_training_requirements.company_id)
  or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.company_id = jobsite_contractor_training_requirements.company_id)
);

drop policy if exists "contractor_employee_jobsite_assignments_company_scope" on public.contractor_employee_jobsite_assignments;
create policy "contractor_employee_jobsite_assignments_company_scope"
on public.contractor_employee_jobsite_assignments for all to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships m where m.user_id = auth.uid() and m.company_id = contractor_employee_jobsite_assignments.company_id)
  or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.company_id = contractor_employee_jobsite_assignments.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships m where m.user_id = auth.uid() and m.company_id = contractor_employee_jobsite_assignments.company_id)
  or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.company_id = contractor_employee_jobsite_assignments.company_id)
);
