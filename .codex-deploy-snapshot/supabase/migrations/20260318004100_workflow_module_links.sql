create table if not exists public.company_dap_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  dap_id uuid not null references public.company_daps(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  work_date date null,
  trade text null,
  activity_name text not null,
  area text null,
  crew_size integer null,
  hazard_category text null,
  hazard_description text null,
  mitigation text null,
  permit_required boolean not null default false,
  permit_type text null,
  planned_risk_level text null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_dap_activities_status_check check (status in ('planned', 'monitored', 'completed', 'cancelled'))
);

create index if not exists company_dap_activities_company_work_date_idx
  on public.company_dap_activities(company_id, work_date desc, updated_at desc);

drop trigger if exists set_company_dap_activities_updated_at on public.company_dap_activities;
create trigger set_company_dap_activities_updated_at
before update on public.company_dap_activities
for each row execute function public.set_updated_at();

alter table public.company_dap_activities enable row level security;
grant select, insert, update on public.company_dap_activities to authenticated;

drop policy if exists "company_dap_activities_scope" on public.company_dap_activities;
create policy "company_dap_activities_scope"
on public.company_dap_activities
for all
to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_dap_activities.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_dap_activities.company_id and actor.account_status = 'active')
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_dap_activities.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_dap_activities.company_id and actor.account_status = 'active')
);

alter table public.company_corrective_actions
  add column if not exists dap_id uuid null references public.company_daps(id) on delete set null,
  add column if not exists dap_activity_id uuid null references public.company_dap_activities(id) on delete set null,
  add column if not exists workflow_status text null;

alter table public.company_permits
  add column if not exists dap_activity_id uuid null references public.company_dap_activities(id) on delete set null,
  add column if not exists observation_id uuid null references public.company_corrective_actions(id) on delete set null;

alter table public.company_incidents
  add column if not exists observation_id uuid null references public.company_corrective_actions(id) on delete set null,
  add column if not exists dap_activity_id uuid null references public.company_dap_activities(id) on delete set null;
