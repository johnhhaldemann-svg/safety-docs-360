create table if not exists public.company_daps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'draft',
  severity text not null default 'medium',
  category text not null default 'corrective_action',
  owner_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_daps_status_check check (status in ('draft', 'active', 'closed', 'archived')),
  constraint company_daps_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create table if not exists public.company_permits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  permit_type text not null,
  title text not null,
  status text not null default 'draft',
  severity text not null default 'medium',
  category text not null default 'corrective_action',
  owner_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_permits_status_check check (status in ('draft', 'active', 'closed', 'expired')),
  constraint company_permits_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create table if not exists public.company_incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'open',
  severity text not null default 'medium',
  category text not null default 'incident',
  owner_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  occurred_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_incidents_status_check check (status in ('open', 'in_progress', 'closed')),
  constraint company_incidents_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create table if not exists public.company_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  title text not null,
  report_type text not null,
  status text not null default 'draft',
  source_module text not null default 'operations',
  file_path text null,
  generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_reports_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.company_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  snapshot_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create unique index if not exists company_analytics_snapshots_unique_idx
  on public.company_analytics_snapshots(company_id, jobsite_id, snapshot_date);

create index if not exists company_daps_company_status_idx
  on public.company_daps(company_id, status, updated_at desc);
create index if not exists company_permits_company_status_idx
  on public.company_permits(company_id, status, updated_at desc);
create index if not exists company_incidents_company_status_idx
  on public.company_incidents(company_id, status, updated_at desc);
create index if not exists company_reports_company_status_idx
  on public.company_reports(company_id, status, updated_at desc);
create index if not exists company_analytics_snapshots_company_date_idx
  on public.company_analytics_snapshots(company_id, snapshot_date desc);

drop trigger if exists set_company_daps_updated_at on public.company_daps;
create trigger set_company_daps_updated_at before update on public.company_daps for each row execute function public.set_updated_at();
drop trigger if exists set_company_permits_updated_at on public.company_permits;
create trigger set_company_permits_updated_at before update on public.company_permits for each row execute function public.set_updated_at();
drop trigger if exists set_company_incidents_updated_at on public.company_incidents;
create trigger set_company_incidents_updated_at before update on public.company_incidents for each row execute function public.set_updated_at();
drop trigger if exists set_company_reports_updated_at on public.company_reports;
create trigger set_company_reports_updated_at before update on public.company_reports for each row execute function public.set_updated_at();

alter table public.company_daps enable row level security;
alter table public.company_permits enable row level security;
alter table public.company_incidents enable row level security;
alter table public.company_reports enable row level security;
alter table public.company_analytics_snapshots enable row level security;

grant select, insert, update on public.company_daps to authenticated;
grant select, insert, update on public.company_permits to authenticated;
grant select, insert, update on public.company_incidents to authenticated;
grant select, insert, update on public.company_reports to authenticated;
grant select, insert on public.company_analytics_snapshots to authenticated;

drop policy if exists "company_daps_select_scope" on public.company_daps;
create policy "company_daps_select_scope" on public.company_daps for select to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
);
drop policy if exists "company_daps_insert_scope" on public.company_daps;
create policy "company_daps_insert_scope" on public.company_daps for insert to authenticated with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
);
drop policy if exists "company_daps_update_scope" on public.company_daps;
create policy "company_daps_update_scope" on public.company_daps for update to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_daps.company_id)
);

drop policy if exists "company_permits_select_scope" on public.company_permits;
create policy "company_permits_select_scope" on public.company_permits for select to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
);
drop policy if exists "company_permits_insert_scope" on public.company_permits;
create policy "company_permits_insert_scope" on public.company_permits for insert to authenticated with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
);
drop policy if exists "company_permits_update_scope" on public.company_permits;
create policy "company_permits_update_scope" on public.company_permits for update to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_permits.company_id)
);

drop policy if exists "company_incidents_select_scope" on public.company_incidents;
create policy "company_incidents_select_scope" on public.company_incidents for select to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
);
drop policy if exists "company_incidents_insert_scope" on public.company_incidents;
create policy "company_incidents_insert_scope" on public.company_incidents for insert to authenticated with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
);
drop policy if exists "company_incidents_update_scope" on public.company_incidents;
create policy "company_incidents_update_scope" on public.company_incidents for update to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_incidents.company_id)
);

drop policy if exists "company_reports_select_scope" on public.company_reports;
create policy "company_reports_select_scope" on public.company_reports for select to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
);
drop policy if exists "company_reports_insert_scope" on public.company_reports;
create policy "company_reports_insert_scope" on public.company_reports for insert to authenticated with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
);
drop policy if exists "company_reports_update_scope" on public.company_reports;
create policy "company_reports_update_scope" on public.company_reports for update to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_reports.company_id)
);

drop policy if exists "company_analytics_select_scope" on public.company_analytics_snapshots;
create policy "company_analytics_select_scope" on public.company_analytics_snapshots for select to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_analytics_snapshots.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_analytics_snapshots.company_id)
);
drop policy if exists "company_analytics_insert_scope" on public.company_analytics_snapshots;
create policy "company_analytics_insert_scope" on public.company_analytics_snapshots for insert to authenticated with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_analytics_snapshots.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_analytics_snapshots.company_id)
);
