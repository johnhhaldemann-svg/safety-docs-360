-- Safety Observations module: main table + audit updates
-- project_id is uuid without FK until a dedicated projects table is introduced

create table if not exists public.safety_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid references public.company_jobsites(id) on delete set null,
  project_id uuid,
  title text not null,
  description text,
  observation_type text not null,
  category text not null,
  subcategory text not null,
  severity text not null default 'Low',
  status text not null default 'Open',
  trade text,
  location text,
  linked_dap_id uuid,
  linked_jsa_id uuid,
  linked_incident_id uuid,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  due_date date,
  closed_at timestamptz,
  photo_urls jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  corrective_action text,
  immediate_action_taken text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_observations_observation_type_check check (
    observation_type in ('Hazard', 'Positive', 'Near_Miss')
  ),
  constraint safety_observations_severity_check check (
    severity in ('Low', 'Medium', 'High', 'Critical')
  ),
  constraint safety_observations_status_check check (
    status in ('Open', 'In Progress', 'Closed')
  ),
  constraint safety_observations_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists safety_observations_company_created_idx
  on public.safety_observations(company_id, created_at desc);
create index if not exists safety_observations_company_status_severity_idx
  on public.safety_observations(company_id, status, severity);
create index if not exists safety_observations_company_type_idx
  on public.safety_observations(company_id, observation_type);
create index if not exists safety_observations_company_category_idx
  on public.safety_observations(company_id, category, subcategory);
create index if not exists safety_observations_jobsite_idx
  on public.safety_observations(jobsite_id)
  where jobsite_id is not null;
create index if not exists safety_observations_assigned_idx
  on public.safety_observations(company_id, assigned_to)
  where assigned_to is not null;

drop trigger if exists set_safety_observations_updated_at on public.safety_observations;
create trigger set_safety_observations_updated_at
before update on public.safety_observations
for each row
execute function public.set_updated_at();

create table if not exists public.safety_observation_updates (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.safety_observations(id) on delete cascade,
  update_type text not null,
  message text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint safety_observation_updates_type_check check (
    update_type in (
      'Comment',
      'Status Change',
      'Corrective Action',
      'Assignment',
      'Closeout'
    )
  )
);

create index if not exists safety_observation_updates_observation_idx
  on public.safety_observation_updates(observation_id, created_at desc);

alter table public.safety_observations enable row level security;
alter table public.safety_observation_updates enable row level security;

grant select, insert, update on public.safety_observations to authenticated;
grant select, insert on public.safety_observation_updates to authenticated;

drop policy if exists "safety_observations_select_company_scope" on public.safety_observations;
create policy "safety_observations_select_company_scope"
on public.safety_observations
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
);

drop policy if exists "safety_observations_insert_company_members" on public.safety_observations;
create policy "safety_observations_insert_company_members"
on public.safety_observations
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
);

drop policy if exists "safety_observations_update_company_members" on public.safety_observations;
create policy "safety_observations_update_company_members"
on public.safety_observations
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.safety_observations.company_id
  )
);

drop policy if exists "safety_observation_updates_select_scope" on public.safety_observation_updates;
create policy "safety_observation_updates_select_scope"
on public.safety_observation_updates
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.safety_observations so
    where so.id = public.safety_observation_updates.observation_id
      and (
        exists (
          select 1 from public.company_memberships m
          where m.user_id = auth.uid() and m.company_id = so.company_id
        )
        or exists (
          select 1 from public.user_roles r
          where r.user_id = auth.uid() and r.company_id = so.company_id
        )
      )
  )
);

drop policy if exists "safety_observation_updates_insert_scope" on public.safety_observation_updates;
create policy "safety_observation_updates_insert_scope"
on public.safety_observation_updates
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.safety_observations so
    where so.id = public.safety_observation_updates.observation_id
      and (
        exists (
          select 1 from public.company_memberships m
          where m.user_id = auth.uid() and m.company_id = so.company_id
        )
        or exists (
          select 1 from public.user_roles r
          where r.user_id = auth.uid() and r.company_id = so.company_id
        )
      )
  )
);
