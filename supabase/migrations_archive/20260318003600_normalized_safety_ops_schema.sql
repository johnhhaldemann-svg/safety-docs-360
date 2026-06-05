-- Normalized safety operations schema (additive, non-destructive)

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_key text unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint companies_status_check check (status in ('active', 'inactive', 'suspended'))
);

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  display_name text null,
  title text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_users_unique_user_per_company unique (company_id, user_id),
  constraint company_users_status_check check (status in ('pending', 'active', 'suspended'))
);

create index if not exists company_users_company_status_idx
  on public.company_users(company_id, status, updated_at desc);

create table if not exists public.jobsites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  project_number text null,
  location text null,
  status text not null default 'active',
  start_date date null,
  end_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint jobsites_unique_name_per_company unique (company_id, name),
  constraint jobsites_status_check check (status in ('planned', 'active', 'completed', 'archived'))
);

create index if not exists jobsites_company_status_idx
  on public.jobsites(company_id, status, updated_at desc);

create table if not exists public.jobsite_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  company_user_id uuid not null references public.company_users(id) on delete cascade,
  role text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint jobsite_users_unique unique (jobsite_id, company_user_id)
);

create index if not exists jobsite_users_company_user_idx
  on public.jobsite_users(company_id, company_user_id);

create table if not exists public.daps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  created_by_company_user_id uuid null references public.company_users(id) on delete set null,
  owner_company_user_id uuid null references public.company_users(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'draft',
  severity text not null default 'medium',
  due_at timestamptz null,
  started_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daps_status_check check (status in ('draft', 'active', 'closed', 'archived')),
  constraint daps_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists daps_company_status_idx
  on public.daps(company_id, status, updated_at desc);

create table if not exists public.dap_activities (
  id uuid primary key default gen_random_uuid(),
  dap_id uuid not null references public.daps(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  activity_type text not null,
  detail text null,
  payload jsonb not null default '{}'::jsonb,
  created_by_company_user_id uuid null references public.company_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists dap_activities_dap_created_idx
  on public.dap_activities(dap_id, created_at desc);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  observer_company_user_id uuid null references public.company_users(id) on delete set null,
  title text not null,
  description text null,
  severity text not null default 'medium',
  category text null,
  status text not null default 'open',
  occurred_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observations_status_check check (status in ('open', 'in_progress', 'closed')),
  constraint observations_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists observations_company_status_idx
  on public.observations(company_id, status, updated_at desc);

create table if not exists public.observation_photos (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_bucket text not null default 'safety-assets',
  file_path text not null,
  file_name text null,
  content_type text null,
  uploaded_by_company_user_id uuid null references public.company_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists observation_photos_observation_idx
  on public.observation_photos(observation_id, created_at desc);

create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  observation_id uuid null references public.observations(id) on delete set null,
  source_dap_id uuid null references public.daps(id) on delete set null,
  title text not null,
  description text null,
  category text null,
  severity text not null default 'medium',
  status text not null default 'open',
  assigned_company_user_id uuid null references public.company_users(id) on delete set null,
  due_at timestamptz null,
  closed_at timestamptz null,
  verified_by_company_user_id uuid null references public.company_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corrective_actions_status_check check (status in ('open', 'in_progress', 'closed')),
  constraint corrective_actions_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists corrective_actions_company_status_idx
  on public.corrective_actions(company_id, status, due_at, updated_at desc);

create table if not exists public.permit_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permit_types_unique_code unique (company_id, code)
);

create table if not exists public.permits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  permit_type_id uuid null references public.permit_types(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  severity text not null default 'medium',
  requested_by_company_user_id uuid null references public.company_users(id) on delete set null,
  approved_by_company_user_id uuid null references public.company_users(id) on delete set null,
  valid_from timestamptz null,
  valid_to timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permits_status_check check (status in ('draft', 'active', 'closed', 'expired')),
  constraint permits_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists permits_company_status_idx
  on public.permits(company_id, status, updated_at desc);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  title text not null,
  description text null,
  category text not null default 'incident',
  severity text not null default 'medium',
  status text not null default 'open',
  occurred_at timestamptz null,
  reported_by_company_user_id uuid null references public.company_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incidents_status_check check (status in ('open', 'in_progress', 'closed')),
  constraint incidents_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists incidents_company_status_idx
  on public.incidents(company_id, status, updated_at desc);

create table if not exists public.incident_root_causes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  cause_category text not null,
  description text null,
  created_at timestamptz not null default now(),
  created_by_company_user_id uuid null references public.company_users(id) on delete set null
);

create index if not exists incident_root_causes_incident_idx
  on public.incident_root_causes(incident_id, created_at desc);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  report_date date not null,
  title text not null,
  summary text null,
  status text not null default 'draft',
  created_by_company_user_id uuid null references public.company_users(id) on delete set null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_reports_status_check check (status in ('draft', 'published', 'archived')),
  constraint daily_reports_unique_per_jobsite_date unique (company_id, jobsite_id, report_date)
);

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid null references public.daily_reports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  snapshot_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by_company_user_id uuid null references public.company_users(id) on delete set null
);

create index if not exists report_snapshots_company_date_idx
  on public.report_snapshots(company_id, snapshot_date desc);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  title text not null,
  document_type text not null,
  status text not null default 'draft',
  current_version integer not null default 1,
  owner_company_user_id uuid null references public.company_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  version_number integer not null,
  storage_bucket text not null default 'documents',
  file_path text not null,
  checksum text null,
  change_notes text null,
  created_at timestamptz not null default now(),
  created_by_company_user_id uuid null references public.company_users(id) on delete set null,
  constraint document_versions_unique_version unique (document_id, version_number)
);

