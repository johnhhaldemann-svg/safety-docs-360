create table if not exists public.company_jobsite_emergency_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  emergency_contact_name text null,
  emergency_contact_phone text null,
  responder_access_instructions text null,
  responder_site_address text null,
  assembly_area text null,
  evacuation_shelter_notes text null,
  aed_location text null,
  first_aid_location text null,
  nearest_medical_name text null,
  nearest_medical_address text null,
  nearest_medical_phone text null,
  notes text null,
  last_reviewed_at timestamptz null,
  last_reviewed_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  constraint company_jobsite_emergency_profiles_unique_jobsite unique (company_id, jobsite_id),
  constraint company_jobsite_emergency_profiles_phone_length_check check (
    emergency_contact_phone is null or length(trim(emergency_contact_phone)) <= 40
  ),
  constraint company_jobsite_emergency_profiles_medical_phone_length_check check (
    nearest_medical_phone is null or length(trim(nearest_medical_phone)) <= 40
  )
);

create index if not exists company_jobsite_emergency_profiles_company_jobsite_idx
on public.company_jobsite_emergency_profiles(company_id, jobsite_id)
where archived_at is null;

drop trigger if exists set_company_jobsite_emergency_profiles_updated_at on public.company_jobsite_emergency_profiles;
create trigger set_company_jobsite_emergency_profiles_updated_at
before update on public.company_jobsite_emergency_profiles
for each row execute function public.set_updated_at();

alter table public.company_jobsite_emergency_profiles enable row level security;

grant select, insert, update, delete on public.company_jobsite_emergency_profiles to authenticated;
grant select, insert, update, delete on public.company_jobsite_emergency_profiles to service_role;

drop policy if exists company_jobsite_emergency_profiles_select_scope on public.company_jobsite_emergency_profiles;
create policy company_jobsite_emergency_profiles_select_scope
on public.company_jobsite_emergency_profiles for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_emergency_profiles_insert_scope on public.company_jobsite_emergency_profiles;
create policy company_jobsite_emergency_profiles_insert_scope
on public.company_jobsite_emergency_profiles for insert to authenticated
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_emergency_profiles.jobsite_id
      and jobsite.company_id = public.company_jobsite_emergency_profiles.company_id
  )
);

drop policy if exists company_jobsite_emergency_profiles_update_scope on public.company_jobsite_emergency_profiles;
create policy company_jobsite_emergency_profiles_update_scope
on public.company_jobsite_emergency_profiles for update to authenticated
using (public.security_is_company_member(company_id))
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_emergency_profiles.jobsite_id
      and jobsite.company_id = public.company_jobsite_emergency_profiles.company_id
  )
);

drop policy if exists company_jobsite_emergency_profiles_delete_scope on public.company_jobsite_emergency_profiles;
create policy company_jobsite_emergency_profiles_delete_scope
on public.company_jobsite_emergency_profiles for delete to authenticated
using (public.security_can_write_company_data(company_id));
