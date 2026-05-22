create table if not exists public.company_jobsite_daily_todos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  work_date date not null,
  source_key text not null,
  role text not null,
  title text not null,
  detail text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  target_tab text not null,
  target_href text null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  completed_by uuid null references auth.users(id) on delete set null,
  closed_at timestamptz null,
  closed_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_jobsite_daily_todos_role_check check (role in ('pm', 'sl')),
  constraint company_jobsite_daily_todos_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint company_jobsite_daily_todos_status_check check (status in ('open', 'reviewed', 'completed', 'closed_out')),
  constraint company_jobsite_daily_todos_title_nonempty check (length(trim(title)) > 0),
  constraint company_jobsite_daily_todos_source_key_nonempty check (length(trim(source_key)) > 0),
  constraint company_jobsite_daily_todos_unique_source unique (company_id, jobsite_id, work_date, source_key)
);

create index if not exists company_jobsite_daily_todos_company_date_idx
  on public.company_jobsite_daily_todos(company_id, work_date desc, status, priority);

create index if not exists company_jobsite_daily_todos_jobsite_date_idx
  on public.company_jobsite_daily_todos(jobsite_id, work_date desc, role, status);

drop trigger if exists set_company_jobsite_daily_todos_updated_at on public.company_jobsite_daily_todos;
create trigger set_company_jobsite_daily_todos_updated_at
before update on public.company_jobsite_daily_todos
for each row
execute function public.set_updated_at();

alter table public.company_jobsite_daily_todos enable row level security;

grant select, insert, update on public.company_jobsite_daily_todos to authenticated;
grant select, insert, update, delete on public.company_jobsite_daily_todos to service_role;

drop policy if exists company_jobsite_daily_todos_select_scope on public.company_jobsite_daily_todos;
create policy company_jobsite_daily_todos_select_scope
on public.company_jobsite_daily_todos for select to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
);

drop policy if exists company_jobsite_daily_todos_insert_scope on public.company_jobsite_daily_todos;
create policy company_jobsite_daily_todos_insert_scope
on public.company_jobsite_daily_todos for insert to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
);

drop policy if exists company_jobsite_daily_todos_update_scope on public.company_jobsite_daily_todos;
create policy company_jobsite_daily_todos_update_scope
on public.company_jobsite_daily_todos for update to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsite_daily_todos.company_id
  )
);
