-- Safety360 Risk Memory Engine: structured facets on top of operational tables + baseline fallback profiles.

-- ---------------------------------------------------------------------------
-- Baseline risk profiles (global seed data; read-only for app users)
-- ---------------------------------------------------------------------------
create table if not exists public.risk_baseline_profiles (
  id uuid primary key default gen_random_uuid(),
  scope_code text not null,
  hazard_code text not null,
  trade_code text not null default '',
  signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists risk_baseline_profiles_scope_hazard_trade_uidx
  on public.risk_baseline_profiles (scope_code, hazard_code, trade_code);

comment on table public.risk_baseline_profiles is
  'Industry-style fallback patterns when company-specific history is thin (scoped by scope/hazard/trade keys).';

insert into public.risk_baseline_profiles (scope_code, hazard_code, trade_code, signals)
values
  (
    'work_at_height',
    'fall_to_lower_level',
    '',
    '{
      "common_failed_controls": ["anchor_point_missing", "guardrail_missing", "weather_monitoring_not_performed"],
      "weather_sensitivity": "high",
      "typical_potential_severity": "critical_potential"
    }'::jsonb
  ),
  (
    'excavation_trenching',
    'excavation_collapse',
    '',
    '{
      "common_failed_controls": ["competent_person_not_involved", "inspection_not_completed", "barricade_missing"],
      "weather_sensitivity": "high",
      "typical_potential_severity": "critical_potential"
    }'::jsonb
  ),
  (
    'roofing',
    'fall_to_lower_level',
    '',
    '{
      "common_failed_controls": ["warning_line_missing", "poor_access_egress", "weather_monitoring_not_performed"],
      "weather_sensitivity": "high",
      "typical_potential_severity": "critical_potential"
    }'::jsonb
  )
on conflict (scope_code, hazard_code, trade_code) do nothing;

alter table public.risk_baseline_profiles enable row level security;

grant select on public.risk_baseline_profiles to authenticated;
grant select on public.risk_baseline_profiles to service_role;

drop policy if exists "risk_baseline_profiles_select_all" on public.risk_baseline_profiles;
create policy "risk_baseline_profiles_select_all"
on public.risk_baseline_profiles
for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- Per-record facets (one row per source operational record)
-- ---------------------------------------------------------------------------
create table if not exists public.company_risk_memory_facets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites (id) on delete set null,
  source_module text not null,
  source_id uuid not null,
  scope_of_work_code text null,
  trade_code text null,
  primary_hazard_code text null,
  secondary_hazard_codes text[] not null default '{}'::text[],
  root_cause_level1 text null,
  root_cause_level2 text null,
  failed_control_code text null,
  weather_condition_code text null,
  potential_severity_code text null,
  actual_outcome_severity_code text null,
  contractor_label text null,
  location_area text null,
  time_of_day_band text null,
  permit_status_summary text null,
  ppe_status_summary text null,
  corrective_action_status text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_risk_memory_facets_source_module_check check (
    source_module in (
      'incident',
      'corrective_action',
      'jsa_activity',
      'permit',
      'sor_record'
    )
  )
);

create unique index if not exists company_risk_memory_facets_source_uidx
  on public.company_risk_memory_facets (company_id, source_module, source_id);

create index if not exists company_risk_memory_facets_company_updated_idx
  on public.company_risk_memory_facets (company_id, updated_at desc);

create index if not exists company_risk_memory_facets_company_scope_idx
  on public.company_risk_memory_facets (company_id, scope_of_work_code)
  where scope_of_work_code is not null;

create index if not exists company_risk_memory_facets_secondary_gin
  on public.company_risk_memory_facets using gin (secondary_hazard_codes);

create index if not exists company_risk_memory_facets_details_gin
  on public.company_risk_memory_facets using gin (details);

drop trigger if exists set_company_risk_memory_facets_updated_at on public.company_risk_memory_facets;
create trigger set_company_risk_memory_facets_updated_at
before update on public.company_risk_memory_facets
for each row execute function public.set_updated_at();

alter table public.company_risk_memory_facets enable row level security;

grant select, insert, update, delete on public.company_risk_memory_facets to authenticated;

drop policy if exists "company_risk_memory_facets_select_scope" on public.company_risk_memory_facets;
create policy "company_risk_memory_facets_select_scope"
on public.company_risk_memory_facets
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
);

drop policy if exists "company_risk_memory_facets_insert_scope" on public.company_risk_memory_facets;
create policy "company_risk_memory_facets_insert_scope"
on public.company_risk_memory_facets
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
);

drop policy if exists "company_risk_memory_facets_update_scope" on public.company_risk_memory_facets;
create policy "company_risk_memory_facets_update_scope"
on public.company_risk_memory_facets
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
);

drop policy if exists "company_risk_memory_facets_delete_scope" on public.company_risk_memory_facets;
create policy "company_risk_memory_facets_delete_scope"
on public.company_risk_memory_facets
for delete
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_facets.company_id
  )
);

-- ---------------------------------------------------------------------------
-- Optional persisted rollups (cron / future use)
-- ---------------------------------------------------------------------------
create table if not exists public.company_risk_memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites (id) on delete set null,
  snapshot_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null
);

create unique index if not exists company_risk_memory_snapshots_uidx
  on public.company_risk_memory_snapshots (company_id, jobsite_id, snapshot_date);

create index if not exists company_risk_memory_snapshots_company_date_idx
  on public.company_risk_memory_snapshots (company_id, snapshot_date desc);

alter table public.company_risk_memory_snapshots enable row level security;

grant select, insert, update on public.company_risk_memory_snapshots to authenticated;

drop policy if exists "company_risk_memory_snapshots_select_scope" on public.company_risk_memory_snapshots;
create policy "company_risk_memory_snapshots_select_scope"
on public.company_risk_memory_snapshots
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
);

drop policy if exists "company_risk_memory_snapshots_insert_scope" on public.company_risk_memory_snapshots;
create policy "company_risk_memory_snapshots_insert_scope"
on public.company_risk_memory_snapshots
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
);

drop policy if exists "company_risk_memory_snapshots_update_scope" on public.company_risk_memory_snapshots;
create policy "company_risk_memory_snapshots_update_scope"
on public.company_risk_memory_snapshots
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_risk_memory_snapshots.company_id
  )
);

-- ---------------------------------------------------------------------------
-- Extend risk event audit modules
-- ---------------------------------------------------------------------------
alter table public.company_risk_events
  drop constraint if exists company_risk_events_module_check;

alter table public.company_risk_events
  add constraint company_risk_events_module_check check (
    module_name in (
      'permits',
      'incidents',
      'corrective_actions',
      'jsa_activity',
      'sor_record',
      'risk_memory'
    )
  );
