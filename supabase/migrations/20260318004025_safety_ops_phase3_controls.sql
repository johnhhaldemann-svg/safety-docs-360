alter table public.company_permits
  add column if not exists sif_flag boolean not null default false,
  add column if not exists escalation_level text not null default 'none',
  add column if not exists escalation_reason text null,
  add column if not exists stop_work_status text not null default 'normal',
  add column if not exists stop_work_reason text null,
  add column if not exists escalated_at timestamptz null,
  add column if not exists stop_work_at timestamptz null;

alter table public.company_incidents
  add column if not exists sif_flag boolean not null default false,
  add column if not exists escalation_level text not null default 'none',
  add column if not exists escalation_reason text null,
  add column if not exists stop_work_status text not null default 'normal',
  add column if not exists stop_work_reason text null,
  add column if not exists escalated_at timestamptz null,
  add column if not exists stop_work_at timestamptz null,
  add column if not exists converted_from_submission_id uuid null references public.company_safety_submissions(id) on delete set null;

alter table public.company_permits
  drop constraint if exists company_permits_escalation_level_check;
alter table public.company_permits
  add constraint company_permits_escalation_level_check
  check (escalation_level in ('none', 'monitor', 'urgent', 'critical'));

alter table public.company_permits
  drop constraint if exists company_permits_stop_work_status_check;
alter table public.company_permits
  add constraint company_permits_stop_work_status_check
  check (stop_work_status in ('normal', 'stop_work_requested', 'stop_work_active', 'cleared'));

alter table public.company_incidents
  drop constraint if exists company_incidents_escalation_level_check;
alter table public.company_incidents
  add constraint company_incidents_escalation_level_check
  check (escalation_level in ('none', 'monitor', 'urgent', 'critical'));

alter table public.company_incidents
  drop constraint if exists company_incidents_stop_work_status_check;
alter table public.company_incidents
  add constraint company_incidents_stop_work_status_check
  check (stop_work_status in ('normal', 'stop_work_requested', 'stop_work_active', 'cleared'));

create table if not exists public.company_risk_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module_name text not null,
  record_id uuid not null,
  event_type text not null,
  detail text null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_risk_events_module_check check (module_name in ('permits', 'incidents', 'corrective_actions'))
);

create index if not exists company_permits_sif_idx
  on public.company_permits(company_id, sif_flag, escalation_level, updated_at desc);
create index if not exists company_incidents_sif_idx
  on public.company_incidents(company_id, sif_flag, escalation_level, updated_at desc);
create index if not exists company_risk_events_scope_idx
  on public.company_risk_events(company_id, module_name, created_at desc);

alter table public.company_risk_events enable row level security;
grant select, insert on public.company_risk_events to authenticated;

drop policy if exists "company_risk_events_select_scope" on public.company_risk_events;
create policy "company_risk_events_select_scope"
on public.company_risk_events
for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_risk_events.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_risk_events.company_id)
);

drop policy if exists "company_risk_events_insert_scope" on public.company_risk_events;
create policy "company_risk_events_insert_scope"
on public.company_risk_events
for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_risk_events.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_risk_events.company_id)
);
