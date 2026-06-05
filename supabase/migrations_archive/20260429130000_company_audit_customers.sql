begin;

create table if not exists public.company_audit_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  report_email text null,
  contact_name text null,
  phone text null,
  notes text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_audit_customers_name_nonempty check (length(trim(name)) > 0),
  constraint company_audit_customers_status_check check (status in ('active', 'archived'))
);

create unique index if not exists company_audit_customers_company_name_unique_ci_idx
  on public.company_audit_customers(company_id, lower(name));

create index if not exists company_audit_customers_company_status_idx
  on public.company_audit_customers(company_id, status, updated_at desc);

drop trigger if exists set_company_audit_customers_updated_at on public.company_audit_customers;
create trigger set_company_audit_customers_updated_at
before update on public.company_audit_customers
for each row execute function public.set_updated_at();

alter table public.company_jobsites
add column if not exists audit_customer_id uuid null references public.company_audit_customers(id) on delete set null;

create index if not exists company_jobsites_audit_customer_idx
  on public.company_jobsites(company_id, audit_customer_id, status);

alter table public.company_audit_customers enable row level security;

grant select, insert, update on public.company_audit_customers to authenticated;
grant select, insert, update, delete on public.company_audit_customers to service_role;

drop policy if exists company_audit_customers_select_scope on public.company_audit_customers;
create policy company_audit_customers_select_scope
on public.company_audit_customers
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_audit_customers_insert_scope on public.company_audit_customers;
create policy company_audit_customers_insert_scope
on public.company_audit_customers
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_audit_customers_update_scope on public.company_audit_customers;
create policy company_audit_customers_update_scope
on public.company_audit_customers
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

insert into public.company_audit_customers (
  company_id,
  name,
  report_email,
  created_by,
  updated_by
)
select distinct on (company_id, lower(trim(customer_company_name)))
  company_id,
  trim(customer_company_name),
  nullif(trim(customer_report_email), ''),
  created_by,
  updated_by
from public.company_jobsites
where nullif(trim(customer_company_name), '') is not null
on conflict (company_id, lower(name)) do nothing;

update public.company_jobsites j
set audit_customer_id = c.id
from public.company_audit_customers c
where j.audit_customer_id is null
  and j.company_id = c.company_id
  and lower(trim(j.customer_company_name)) = lower(trim(c.name));

commit;
