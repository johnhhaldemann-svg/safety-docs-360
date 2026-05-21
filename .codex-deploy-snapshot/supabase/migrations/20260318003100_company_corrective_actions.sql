create table if not exists public.company_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  title text not null,
  description text null,
  severity text not null default 'medium',
  status text not null default 'open',
  assigned_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  started_at timestamptz null,
  closed_at timestamptz null,
  manager_override_close boolean not null default false,
  manager_override_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_corrective_actions_status_check check (
    status in ('open', 'in_progress', 'closed')
  ),
  constraint company_corrective_actions_severity_check check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint company_corrective_actions_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists company_corrective_actions_company_status_idx
  on public.company_corrective_actions(company_id, status, updated_at desc);
create index if not exists company_corrective_actions_assignee_idx
  on public.company_corrective_actions(company_id, assigned_user_id, status, due_at);
create index if not exists company_corrective_actions_due_idx
  on public.company_corrective_actions(company_id, due_at)
  where status <> 'closed';

drop trigger if exists set_company_corrective_actions_updated_at on public.company_corrective_actions;
create trigger set_company_corrective_actions_updated_at
before update on public.company_corrective_actions
for each row
execute function public.set_updated_at();

create table if not exists public.company_corrective_action_evidence (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.company_corrective_actions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists company_corrective_action_evidence_action_idx
  on public.company_corrective_action_evidence(action_id, created_at desc);
create index if not exists company_corrective_action_evidence_company_idx
  on public.company_corrective_action_evidence(company_id, created_at desc);

create table if not exists public.company_corrective_action_events (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.company_corrective_actions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null,
  detail text null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists company_corrective_action_events_action_idx
  on public.company_corrective_action_events(action_id, created_at desc);
create index if not exists company_corrective_action_events_company_idx
  on public.company_corrective_action_events(company_id, created_at desc);

alter table public.company_corrective_actions enable row level security;
alter table public.company_corrective_action_evidence enable row level security;
alter table public.company_corrective_action_events enable row level security;

grant select, insert, update on public.company_corrective_actions to authenticated;
grant select, insert on public.company_corrective_action_evidence to authenticated;
grant select, insert on public.company_corrective_action_events to authenticated;

drop policy if exists "corrective_actions_select_company_scope" on public.company_corrective_actions;
create policy "corrective_actions_select_company_scope"
on public.company_corrective_actions
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
);

drop policy if exists "corrective_actions_insert_company_members" on public.company_corrective_actions;
create policy "corrective_actions_insert_company_members"
on public.company_corrective_actions
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
);

drop policy if exists "corrective_actions_update_company_members" on public.company_corrective_actions;
create policy "corrective_actions_update_company_members"
on public.company_corrective_actions
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_actions.company_id
  )
);

drop policy if exists "corrective_evidence_select_company_scope" on public.company_corrective_action_evidence;
create policy "corrective_evidence_select_company_scope"
on public.company_corrective_action_evidence
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_evidence.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_evidence.company_id
  )
);

drop policy if exists "corrective_evidence_insert_company_scope" on public.company_corrective_action_evidence;
create policy "corrective_evidence_insert_company_scope"
on public.company_corrective_action_evidence
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_evidence.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_evidence.company_id
  )
);

drop policy if exists "corrective_events_select_company_scope" on public.company_corrective_action_events;
create policy "corrective_events_select_company_scope"
on public.company_corrective_action_events
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_events.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_events.company_id
  )
);

drop policy if exists "corrective_events_insert_company_scope" on public.company_corrective_action_events;
create policy "corrective_events_insert_company_scope"
on public.company_corrective_action_events
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_events.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_corrective_action_events.company_id
  )
);
