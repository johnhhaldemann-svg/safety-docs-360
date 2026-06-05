-- Company-scoped Microsoft Project / new Planner connector.

create table if not exists public.company_integration_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  status text not null default 'connected',
  display_name text null,
  account_email text null,
  tenant_id text null,
  scopes text[] not null default '{}'::text[],
  dataverse_environment_url text null,
  encrypted_access_token text null,
  encrypted_refresh_token text null,
  access_token_expires_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_integration_connections_provider_nonempty check (length(trim(provider)) > 0),
  constraint company_integration_connections_status_check check (
    status in ('pending', 'connected', 'needs_reauth', 'disabled', 'error')
  ),
  constraint company_integration_connections_provider_uidx unique (company_id, provider)
);

create table if not exists public.company_integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid null references public.company_integration_connections(id) on delete set null,
  provider text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  projects_seen int not null default 0,
  projects_imported int not null default 0,
  tasks_seen int not null default 0,
  tasks_imported int not null default 0,
  assignments_seen int not null default 0,
  assignments_imported int not null default 0,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_integration_sync_runs_status_check check (
    status in ('running', 'succeeded', 'partial', 'failed')
  )
);

create table if not exists public.company_microsoft_project_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid not null references public.company_integration_connections(id) on delete cascade,
  source_system text not null default 'dataverse_project',
  source_project_id text not null,
  source_project_url text null,
  source_plan_id text null,
  name text not null,
  project_number text null,
  status text not null default 'active',
  start_date date null,
  end_date date null,
  owner_name text null,
  owner_email text null,
  raw_payload jsonb not null default '{}'::jsonb,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_microsoft_project_sources_name_nonempty check (length(trim(name)) > 0),
  constraint company_microsoft_project_sources_status_check check (
    status in ('planned', 'active', 'completed', 'archived')
  ),
  constraint company_microsoft_project_sources_source_uidx
    unique (company_id, connection_id, source_system, source_project_id)
);

create table if not exists public.company_microsoft_project_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid not null references public.company_integration_connections(id) on delete cascade,
  project_source_id uuid null references public.company_microsoft_project_sources(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  source_system text not null default 'dataverse_project',
  source_project_id text null,
  source_task_id text not null,
  parent_source_task_id text null,
  title text not null,
  notes text null,
  status text not null default 'not_started',
  percent_complete numeric(5,2) null,
  priority text null,
  bucket_name text null,
  start_at timestamptz null,
  due_at timestamptz null,
  completed_at timestamptz null,
  raw_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_microsoft_project_tasks_title_nonempty check (length(trim(title)) > 0),
  constraint company_microsoft_project_tasks_status_check check (
    status in ('not_started', 'in_progress', 'completed', 'blocked', 'archived')
  ),
  constraint company_microsoft_project_tasks_source_uidx
    unique (company_id, connection_id, source_system, source_task_id)
);

create table if not exists public.company_microsoft_project_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid not null references public.company_integration_connections(id) on delete cascade,
  project_source_id uuid null references public.company_microsoft_project_sources(id) on delete cascade,
  task_id uuid null references public.company_microsoft_project_tasks(id) on delete cascade,
  source_assignment_id text not null,
  source_user_id text null,
  display_name text null,
  email text null,
  user_id uuid null references auth.users(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_microsoft_project_assignments_source_uidx
    unique (company_id, connection_id, source_assignment_id)
);

create index if not exists company_integration_connections_company_idx
  on public.company_integration_connections(company_id, provider, status);
create index if not exists company_integration_sync_runs_company_idx
  on public.company_integration_sync_runs(company_id, provider, started_at desc);
create index if not exists company_microsoft_project_sources_company_idx
  on public.company_microsoft_project_sources(company_id, connection_id, status, last_seen_at desc);
create index if not exists company_microsoft_project_sources_jobsite_idx
  on public.company_microsoft_project_sources(jobsite_id);
create index if not exists company_microsoft_project_tasks_project_idx
  on public.company_microsoft_project_tasks(project_source_id, status, due_at);
create index if not exists company_microsoft_project_tasks_jobsite_idx
  on public.company_microsoft_project_tasks(company_id, jobsite_id, due_at);
