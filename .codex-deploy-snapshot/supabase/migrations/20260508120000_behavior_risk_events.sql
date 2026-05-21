create table if not exists public.behavior_risk_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  trade text null,
  crew_id uuid null references public.company_crews(id) on delete set null,
  supervisor_id uuid null references auth.users(id) on delete set null,
  work_area text null,
  task_name text null,
  source_type text not null,
  source_id uuid null,
  risk_driver text not null,
  risk_points integer not null,
  severity text null,
  recommended_action text null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint behavior_risk_events_source_type_check check (
    source_type in (
      'jsa',
      'permit',
      'training',
      'sor',
      'corrective_action',
      'incident',
      'inspection',
      'schedule',
      'manual_review'
    )
  ),
  constraint behavior_risk_events_risk_driver_check check (
    risk_driver in (
      'weak_jsa_language',
      'missing_critical_control',
      'permit_mismatch',
      'training_gap',
      'repeat_observation',
      'open_corrective_action',
      'missing_supervisor_verification',
      'trade_overlap',
      'schedule_pressure',
      'control_dependency',
      'prior_incident_pattern'
    )
  ),
  constraint behavior_risk_events_status_check check (status in ('open', 'resolved', 'dismissed')),
  constraint behavior_risk_events_points_check check (risk_points >= 0 and risk_points <= 100)
);

create index if not exists behavior_risk_events_company_status_idx
  on public.behavior_risk_events(company_id, status, created_at desc);

create index if not exists behavior_risk_events_jobsite_idx
  on public.behavior_risk_events(company_id, jobsite_id, created_at desc)
  where jobsite_id is not null;

create index if not exists behavior_risk_events_driver_idx
  on public.behavior_risk_events(company_id, risk_driver, created_at desc);

alter table public.behavior_risk_events enable row level security;

grant select, insert, update on public.behavior_risk_events to authenticated;

drop policy if exists "behavior_risk_events_select_scope" on public.behavior_risk_events;
create policy "behavior_risk_events_select_scope"
on public.behavior_risk_events
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
);

drop policy if exists "behavior_risk_events_insert_scope" on public.behavior_risk_events;
create policy "behavior_risk_events_insert_scope"
on public.behavior_risk_events
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
);

drop policy if exists "behavior_risk_events_update_scope" on public.behavior_risk_events;
create policy "behavior_risk_events_update_scope"
on public.behavior_risk_events
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.behavior_risk_events.company_id
  )
);
