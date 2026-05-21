create table if not exists public.company_audit_customer_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_customer_id uuid not null references public.company_audit_customers(id) on delete cascade,
  name text not null,
  project_number text null,
  location text null,
  report_email text null,
  status text not null default 'active',
  project_manager text null,
  safety_lead text null,
  start_date date null,
  end_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_audit_customer_locations_name_nonempty check (length(trim(name)) > 0),
  constraint company_audit_customer_locations_status_check check (status in ('planned', 'active', 'completed', 'archived'))
);

create unique index if not exists company_audit_customer_locations_customer_name_unique_ci_idx
  on public.company_audit_customer_locations(company_id, audit_customer_id, lower(name));

create index if not exists company_audit_customer_locations_company_customer_idx
  on public.company_audit_customer_locations(company_id, audit_customer_id, status, updated_at desc);

drop trigger if exists set_company_audit_customer_locations_updated_at on public.company_audit_customer_locations;
create trigger set_company_audit_customer_locations_updated_at
before update on public.company_audit_customer_locations
for each row execute function public.set_updated_at();

alter table public.company_audit_customer_locations enable row level security;

grant select, insert, update on public.company_audit_customer_locations to authenticated;
grant select, insert, update, delete on public.company_audit_customer_locations to service_role;

drop policy if exists company_audit_customer_locations_select_scope on public.company_audit_customer_locations;
create policy company_audit_customer_locations_select_scope
on public.company_audit_customer_locations
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_audit_customer_locations_insert_scope on public.company_audit_customer_locations;
create policy company_audit_customer_locations_insert_scope
on public.company_audit_customer_locations
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_audit_customer_locations_update_scope on public.company_audit_customer_locations;
create policy company_audit_customer_locations_update_scope
on public.company_audit_customer_locations
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

alter table public.company_jobsite_audits
add column if not exists audit_customer_id uuid null references public.company_audit_customers(id) on delete set null,
add column if not exists audit_customer_location_id uuid null references public.company_audit_customer_locations(id) on delete set null;

create index if not exists company_jobsite_audits_audit_customer_idx
  on public.company_jobsite_audits(company_id, audit_customer_id, audit_customer_location_id, created_at desc);

insert into public.company_audit_customer_locations (
  company_id,
  audit_customer_id,
  name,
  project_number,
  location,
  report_email,
  status,
  project_manager,
  safety_lead,
  start_date,
  end_date,
  notes,
  created_by,
  updated_by
)
select
  j.company_id,
  j.audit_customer_id,
  j.name,
  j.project_number,
  j.location,
  j.customer_report_email,
  j.status,
  j.project_manager,
  j.safety_lead,
  j.start_date,
  j.end_date,
  j.notes,
  j.created_by,
  j.updated_by
from public.company_jobsites j
where j.audit_customer_id is not null
on conflict (company_id, audit_customer_id, lower(name)) do nothing;