create index if not exists company_microsoft_project_assignments_email_idx
  on public.company_microsoft_project_assignments(company_id, lower(email));

drop trigger if exists set_company_integration_connections_updated_at on public.company_integration_connections;
create trigger set_company_integration_connections_updated_at
before update on public.company_integration_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_company_microsoft_project_sources_updated_at on public.company_microsoft_project_sources;
create trigger set_company_microsoft_project_sources_updated_at
before update on public.company_microsoft_project_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_company_microsoft_project_tasks_updated_at on public.company_microsoft_project_tasks;
create trigger set_company_microsoft_project_tasks_updated_at
before update on public.company_microsoft_project_tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_company_microsoft_project_assignments_updated_at on public.company_microsoft_project_assignments;
create trigger set_company_microsoft_project_assignments_updated_at
before update on public.company_microsoft_project_assignments
for each row execute function public.set_updated_at();

alter table public.company_integration_connections enable row level security;
alter table public.company_integration_sync_runs enable row level security;
alter table public.company_microsoft_project_sources enable row level security;
alter table public.company_microsoft_project_tasks enable row level security;
alter table public.company_microsoft_project_assignments enable row level security;

grant select, insert, update on public.company_integration_connections to authenticated;
grant select, insert on public.company_integration_sync_runs to authenticated;
grant select, insert, update on public.company_microsoft_project_sources to authenticated;
grant select, insert, update on public.company_microsoft_project_tasks to authenticated;
grant select, insert, update on public.company_microsoft_project_assignments to authenticated;

grant select, insert, update, delete on public.company_integration_connections to service_role;
grant select, insert, update, delete on public.company_integration_sync_runs to service_role;
grant select, insert, update, delete on public.company_microsoft_project_sources to service_role;
grant select, insert, update, delete on public.company_microsoft_project_tasks to service_role;
grant select, insert, update, delete on public.company_microsoft_project_assignments to service_role;

drop policy if exists company_integration_connections_select_scope on public.company_integration_connections;
create policy company_integration_connections_select_scope
on public.company_integration_connections for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_integration_connections_insert_scope on public.company_integration_connections;
create policy company_integration_connections_insert_scope
on public.company_integration_connections for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_integration_connections_update_scope on public.company_integration_connections;
create policy company_integration_connections_update_scope
on public.company_integration_connections for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_integration_sync_runs_select_scope on public.company_integration_sync_runs;
create policy company_integration_sync_runs_select_scope
on public.company_integration_sync_runs for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_integration_sync_runs_insert_scope on public.company_integration_sync_runs;
create policy company_integration_sync_runs_insert_scope
on public.company_integration_sync_runs for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_microsoft_project_sources_select_scope on public.company_microsoft_project_sources;
create policy company_microsoft_project_sources_select_scope
on public.company_microsoft_project_sources for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_microsoft_project_sources_insert_scope on public.company_microsoft_project_sources;
create policy company_microsoft_project_sources_insert_scope
on public.company_microsoft_project_sources for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_microsoft_project_sources_update_scope on public.company_microsoft_project_sources;
create policy company_microsoft_project_sources_update_scope
on public.company_microsoft_project_sources for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_microsoft_project_tasks_select_scope on public.company_microsoft_project_tasks;
create policy company_microsoft_project_tasks_select_scope
on public.company_microsoft_project_tasks for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_microsoft_project_tasks_insert_scope on public.company_microsoft_project_tasks;
create policy company_microsoft_project_tasks_insert_scope
on public.company_microsoft_project_tasks for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_microsoft_project_tasks_update_scope on public.company_microsoft_project_tasks;
create policy company_microsoft_project_tasks_update_scope
on public.company_microsoft_project_tasks for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_microsoft_project_assignments_select_scope on public.company_microsoft_project_assignments;
create policy company_microsoft_project_assignments_select_scope
on public.company_microsoft_project_assignments for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_microsoft_project_assignments_insert_scope on public.company_microsoft_project_assignments;
create policy company_microsoft_project_assignments_insert_scope
on public.company_microsoft_project_assignments for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_microsoft_project_assignments_update_scope on public.company_microsoft_project_assignments;
create policy company_microsoft_project_assignments_update_scope
on public.company_microsoft_project_assignments for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));
