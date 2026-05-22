create table if not exists public.gus_planning_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  work_type text not null,
  detected_modules jsonb not null default '[]'::jsonb,
  task_description text null,
  status text not null default 'draft_incomplete',
  plan_data jsonb not null default '{}'::jsonb,
  missing_items jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  human_review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gus_planning_sessions_work_type_nonempty check (length(trim(work_type)) > 0),
  constraint gus_planning_sessions_status_check check (
    status in (
      'draft_incomplete',
      'draft_ready_for_review',
      'needs_supervisor_review',
      'needs_competent_person_review',
      'needs_qualified_person_review',
      'blocked_missing_critical_info'
    )
  ),
  constraint gus_planning_sessions_detected_modules_array check (jsonb_typeof(detected_modules) = 'array'),
  constraint gus_planning_sessions_plan_data_object check (jsonb_typeof(plan_data) = 'object'),
  constraint gus_planning_sessions_missing_items_array check (jsonb_typeof(missing_items) = 'array'),
  constraint gus_planning_sessions_risk_flags_array check (jsonb_typeof(risk_flags) = 'array'),
  constraint gus_planning_sessions_has_owner_scope check (company_id is not null or user_id is not null),
  constraint gus_planning_sessions_jobsite_requires_company check (jobsite_id is null or company_id is not null)
);

create table if not exists public.gus_planning_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.gus_planning_sessions(id) on delete cascade,
  role text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint gus_planning_messages_role_check check (role in ('user', 'gus', 'assistant', 'system')),
  constraint gus_planning_messages_message_nonempty check (length(trim(message)) > 0),
  constraint gus_planning_messages_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.gus_generated_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.gus_planning_sessions(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  plan_type text not null,
  plan_title text not null,
  plan_content jsonb not null,
  status text not null default 'draft_incomplete',
  human_review_required boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gus_generated_plans_plan_type_nonempty check (length(trim(plan_type)) > 0),
  constraint gus_generated_plans_plan_title_nonempty check (length(trim(plan_title)) > 0),
  constraint gus_generated_plans_plan_content_object check (jsonb_typeof(plan_content) = 'object'),
  constraint gus_generated_plans_status_check check (
    status in (
      'draft_incomplete',
      'draft_ready_for_review',
      'needs_supervisor_review',
      'needs_competent_person_review',
      'needs_qualified_person_review',
      'blocked_missing_critical_info'
    )
  ),
  constraint gus_generated_plans_jobsite_requires_company check (jobsite_id is null or company_id is not null)
);

create index if not exists gus_planning_sessions_company_created_idx
  on public.gus_planning_sessions(company_id, created_at desc)
  where company_id is not null;

create index if not exists gus_planning_sessions_jobsite_created_idx
  on public.gus_planning_sessions(jobsite_id, created_at desc)
  where jobsite_id is not null;

create index if not exists gus_planning_sessions_user_created_idx
  on public.gus_planning_sessions(user_id, created_at desc)
  where user_id is not null;

create index if not exists gus_planning_messages_session_created_idx
  on public.gus_planning_messages(session_id, created_at);

create index if not exists gus_generated_plans_session_created_idx
  on public.gus_generated_plans(session_id, created_at desc);

create index if not exists gus_generated_plans_company_created_idx
  on public.gus_generated_plans(company_id, created_at desc)
  where company_id is not null;

drop trigger if exists set_gus_planning_sessions_updated_at on public.gus_planning_sessions;
create trigger set_gus_planning_sessions_updated_at
before update on public.gus_planning_sessions
for each row
execute function public.set_updated_at();

alter table public.gus_planning_sessions enable row level security;
alter table public.gus_planning_messages enable row level security;
alter table public.gus_generated_plans enable row level security;

grant select, insert, update on public.gus_planning_sessions to authenticated;
grant select, insert on public.gus_planning_messages to authenticated;
grant select, insert, update on public.gus_generated_plans to authenticated;

grant select, insert, update, delete on public.gus_planning_sessions to service_role;
grant select, insert, update, delete on public.gus_planning_messages to service_role;
grant select, insert, update, delete on public.gus_generated_plans to service_role;

drop policy if exists gus_planning_sessions_select_scope on public.gus_planning_sessions;
create policy gus_planning_sessions_select_scope
on public.gus_planning_sessions for select to authenticated
using (
  public.is_admin_role()
  or (
    company_id is not null
    and public.security_is_company_member(company_id)
    and public.security_has_jobsite_access(company_id, jobsite_id)
  )
  or (
    company_id is null
    and user_id = auth.uid()
  )
);

drop policy if exists gus_planning_sessions_insert_scope on public.gus_planning_sessions;
create policy gus_planning_sessions_insert_scope
on public.gus_planning_sessions for insert to authenticated
with check (
  public.is_admin_role()
  or (
    company_id is not null
    and public.security_can_write_company_data(company_id)
    and public.security_has_jobsite_access(company_id, jobsite_id)
    and (
      user_id is null
      or user_id = auth.uid()
      or public.security_is_company_manager(company_id)
    )
  )
  or (
    company_id is null
    and user_id = auth.uid()
  )
);

