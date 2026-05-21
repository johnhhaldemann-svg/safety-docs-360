create table if not exists public.company_jobsites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  project_number text null,
  location text null,
  status text not null default 'active',
  project_manager text null,
  safety_lead text null,
  start_date date null,
  end_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_jobsites_status_check check (
    status in ('planned', 'active', 'completed', 'archived')
  ),
  constraint company_jobsites_company_name_unique unique (company_id, name)
);

create index if not exists company_jobsites_company_status_idx
  on public.company_jobsites(company_id, status, updated_at desc);

drop trigger if exists set_company_jobsites_updated_at on public.company_jobsites;
create trigger set_company_jobsites_updated_at
before update on public.company_jobsites
for each row
execute function public.set_updated_at();

alter table public.company_jobsites enable row level security;

grant select, insert, update on public.company_jobsites to authenticated;

drop policy if exists "company_jobsites_select_company_scope" on public.company_jobsites;
create policy "company_jobsites_select_company_scope"
on public.company_jobsites
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
  )
);

drop policy if exists "company_jobsites_insert_company_admin" on public.company_jobsites;
create policy "company_jobsites_insert_company_admin"
on public.company_jobsites
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
      and actor.role = 'company_admin'
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
      and actor.role = 'company_admin'
  )
);

drop policy if exists "company_jobsites_update_company_admin" on public.company_jobsites;
create policy "company_jobsites_update_company_admin"
on public.company_jobsites
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
      and actor.role = 'company_admin'
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
      and actor.role = 'company_admin'
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
      and actor.role = 'company_admin'
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_jobsites.company_id
      and actor.role = 'company_admin'
  )
);

insert into public.company_jobsites (
  company_id,
  name,
  project_number,
  location,
  status,
  created_by,
  updated_by
)
select distinct
  d.company_id,
  trim(d.project_name) as name,
  null as project_number,
  nullif(
    concat_ws(', ', nullif(c.city, ''), nullif(c.state_region, '')),
    ''
  ) as location,
  'active' as status,
  c.created_by,
  c.updated_by
from public.documents d
join public.companies c on c.id = d.company_id
where d.company_id is not null
  and nullif(trim(d.project_name), '') is not null
on conflict (company_id, name) do nothing;
