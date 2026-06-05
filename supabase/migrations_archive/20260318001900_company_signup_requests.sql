create table if not exists public.company_signup_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  industry text null,
  phone text null,
  website text null,
  address_line_1 text null,
  city text null,
  state_region text null,
  postal_code text null,
  country text null,
  primary_contact_name text not null,
  primary_contact_email text not null,
  requested_role text not null default 'company_admin',
  account_status text not null default 'pending',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  notes text null,
  constraint company_signup_requests_role_check check (
    requested_role in ('company_owner', 'company_admin')
  ),
  constraint company_signup_requests_account_status_check check (
    account_status in ('pending', 'active', 'suspended')
  ),
  constraint company_signup_requests_status_check check (
    status in ('pending', 'approved', 'rejected')
  )
);

create index if not exists company_signup_requests_status_created_at_idx
  on public.company_signup_requests(status, created_at desc);

drop trigger if exists set_company_signup_requests_updated_at on public.company_signup_requests;
create trigger set_company_signup_requests_updated_at
before update on public.company_signup_requests
for each row
execute function public.set_updated_at();

alter table public.company_signup_requests enable row level security;

drop policy if exists "company_signup_requests_public_insert" on public.company_signup_requests;
create policy "company_signup_requests_public_insert"
on public.company_signup_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "company_signup_requests_admin_select" on public.company_signup_requests;
create policy "company_signup_requests_admin_select"
on public.company_signup_requests
for select
to authenticated
using (public.is_admin_role());