drop policy if exists gus_planning_sessions_update_scope on public.gus_planning_sessions;
create policy gus_planning_sessions_update_scope
on public.gus_planning_sessions for update to authenticated
using (
  public.is_admin_role()
  or (
    company_id is not null
    and public.security_is_company_member(company_id)
    and public.security_has_jobsite_access(company_id, jobsite_id)
  )
  or (
    company_id is null
    and user_id = auth.uid()
  )
)
with check (
  public.is_admin_role()
  or (
    company_id is not null
    and public.security_can_write_company_data(company_id)
    and public.security_has_jobsite_access(company_id, jobsite_id)
    and (
      user_id is null
      or user_id = auth.uid()
      or public.security_is_company_manager(company_id)
    )
  )
  or (
    company_id is null
    and user_id = auth.uid()
  )
);

drop policy if exists gus_planning_messages_select_scope on public.gus_planning_messages;
create policy gus_planning_messages_select_scope
on public.gus_planning_messages for select to authenticated
using (
  exists (
    select 1
    from public.gus_planning_sessions session
    where session.id = public.gus_planning_messages.session_id
      and (
        public.is_admin_role()
        or (
          session.company_id is not null
          and public.security_is_company_member(session.company_id)
          and public.security_has_jobsite_access(session.company_id, session.jobsite_id)
        )
        or (
          session.company_id is null
          and session.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists gus_planning_messages_insert_scope on public.gus_planning_messages;
create policy gus_planning_messages_insert_scope
on public.gus_planning_messages for insert to authenticated
with check (
  exists (
    select 1
    from public.gus_planning_sessions session
    where session.id = public.gus_planning_messages.session_id
      and (
        public.is_admin_role()
        or (
          session.company_id is not null
          and public.security_can_write_company_data(session.company_id)
          and public.security_has_jobsite_access(session.company_id, session.jobsite_id)
        )
        or (
          session.company_id is null
          and session.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists gus_generated_plans_select_scope on public.gus_generated_plans;
create policy gus_generated_plans_select_scope
on public.gus_generated_plans for select to authenticated
using (
  exists (
    select 1
    from public.gus_planning_sessions session
    where session.id = public.gus_generated_plans.session_id
      and (
        public.is_admin_role()
        or (
          session.company_id is not null
          and public.security_is_company_member(session.company_id)
          and public.security_has_jobsite_access(session.company_id, session.jobsite_id)
        )
        or (
          session.company_id is null
          and session.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists gus_generated_plans_insert_scope on public.gus_generated_plans;
create policy gus_generated_plans_insert_scope
on public.gus_generated_plans for insert to authenticated
with check (
  exists (
    select 1
    from public.gus_planning_sessions session
    where session.id = public.gus_generated_plans.session_id
      and public.gus_generated_plans.company_id is not distinct from session.company_id
      and public.gus_generated_plans.jobsite_id is not distinct from session.jobsite_id
      and (
        public.is_admin_role()
        or (
          session.company_id is not null
          and public.security_can_write_company_data(session.company_id)
          and public.security_has_jobsite_access(session.company_id, session.jobsite_id)
          and (
            public.gus_generated_plans.created_by is null
            or public.gus_generated_plans.created_by = auth.uid()
            or public.security_is_company_manager(session.company_id)
          )
        )
        or (
          session.company_id is null
          and session.user_id = auth.uid()
          and (
            public.gus_generated_plans.created_by is null
            or public.gus_generated_plans.created_by = auth.uid()
          )
        )
      )
  )
);

drop policy if exists gus_generated_plans_update_scope on public.gus_generated_plans;
create policy gus_generated_plans_update_scope
on public.gus_generated_plans for update to authenticated
using (
  exists (
    select 1
    from public.gus_planning_sessions session
    where session.id = public.gus_generated_plans.session_id
      and (
        public.is_admin_role()
        or (
          session.company_id is not null
          and public.security_is_company_member(session.company_id)
          and public.security_has_jobsite_access(session.company_id, session.jobsite_id)
        )
        or (
          session.company_id is null
          and session.user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.gus_planning_sessions session
    where session.id = public.gus_generated_plans.session_id
      and public.gus_generated_plans.company_id is not distinct from session.company_id
      and public.gus_generated_plans.jobsite_id is not distinct from session.jobsite_id
      and (
        public.is_admin_role()
        or (
          session.company_id is not null
          and public.security_can_write_company_data(session.company_id)
          and public.security_has_jobsite_access(session.company_id, session.jobsite_id)
        )
        or (
          session.company_id is null
          and session.user_id = auth.uid()
        )
      )
  )
);
