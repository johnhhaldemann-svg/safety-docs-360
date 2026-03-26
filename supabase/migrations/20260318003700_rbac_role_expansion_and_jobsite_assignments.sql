alter table public.user_roles
drop constraint if exists user_roles_role_check;

alter table public.user_roles
add constraint user_roles_role_check check (
  role in (
    'platform_admin',
    'internal_reviewer',
    'employee',
    'super_admin',
    'admin',
    'manager',
    'company_admin',
    'safety_manager',
    'project_manager',
    'foreman',
    'field_user',
    'read_only',
    'company_user',
    'editor',
    'viewer'
  )
);

alter table public.company_invites
drop constraint if exists company_invites_role_check;

alter table public.company_invites
add constraint company_invites_role_check check (
  role in (
    'company_admin',
    'manager',
    'safety_manager',
    'project_manager',
    'foreman',
    'field_user',
    'read_only',
    'company_user'
  )
);

create table if not exists public.company_jobsite_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'field_user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_jobsite_assignments_role_check check (
    role in ('project_manager', 'foreman', 'field_user', 'read_only')
  ),
  constraint company_jobsite_assignments_unique unique (company_id, jobsite_id, user_id)
);

create index if not exists company_jobsite_assignments_company_user_idx
  on public.company_jobsite_assignments(company_id, user_id);

drop trigger if exists set_company_jobsite_assignments_updated_at on public.company_jobsite_assignments;
create trigger set_company_jobsite_assignments_updated_at
before update on public.company_jobsite_assignments
for each row
execute function public.set_updated_at();

alter table public.company_jobsite_assignments enable row level security;

drop policy if exists "company_jobsite_assignments_select_company_scope" on public.company_jobsite_assignments;
create policy "company_jobsite_assignments_select_company_scope"
on public.company_jobsite_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.account_status = 'active'
      and actor.company_id = public.company_jobsite_assignments.company_id
  )
);

drop policy if exists "company_jobsite_assignments_manage_company_admin" on public.company_jobsite_assignments;
create policy "company_jobsite_assignments_manage_company_admin"
on public.company_jobsite_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.account_status = 'active'
      and actor.company_id = public.company_jobsite_assignments.company_id
      and actor.role in ('platform_admin', 'super_admin', 'admin', 'company_admin', 'manager', 'safety_manager')
  )
)
with check (
  exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.account_status = 'active'
      and actor.company_id = public.company_jobsite_assignments.company_id
      and actor.role in ('platform_admin', 'super_admin', 'admin', 'company_admin', 'manager', 'safety_manager')
  )
);
