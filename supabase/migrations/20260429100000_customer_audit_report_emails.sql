alter table public.company_jobsites
add column if not exists customer_report_email text null;

create table if not exists public.company_jobsite_audit_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  audit_id uuid not null references public.company_jobsite_audits(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'queued',
  provider_message_id text null,
  error_message text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  constraint company_jobsite_audit_report_deliveries_status_check check (
    status in ('queued', 'sent', 'skipped', 'failed')
  )
);

create index if not exists company_jobsite_audit_report_deliveries_audit_idx
  on public.company_jobsite_audit_report_deliveries(company_id, audit_id, created_at desc);

create index if not exists company_jobsite_audit_report_deliveries_recipient_idx
  on public.company_jobsite_audit_report_deliveries(company_id, recipient_email, created_at desc);

alter table public.company_jobsite_audit_report_deliveries enable row level security;

grant select, insert, update on public.company_jobsite_audit_report_deliveries to authenticated;

drop policy if exists company_jobsite_audit_report_deliveries_select_scope
on public.company_jobsite_audit_report_deliveries;
create policy company_jobsite_audit_report_deliveries_select_scope
on public.company_jobsite_audit_report_deliveries
for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_audit_report_deliveries_insert_scope
on public.company_jobsite_audit_report_deliveries;
create policy company_jobsite_audit_report_deliveries_insert_scope
on public.company_jobsite_audit_report_deliveries
for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_jobsite_audit_report_deliveries_update_scope
on public.company_jobsite_audit_report_deliveries;
create policy company_jobsite_audit_report_deliveries_update_scope
on public.company_jobsite_audit_report_deliveries
for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));
