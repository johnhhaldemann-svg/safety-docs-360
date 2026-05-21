begin;

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
