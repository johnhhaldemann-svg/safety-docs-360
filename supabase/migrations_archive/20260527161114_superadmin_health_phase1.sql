create table if not exists public.event_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid null references public.companies(id) on delete set null,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  owner_id uuid null,
  module text not null,
  object_type text not null,
  object_id text null,
  action text not null,
  severity text not null default 'low',
  event_status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint event_log_module_not_blank check (length(trim(module)) > 0),
  constraint event_log_object_type_not_blank check (length(trim(object_type)) > 0),
  constraint event_log_action_not_blank check (length(trim(action)) > 0),
  constraint event_log_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint event_log_status_check check (event_status in ('recorded', 'pending_review', 'resolved', 'failed')),
  constraint event_log_jobsite_requires_company check (jobsite_id is null or company_id is not null)
);

create table if not exists public.owner_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  owner_type text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete cascade,
  object_type text null,
  object_id text null,
  validation_status text not null default 'pending_verification',
  authority_level text not null default 'standard',
  starts_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_registry_owner_type_not_blank check (length(trim(owner_type)) > 0),
  constraint owner_registry_validation_status_check check (
    validation_status in (
      'verified',
      'pending_verification',
      'conflicting_owner',
      'unauthorized_owner',
      'expired_authority',
      'requires_second_approval'
    )
  ),
  constraint owner_registry_authority_level_check check (
    authority_level in ('standard', 'elevated', 'critical', 'second_approval')
  ),
  constraint owner_registry_jobsite_requires_company check (jobsite_id is null or company_id is not null),
  constraint owner_registry_authority_dates_check check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.change_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid null references public.companies(id) on delete set null,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  changed_by_user_id uuid null references auth.users(id) on delete set null,
  owner_id uuid null references public.owner_registry(id) on delete set null,
  object_type text not null,
  object_id text not null,
  change_type text not null,
  before_value jsonb null,
  after_value jsonb null,
  reason text null,
  risk_level text not null default 'medium',
  rollback_available boolean not null default false,
  created_at timestamptz not null default now(),
  constraint change_log_object_type_not_blank check (length(trim(object_type)) > 0),
  constraint change_log_object_id_not_blank check (length(trim(object_id)) > 0),
  constraint change_log_change_type_not_blank check (length(trim(change_type)) > 0),
  constraint change_log_risk_level_check check (risk_level in ('low', 'medium', 'high', 'critical')),
  constraint change_log_jobsite_requires_company check (jobsite_id is null or company_id is not null)
);

create table if not exists public.health_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid null references public.companies(id) on delete set null,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  overall_score numeric(5,2) not null,
  system_health_score numeric(5,2) null,
  ai_engine_score numeric(5,2) null,
  prediction_value_score numeric(5,2) null,
  data_quality_score numeric(5,2) null,
  cyber_health_score numeric(5,2) null,
  owner_validation_score numeric(5,2) null,
  help_ticket_score numeric(5,2) null,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint health_score_snapshots_overall_score_check check (overall_score between 0 and 100),
  constraint health_score_snapshots_category_score_check check (
    (system_health_score is null or system_health_score between 0 and 100)
    and (ai_engine_score is null or ai_engine_score between 0 and 100)
    and (prediction_value_score is null or prediction_value_score between 0 and 100)
    and (data_quality_score is null or data_quality_score between 0 and 100)
    and (cyber_health_score is null or cyber_health_score between 0 and 100)
    and (owner_validation_score is null or owner_validation_score between 0 and 100)
    and (help_ticket_score is null or help_ticket_score between 0 and 100)
  ),
  constraint health_score_snapshots_jobsite_requires_company check (jobsite_id is null or company_id is not null)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_log_owner_id_fkey'
      and conrelid = 'public.event_log'::regclass
  ) then
    alter table public.event_log
      add constraint event_log_owner_id_fkey
      foreign key (owner_id) references public.owner_registry(id) on delete set null;
  end if;
