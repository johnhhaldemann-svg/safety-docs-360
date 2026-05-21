create table if not exists public.company_schedule_prediction_cache (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  input_fingerprint text not null,
  prediction_date date not null,
  status text not null default 'ok',
  ai_payload jsonb null,
  ai_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_schedule_prediction_cache_fingerprint_nonempty check (length(trim(input_fingerprint)) > 0),
  constraint company_schedule_prediction_cache_status_check check (status in ('ok', 'fallback'))
);

create unique index if not exists company_schedule_prediction_cache_daily_unique_idx
on public.company_schedule_prediction_cache(company_id, jobsite_id, input_fingerprint, prediction_date);

create index if not exists company_schedule_prediction_cache_company_jobsite_date_idx
on public.company_schedule_prediction_cache(company_id, jobsite_id, prediction_date desc);

drop trigger if exists set_company_schedule_prediction_cache_updated_at on public.company_schedule_prediction_cache;
create trigger set_company_schedule_prediction_cache_updated_at
before update on public.company_schedule_prediction_cache
for each row execute function public.set_updated_at();

alter table public.company_schedule_prediction_cache enable row level security;

grant select, insert, update on public.company_schedule_prediction_cache to authenticated;
grant select, insert, update, delete on public.company_schedule_prediction_cache to service_role;

drop policy if exists company_schedule_prediction_cache_select_scope on public.company_schedule_prediction_cache;
create policy company_schedule_prediction_cache_select_scope
on public.company_schedule_prediction_cache for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_schedule_prediction_cache_insert_scope on public.company_schedule_prediction_cache;
create policy company_schedule_prediction_cache_insert_scope
on public.company_schedule_prediction_cache for insert to authenticated
with check (
  public.security_is_company_member(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_schedule_prediction_cache.jobsite_id
      and jobsite.company_id = public.company_schedule_prediction_cache.company_id
  )
);

drop policy if exists company_schedule_prediction_cache_update_scope on public.company_schedule_prediction_cache;
create policy company_schedule_prediction_cache_update_scope
on public.company_schedule_prediction_cache for update to authenticated
using (public.security_is_company_member(company_id))
with check (
  public.security_is_company_member(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_schedule_prediction_cache.jobsite_id
      and jobsite.company_id = public.company_schedule_prediction_cache.company_id
  )
);
