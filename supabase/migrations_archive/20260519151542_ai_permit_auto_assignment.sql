alter table public.company_permits
  add column if not exists schedule_item_id uuid null references public.company_jobsite_schedule_items(id) on delete set null,
  add column if not exists source_module text null,
  add column if not exists source_id uuid null,
  add column if not exists auto_assigned boolean not null default false,
  add column if not exists auto_assignment_scope text null,
  add column if not exists assignment_rationale text null,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

alter table public.company_permits
  drop constraint if exists company_permits_auto_assignment_scope_check;

alter table public.company_permits
  add constraint company_permits_auto_assignment_scope_check
  check (auto_assignment_scope is null or auto_assignment_scope in ('daily', 'weekly'));

create index if not exists company_permits_schedule_item_idx
  on public.company_permits(company_id, jobsite_id, schedule_item_id, updated_at desc)
  where schedule_item_id is not null;

create unique index if not exists company_permits_auto_schedule_open_unique_idx
  on public.company_permits(company_id, jobsite_id, schedule_item_id, lower(permit_type))
  where auto_assigned is true
    and schedule_item_id is not null
    and status in ('draft', 'active');