end $$;

alter table public.platform_help_tickets
  add column if not exists tenant_id uuid null,
  add column if not exists jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  add column if not exists source_type text null,
  add column if not exists source_id text null,
  add column if not exists severity text null,
  add column if not exists owner_id uuid null references public.owner_registry(id) on delete set null,
  add column if not exists root_cause text null,
  add column if not exists recommended_fix text null,
  add column if not exists due_at timestamptz null,
  add column if not exists resolution_evidence text null;

update public.platform_help_tickets
set tenant_id = coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    severity = coalesce(
      severity,
      case
        when priority = 'critical' then 'critical'
        when priority = 'high' then 'high'
        else 'medium'
      end
    )
where tenant_id is null
   or severity is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_help_tickets_severity_check'
      and conrelid = 'public.platform_help_tickets'::regclass
  ) then
    alter table public.platform_help_tickets
      add constraint platform_help_tickets_severity_check
      check (severity is null or severity in ('low', 'medium', 'high', 'critical'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_help_tickets_jobsite_requires_company'
      and conrelid = 'public.platform_help_tickets'::regclass
  ) then
    alter table public.platform_help_tickets
      add constraint platform_help_tickets_jobsite_requires_company
      check (jobsite_id is null or company_id is not null);
  end if;
end $$;

create index if not exists event_log_tenant_created_idx
  on public.event_log (tenant_id, created_at desc);
create index if not exists event_log_company_created_idx
  on public.event_log (company_id, created_at desc)
  where company_id is not null;
create index if not exists event_log_jobsite_created_idx
  on public.event_log (jobsite_id, created_at desc)
  where jobsite_id is not null;
create index if not exists event_log_severity_status_idx
  on public.event_log (severity, event_status, created_at desc);
create index if not exists event_log_owner_idx
  on public.event_log (owner_id, created_at desc)
  where owner_id is not null;
create index if not exists event_log_object_idx
  on public.event_log (object_type, object_id, created_at desc);

create index if not exists owner_registry_tenant_idx
  on public.owner_registry (tenant_id, validation_status, created_at desc);
create index if not exists owner_registry_company_idx
  on public.owner_registry (company_id, validation_status, created_at desc)
  where company_id is not null;
create index if not exists owner_registry_jobsite_idx
  on public.owner_registry (jobsite_id, validation_status, created_at desc)
  where jobsite_id is not null;
create index if not exists owner_registry_owner_user_idx
  on public.owner_registry (owner_user_id, validation_status, created_at desc);
create index if not exists owner_registry_object_idx
  on public.owner_registry (object_type, object_id, validation_status);

create index if not exists change_log_tenant_created_idx
  on public.change_log (tenant_id, created_at desc);
create index if not exists change_log_company_created_idx
  on public.change_log (company_id, created_at desc)
  where company_id is not null;
create index if not exists change_log_jobsite_created_idx
  on public.change_log (jobsite_id, created_at desc)
  where jobsite_id is not null;
create index if not exists change_log_risk_created_idx
  on public.change_log (risk_level, created_at desc);
create index if not exists change_log_owner_idx
  on public.change_log (owner_id, created_at desc)
  where owner_id is not null;
create index if not exists change_log_object_idx
  on public.change_log (object_type, object_id, created_at desc);

create index if not exists health_score_snapshots_tenant_created_idx
  on public.health_score_snapshots (tenant_id, created_at desc);
create index if not exists health_score_snapshots_company_created_idx
  on public.health_score_snapshots (company_id, created_at desc)
  where company_id is not null;
create index if not exists health_score_snapshots_jobsite_created_idx
  on public.health_score_snapshots (jobsite_id, created_at desc)
  where jobsite_id is not null;

create index if not exists platform_help_tickets_tenant_created_idx
  on public.platform_help_tickets (tenant_id, created_at desc)
  where tenant_id is not null;
create index if not exists platform_help_tickets_jobsite_created_idx
  on public.platform_help_tickets (jobsite_id, created_at desc)
  where jobsite_id is not null;
create index if not exists platform_help_tickets_severity_status_idx
  on public.platform_help_tickets (severity, status, created_at desc)
  where severity is not null;
create index if not exists platform_help_tickets_owner_idx
  on public.platform_help_tickets (owner_id, created_at desc)
  where owner_id is not null;
create index if not exists platform_help_tickets_source_idx
  on public.platform_help_tickets (source_type, source_id, created_at desc)
  where source_type is not null;

drop trigger if exists set_owner_registry_updated_at on public.owner_registry;
create trigger set_owner_registry_updated_at
before update on public.owner_registry
for each row execute function public.set_updated_at();

alter table public.event_log enable row level security;
alter table public.owner_registry enable row level security;
alter table public.change_log enable row level security;
alter table public.health_score_snapshots enable row level security;

grant select, insert on public.event_log to authenticated;
grant select, insert, update on public.owner_registry to authenticated;
grant select, insert on public.change_log to authenticated;
grant select, insert on public.health_score_snapshots to authenticated;
grant select, insert, update, delete on public.event_log to service_role;
grant select, insert, update, delete on public.owner_registry to service_role;
grant select, insert, update, delete on public.change_log to service_role;
grant select, insert, update, delete on public.health_score_snapshots to service_role;

drop policy if exists "event_log_select_superadmin_or_company" on public.event_log;
create policy "event_log_select_superadmin_or_company"
on public.event_log for select to authenticated
using (
  public.current_app_role() = 'super_admin'
  or (company_id is not null and public.security_is_company_member(company_id))
);

drop policy if exists "event_log_insert_superadmin_or_company" on public.event_log;
create policy "event_log_insert_superadmin_or_company"
on public.event_log for insert to authenticated
with check (
  public.current_app_role() = 'super_admin'
  or (company_id is not null and public.security_is_company_member(company_id))
);

drop policy if exists "owner_registry_select_superadmin_or_company" on public.owner_registry;
create policy "owner_registry_select_superadmin_or_company"
on public.owner_registry for select to authenticated
using (
  public.current_app_role() = 'super_admin'
  or owner_user_id = (select auth.uid())
  or (company_id is not null and public.security_is_company_member(company_id))
);

drop policy if exists "owner_registry_insert_superadmin" on public.owner_registry;
create policy "owner_registry_insert_superadmin"
on public.owner_registry for insert to authenticated
with check (public.current_app_role() = 'super_admin');

drop policy if exists "owner_registry_update_superadmin" on public.owner_registry;
create policy "owner_registry_update_superadmin"
on public.owner_registry for update to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

drop policy if exists "change_log_select_superadmin_or_company" on public.change_log;
create policy "change_log_select_superadmin_or_company"
on public.change_log for select to authenticated
using (
  public.current_app_role() = 'super_admin'
  or (company_id is not null and public.security_is_company_member(company_id))
);

drop policy if exists "change_log_insert_superadmin_or_company" on public.change_log;
create policy "change_log_insert_superadmin_or_company"
on public.change_log for insert to authenticated
with check (
  public.current_app_role() = 'super_admin'
  or (company_id is not null and public.security_is_company_member(company_id))
);

drop policy if exists "health_score_snapshots_select_superadmin_or_company" on public.health_score_snapshots;
create policy "health_score_snapshots_select_superadmin_or_company"
on public.health_score_snapshots for select to authenticated
using (
  public.current_app_role() = 'super_admin'
  or (company_id is not null and public.security_is_company_member(company_id))
);

drop policy if exists "health_score_snapshots_insert_superadmin" on public.health_score_snapshots;
create policy "health_score_snapshots_insert_superadmin"
on public.health_score_snapshots for insert to authenticated
with check (public.current_app_role() = 'super_admin');

notify pgrst, 'reload schema';
