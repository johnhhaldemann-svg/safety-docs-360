alter table public.company_jobsites
add column if not exists jobsite_number text;

with numbered_jobsites as (
  select
    id,
    company_id,
    coalesce(nullif(trim(project_number), ''), 'SITE-' || lpad(row_number() over (
      partition by company_id
      order by created_at nulls last, id
    )::text, 4, '0')) as base_number
  from public.company_jobsites
  where jobsite_number is null or length(trim(jobsite_number)) = 0
),
deduped_jobsites as (
  select
    id,
    base_number,
    row_number() over (
      partition by company_id, lower(base_number)
      order by id
    ) as duplicate_number
  from numbered_jobsites
)
update public.company_jobsites target
set jobsite_number = case
  when deduped_jobsites.duplicate_number = 1 then deduped_jobsites.base_number
  else deduped_jobsites.base_number || '-' || deduped_jobsites.duplicate_number::text
end
from deduped_jobsites
where target.id = deduped_jobsites.id;

alter table public.company_jobsites
alter column jobsite_number set not null;

alter table public.company_jobsites
drop constraint if exists company_jobsites_jobsite_number_nonempty;

alter table public.company_jobsites
add constraint company_jobsites_jobsite_number_nonempty
check (length(trim(jobsite_number)) > 0);

create unique index if not exists company_jobsites_company_jobsite_number_unique_ci_idx
on public.company_jobsites (company_id, lower(jobsite_number));

create table if not exists public.company_jobsite_schedule_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  title text not null,
  work_start_date date not null,
  work_end_date date null,
  trade text null,
  work_area text null,
  crew_or_contractor text null,
  status text not null default 'planned',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_jobsite_schedule_items_title_nonempty check (length(trim(title)) > 0),
  constraint company_jobsite_schedule_items_status_check check (
    status in ('planned', 'active', 'blocked', 'completed', 'archived')
  ),
  constraint company_jobsite_schedule_items_date_order check (
    work_end_date is null or work_end_date >= work_start_date
  )
);

create index if not exists company_jobsite_schedule_items_company_jobsite_date_idx
on public.company_jobsite_schedule_items(company_id, jobsite_id, work_start_date, work_end_date);

create index if not exists company_jobsite_schedule_items_active_idx
on public.company_jobsite_schedule_items(company_id, jobsite_id, status, archived_at)
where archived_at is null;

drop trigger if exists set_company_jobsite_schedule_items_updated_at on public.company_jobsite_schedule_items;
create trigger set_company_jobsite_schedule_items_updated_at
before update on public.company_jobsite_schedule_items
for each row execute function public.set_updated_at();

alter table public.company_jobsite_schedule_items enable row level security;

grant select, insert, update on public.company_jobsite_schedule_items to authenticated;
grant select, insert, update, delete on public.company_jobsite_schedule_items to service_role;

drop policy if exists company_jobsite_schedule_items_select_scope on public.company_jobsite_schedule_items;
create policy company_jobsite_schedule_items_select_scope
on public.company_jobsite_schedule_items for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_schedule_items_insert_scope on public.company_jobsite_schedule_items;
create policy company_jobsite_schedule_items_insert_scope
on public.company_jobsite_schedule_items for insert to authenticated
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_schedule_items.jobsite_id
      and jobsite.company_id = public.company_jobsite_schedule_items.company_id
  )
);

drop policy if exists company_jobsite_schedule_items_update_scope on public.company_jobsite_schedule_items;
create policy company_jobsite_schedule_items_update_scope
on public.company_jobsite_schedule_items for update to authenticated
using (public.security_is_company_member(company_id))
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_schedule_items.jobsite_id
      and jobsite.company_id = public.company_jobsite_schedule_items.company_id
  )
);
