alter table public.company_jobsite_schedule_items
add column if not exists risk_level text not null default 'medium',
add column if not exists is_high_risk boolean not null default false,
add column if not exists hazard_categories text[] not null default array[]::text[],
add column if not exists permit_triggers text[] not null default array[]::text[],
add column if not exists required_controls text[] not null default array[]::text[],
add column if not exists crew_size integer null,
add column if not exists supervisor_name text null,
add column if not exists shift_start_time time null,
add column if not exists shift_end_time time null,
add column if not exists source_metadata jsonb not null default '{}'::jsonb;

alter table public.company_jobsite_schedule_items
drop constraint if exists company_jobsite_schedule_items_risk_level_check;

alter table public.company_jobsite_schedule_items
add constraint company_jobsite_schedule_items_risk_level_check
check (risk_level in ('low', 'medium', 'high', 'critical'));

alter table public.company_jobsite_schedule_items
drop constraint if exists company_jobsite_schedule_items_crew_size_check;

alter table public.company_jobsite_schedule_items
add constraint company_jobsite_schedule_items_crew_size_check
check (crew_size is null or crew_size >= 0);

create index if not exists company_jobsite_schedule_items_company_jobsite_risk_idx
on public.company_jobsite_schedule_items(company_id, jobsite_id, risk_level, is_high_risk, work_start_date)
where archived_at is null;

create index if not exists company_jobsite_schedule_items_hazard_categories_gin_idx
on public.company_jobsite_schedule_items using gin(hazard_categories);

create index if not exists company_jobsite_schedule_items_permit_triggers_gin_idx
on public.company_jobsite_schedule_items using gin(permit_triggers);

alter table public.company_jobsite_schedule_items enable row level security;

grant select, insert, update on public.company_jobsite_schedule_items to authenticated;
grant select, insert, update, delete on public.company_jobsite_schedule_items to service_role;
