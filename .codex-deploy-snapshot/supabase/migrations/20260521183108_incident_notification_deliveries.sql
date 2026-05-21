alter table public.company_incidents
  add column if not exists idlh_flag boolean not null default false;

alter table public.company_safety_submissions
  add column if not exists fatality boolean not null default false,
  add column if not exists idlh_flag boolean not null default false,
  add column if not exists sif_flag boolean not null default false,
  add column if not exists stop_work_status text not null default 'normal';

alter table public.company_safety_submissions
  drop constraint if exists company_safety_submissions_stop_work_status_check;
alter table public.company_safety_submissions
  add constraint company_safety_submissions_stop_work_status_check
  check (stop_work_status in ('normal', 'stop_work_requested', 'stop_work_active', 'cleared'));

create table if not exists public.incident_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text null,
  channel text not null,
  status text not null default 'pending',
  provider_message_id text null,
  error_message text null,
  dedupe_key text not null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_notification_deliveries_source_check check (
    source_table in ('company_incidents', 'company_safety_submissions')
  ),
  constraint incident_notification_deliveries_channel_check check (channel in ('in_app', 'email')),
  constraint incident_notification_deliveries_status_check check (status in ('pending', 'sent', 'skipped', 'failed')),
  constraint incident_notification_deliveries_dedupe_unique unique (dedupe_key)
);

create index if not exists incident_notification_deliveries_company_idx
  on public.incident_notification_deliveries(company_id, source_table, source_id, created_at desc);

create index if not exists incident_notification_deliveries_recipient_idx
  on public.incident_notification_deliveries(recipient_user_id, company_id, created_at desc);

create index if not exists incident_notification_deliveries_status_idx
  on public.incident_notification_deliveries(company_id, status, created_at desc);

drop trigger if exists set_incident_notification_deliveries_updated_at
  on public.incident_notification_deliveries;
create trigger set_incident_notification_deliveries_updated_at
before update on public.incident_notification_deliveries
for each row execute function public.set_updated_at();

alter table public.incident_notification_deliveries enable row level security;

grant select on public.incident_notification_deliveries to authenticated;
grant select, insert, update, delete on public.incident_notification_deliveries to service_role;

drop policy if exists "incident_notification_deliveries_select_scope"
  on public.incident_notification_deliveries;
create policy "incident_notification_deliveries_select_scope"
on public.incident_notification_deliveries for select to authenticated
using (
  recipient_user_id = auth.uid()
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.incident_notification_deliveries.company_id
      and actor.status = 'active'
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.incident_notification_deliveries.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
);