create index if not exists document_versions_document_idx
  on public.document_versions(document_id, version_number desc);

-- Optional later tables
create table if not exists public.sif_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  incident_id uuid null references public.incidents(id) on delete set null,
  corrective_action_id uuid null references public.corrective_actions(id) on delete set null,
  reviewer_company_user_id uuid null references public.company_users(id) on delete set null,
  rating text not null default 'pending',
  notes text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sif_reviews_rating_check check (rating in ('pending', 'low', 'medium', 'high'))
);

create table if not exists public.hazard_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hazard_categories_unique_code unique (company_id, code)
);

create table if not exists public.weather_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  logged_at timestamptz not null default now(),
  temperature_c numeric(5,2) null,
  wind_kph numeric(5,2) null,
  precipitation_mm numeric(7,2) null,
  conditions text null,
  created_by_company_user_id uuid null references public.company_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.safety_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.jobsites(id) on delete set null,
  score_date date not null,
  score numeric(6,2) not null,
  score_components jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by_company_user_id uuid null references public.company_users(id) on delete set null,
  constraint safety_scores_unique_per_scope_date unique (company_id, jobsite_id, score_date)
);

-- Updated-at triggers
drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
drop trigger if exists set_company_users_updated_at on public.company_users;
create trigger set_company_users_updated_at before update on public.company_users for each row execute function public.set_updated_at();
drop trigger if exists set_jobsites_updated_at on public.jobsites;
create trigger set_jobsites_updated_at before update on public.jobsites for each row execute function public.set_updated_at();
drop trigger if exists set_jobsite_users_updated_at on public.jobsite_users;
create trigger set_jobsite_users_updated_at before update on public.jobsite_users for each row execute function public.set_updated_at();
drop trigger if exists set_daps_updated_at on public.daps;
create trigger set_daps_updated_at before update on public.daps for each row execute function public.set_updated_at();
drop trigger if exists set_observations_updated_at on public.observations;
create trigger set_observations_updated_at before update on public.observations for each row execute function public.set_updated_at();
drop trigger if exists set_corrective_actions_updated_at on public.corrective_actions;
create trigger set_corrective_actions_updated_at before update on public.corrective_actions for each row execute function public.set_updated_at();
drop trigger if exists set_permit_types_updated_at on public.permit_types;
create trigger set_permit_types_updated_at before update on public.permit_types for each row execute function public.set_updated_at();
drop trigger if exists set_permits_updated_at on public.permits;
create trigger set_permits_updated_at before update on public.permits for each row execute function public.set_updated_at();
drop trigger if exists set_incidents_updated_at on public.incidents;
create trigger set_incidents_updated_at before update on public.incidents for each row execute function public.set_updated_at();
drop trigger if exists set_daily_reports_updated_at on public.daily_reports;
create trigger set_daily_reports_updated_at before update on public.daily_reports for each row execute function public.set_updated_at();
drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at before update on public.documents for each row execute function public.set_updated_at();
drop trigger if exists set_sif_reviews_updated_at on public.sif_reviews;
create trigger set_sif_reviews_updated_at before update on public.sif_reviews for each row execute function public.set_updated_at();
drop trigger if exists set_hazard_categories_updated_at on public.hazard_categories;
create trigger set_hazard_categories_updated_at before update on public.hazard_categories for each row execute function public.set_updated_at();

-- Basic RLS enablement + broad company-scope policies
alter table public.company_users enable row level security;
alter table public.jobsites enable row level security;
alter table public.jobsite_users enable row level security;
alter table public.daps enable row level security;
alter table public.dap_activities enable row level security;
alter table public.observations enable row level security;
alter table public.observation_photos enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.permit_types enable row level security;
alter table public.permits enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_root_causes enable row level security;
alter table public.daily_reports enable row level security;
alter table public.report_snapshots enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.sif_reviews enable row level security;
alter table public.hazard_categories enable row level security;
alter table public.weather_logs enable row level security;
alter table public.safety_scores enable row level security;

grant select, insert, update, delete on
  public.company_users,
  public.jobsites,
  public.jobsite_users,
  public.daps,
  public.dap_activities,
  public.observations,
  public.observation_photos,
  public.corrective_actions,
  public.permit_types,
  public.permits,
  public.incidents,
  public.incident_root_causes,
  public.daily_reports,
  public.report_snapshots,
  public.documents,
  public.document_versions,
  public.sif_reviews,
  public.hazard_categories,
  public.weather_logs,
  public.safety_scores
