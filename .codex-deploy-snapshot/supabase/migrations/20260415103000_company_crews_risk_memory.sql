-- Risk Memory Phase 2b: company crews + facet.crew_id (jobsite-scoped or company-wide).

create table if not exists public.company_crews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites (id) on delete set null,
  name text not null,
  notes text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  constraint company_crews_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists company_crews_company_active_idx
  on public.company_crews (company_id, active, name);

create index if not exists company_crews_company_jobsite_idx
  on public.company_crews (company_id, jobsite_id)
  where jobsite_id is not null;

drop trigger if exists set_company_crews_updated_at on public.company_crews;
create trigger set_company_crews_updated_at
before update on public.company_crews
for each row execute function public.set_updated_at();

alter table public.company_crews enable row level security;

grant select, insert, update on public.company_crews to authenticated;

drop policy if exists "company_crews_select_scope" on public.company_crews;
create policy "company_crews_select_scope"
on public.company_crews
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
);

drop policy if exists "company_crews_insert_scope" on public.company_crews;
create policy "company_crews_insert_scope"
on public.company_crews
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
);

drop policy if exists "company_crews_update_scope" on public.company_crews;
create policy "company_crews_update_scope"
on public.company_crews
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_crews.company_id
  )
);

alter table public.company_risk_memory_facets
  add column if not exists crew_id uuid null references public.company_crews (id) on delete set null;

create index if not exists company_risk_memory_facets_crew_idx
  on public.company_risk_memory_facets (company_id, crew_id)
  where crew_id is not null;

comment on table public.company_crews is
  'Named crews for a company; optional jobsite_id scopes a crew to one jobsite.';
comment on column public.company_risk_memory_facets.crew_id is
  'Optional FK to company_crews; validated against company and jobsite compatibility.';
