-- AI Risk Action Loop: workflow state + append-only action events.

alter table public.company_risk_ai_recommendations
  add column if not exists status text not null default 'active';

alter table public.company_risk_ai_recommendations
  add column if not exists priority text not null default 'medium';

alter table public.company_risk_ai_recommendations
  add column if not exists owner_user_id uuid null references auth.users (id) on delete set null;

alter table public.company_risk_ai_recommendations
  add column if not exists due_at timestamptz null;

alter table public.company_risk_ai_recommendations
  add column if not exists target_module text null;

alter table public.company_risk_ai_recommendations
  add column if not exists target_href text null;

alter table public.company_risk_ai_recommendations
  add column if not exists evidence_summary jsonb not null default '{}'::jsonb;

alter table public.company_risk_ai_recommendations
  add column if not exists accepted_at timestamptz null;

alter table public.company_risk_ai_recommendations
  add column if not exists field_used_at timestamptz null;

alter table public.company_risk_ai_recommendations
  add column if not exists resolved_at timestamptz null;

alter table public.company_risk_ai_recommendations
  add column if not exists dismissed_at timestamptz null;

alter table public.company_risk_ai_recommendations
  drop constraint if exists company_risk_ai_recommendations_status_check;

alter table public.company_risk_ai_recommendations
  add constraint company_risk_ai_recommendations_status_check check (
    status in ('active', 'accepted', 'assigned', 'field_used', 'resolved', 'dismissed')
  );

alter table public.company_risk_ai_recommendations
  drop constraint if exists company_risk_ai_recommendations_priority_check;

alter table public.company_risk_ai_recommendations
  add constraint company_risk_ai_recommendations_priority_check check (
    priority in ('low', 'medium', 'high', 'critical')
  );

alter table public.company_risk_ai_recommendations
  drop constraint if exists company_risk_ai_recommendations_target_module_check;

alter table public.company_risk_ai_recommendations
  add constraint company_risk_ai_recommendations_target_module_check check (
    target_module is null
    or target_module in (
      'predictive_risk',
      'field_issue',
      'corrective_action',
      'incident',
      'permit',
      'jsa',
      'training',
      'jobsite',
      'risk_memory',
      'command_center'
    )
  );

update public.company_risk_ai_recommendations
set
  status = case
    when dismissed = true then 'dismissed'
    when status is null then 'active'
    else status
  end,
  dismissed_at = case
    when dismissed = true and dismissed_at is null then created_at
    else dismissed_at
  end
where status is null or dismissed = true;

create index if not exists company_risk_ai_recommendations_workflow_idx
  on public.company_risk_ai_recommendations (company_id, status, priority, created_at desc);

create index if not exists company_risk_ai_recommendations_owner_idx
  on public.company_risk_ai_recommendations (company_id, owner_user_id, status)
  where owner_user_id is not null;

create table if not exists public.company_risk_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  recommendation_id uuid not null references public.company_risk_ai_recommendations (id) on delete cascade,
  event_type text not null,
  from_status text null,
  to_status text null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint company_risk_recommendation_events_event_type_check check (
    event_type in ('created', 'accepted', 'assigned', 'field_used', 'resolved', 'dismissed', 'feedback')
  )
);

create index if not exists company_risk_recommendation_events_company_created_idx
  on public.company_risk_recommendation_events (company_id, created_at desc);

create index if not exists company_risk_recommendation_events_recommendation_idx
  on public.company_risk_recommendation_events (recommendation_id, created_at desc);

alter table public.company_risk_recommendation_events enable row level security;

grant select, insert on public.company_risk_recommendation_events to authenticated;

drop policy if exists "company_risk_recommendation_events_select_scope" on public.company_risk_recommendation_events;
create policy "company_risk_recommendation_events_select_scope"
on public.company_risk_recommendation_events
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_recommendation_events.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_recommendation_events.company_id
  )
);

drop policy if exists "company_risk_recommendation_events_insert_scope" on public.company_risk_recommendation_events;
create policy "company_risk_recommendation_events_insert_scope"
on public.company_risk_recommendation_events
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_recommendation_events.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_recommendation_events.company_id
  )
);

comment on column public.company_risk_ai_recommendations.status is
  'AI Risk Action Loop workflow state for supervisor triage and follow-through.';

comment on column public.company_risk_ai_recommendations.evidence_summary is
  'Bounded evidence references and source coverage used to justify the recommendation.';

comment on table public.company_risk_recommendation_events is
  'Append-only audit and learning events for AI risk recommendations.';