to authenticated;

drop policy if exists "company_users_scope" on public.company_users;
create policy "company_users_scope" on public.company_users
for all to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_users.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_users.company_id
      and actor.account_status = 'active'
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_users.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_users.company_id
      and actor.account_status = 'active'
  )
);

drop policy if exists "jobsites_scope" on public.jobsites;
create policy "jobsites_scope" on public.jobsites
for all to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.jobsites.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.jobsites.company_id and actor.account_status = 'active')
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.jobsites.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.jobsites.company_id and actor.account_status = 'active')
);

drop policy if exists "jobsite_users_scope" on public.jobsite_users;
create policy "jobsite_users_scope" on public.jobsite_users
for all to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.jobsite_users.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.jobsite_users.company_id and actor.account_status = 'active')
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.jobsite_users.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.jobsite_users.company_id and actor.account_status = 'active')
);

drop policy if exists "daps_scope" on public.daps;
create policy "daps_scope" on public.daps for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.daps.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.daps.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.daps.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.daps.company_id and actor.account_status = 'active')
);

drop policy if exists "dap_activities_scope" on public.dap_activities;
create policy "dap_activities_scope" on public.dap_activities for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.dap_activities.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.dap_activities.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.dap_activities.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.dap_activities.company_id and actor.account_status = 'active')
);

drop policy if exists "observations_scope" on public.observations;
create policy "observations_scope" on public.observations for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.observations.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.observations.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.observations.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.observations.company_id and actor.account_status = 'active')
);

drop policy if exists "observation_photos_scope" on public.observation_photos;
create policy "observation_photos_scope" on public.observation_photos for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.observation_photos.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.observation_photos.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.observation_photos.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.observation_photos.company_id and actor.account_status = 'active')
);

drop policy if exists "corrective_actions_scope" on public.corrective_actions;
create policy "corrective_actions_scope" on public.corrective_actions for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.corrective_actions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.corrective_actions.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.corrective_actions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.corrective_actions.company_id and actor.account_status = 'active')
);

drop policy if exists "permit_types_scope" on public.permit_types;
create policy "permit_types_scope" on public.permit_types for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.permit_types.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.permit_types.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.permit_types.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.permit_types.company_id and actor.account_status = 'active')
);

drop policy if exists "permits_scope" on public.permits;
create policy "permits_scope" on public.permits for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.permits.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.permits.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.permits.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.permits.company_id and actor.account_status = 'active')
);

drop policy if exists "incidents_scope" on public.incidents;
create policy "incidents_scope" on public.incidents for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.incidents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.incidents.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.incidents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.incidents.company_id and actor.account_status = 'active')
);

drop policy if exists "incident_root_causes_scope" on public.incident_root_causes;
create policy "incident_root_causes_scope" on public.incident_root_causes for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.incident_root_causes.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.incident_root_causes.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.incident_root_causes.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.incident_root_causes.company_id and actor.account_status = 'active')
);

drop policy if exists "daily_reports_scope" on public.daily_reports;
create policy "daily_reports_scope" on public.daily_reports for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.daily_reports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.daily_reports.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.daily_reports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.daily_reports.company_id and actor.account_status = 'active')
);

drop policy if exists "report_snapshots_scope" on public.report_snapshots;
create policy "report_snapshots_scope" on public.report_snapshots for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.report_snapshots.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.report_snapshots.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.report_snapshots.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.report_snapshots.company_id and actor.account_status = 'active')
);

drop policy if exists "documents_scope" on public.documents;
create policy "documents_scope" on public.documents for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.documents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.documents.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.documents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.documents.company_id and actor.account_status = 'active')
);

drop policy if exists "document_versions_scope" on public.document_versions;
create policy "document_versions_scope" on public.document_versions for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.document_versions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.document_versions.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.document_versions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.document_versions.company_id and actor.account_status = 'active')
);

drop policy if exists "sif_reviews_scope" on public.sif_reviews;
create policy "sif_reviews_scope" on public.sif_reviews for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.sif_reviews.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.sif_reviews.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.sif_reviews.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.sif_reviews.company_id and actor.account_status = 'active')
);

drop policy if exists "hazard_categories_scope" on public.hazard_categories;
create policy "hazard_categories_scope" on public.hazard_categories for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.hazard_categories.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.hazard_categories.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.hazard_categories.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.hazard_categories.company_id and actor.account_status = 'active')
);

drop policy if exists "weather_logs_scope" on public.weather_logs;
create policy "weather_logs_scope" on public.weather_logs for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.weather_logs.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.weather_logs.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.weather_logs.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.weather_logs.company_id and actor.account_status = 'active')
);

drop policy if exists "safety_scores_scope" on public.safety_scores;
create policy "safety_scores_scope" on public.safety_scores for all to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.safety_scores.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.safety_scores.company_id and actor.account_status = 'active')
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.safety_scores.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.safety_scores.company_id and actor.account_status = 'active')
);
