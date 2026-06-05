create table if not exists public.owner_gus_validation_test_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  title text not null,
  scenario text not null,
  expected_focus text[] not null default '{}',
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_gus_validation_results (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid null references public.owner_gus_validation_test_cases (id) on delete set null,
  scenario text not null,
  gus_response text not null,
  validation_status text not null default 'needs_review',
  company_context_used text[] not null default '{}',
  source_rules_used text[] not null default '{}',
  warnings text[] not null default '{}',
  validation_findings jsonb not null default '[]'::jsonb,
  blocked_by_rules boolean not null default false,
  fallback_used boolean not null default false,
  approved_by uuid null references auth.users (id) on delete set null,
  approved_at timestamptz null,
  flagged_by uuid null references auth.users (id) on delete set null,
  flagged_at timestamptz null,
  notes text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_gus_validation_results_status_check check (
    validation_status in ('needs_review', 'approved', 'flagged')
  )
);

create index if not exists owner_gus_validation_test_cases_case_key_idx
  on public.owner_gus_validation_test_cases (case_key);

create index if not exists owner_gus_validation_results_created_at_idx
  on public.owner_gus_validation_results (created_at desc);

create index if not exists owner_gus_validation_results_test_case_id_idx
  on public.owner_gus_validation_results (test_case_id);

drop trigger if exists set_owner_gus_validation_test_cases_updated_at on public.owner_gus_validation_test_cases;
create trigger set_owner_gus_validation_test_cases_updated_at
before update on public.owner_gus_validation_test_cases
for each row
execute function public.set_updated_at();

drop trigger if exists set_owner_gus_validation_results_updated_at on public.owner_gus_validation_results;
create trigger set_owner_gus_validation_results_updated_at
before update on public.owner_gus_validation_results
for each row
execute function public.set_updated_at();

alter table public.owner_gus_validation_test_cases enable row level security;
alter table public.owner_gus_validation_results enable row level security;

grant select, insert, update, delete on public.owner_gus_validation_test_cases to authenticated;
grant select, insert, update, delete on public.owner_gus_validation_results to authenticated;

drop policy if exists "owner_gus_validation_test_cases_super_admin_only" on public.owner_gus_validation_test_cases;
create policy "owner_gus_validation_test_cases_super_admin_only"
on public.owner_gus_validation_test_cases
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

drop policy if exists "owner_gus_validation_results_super_admin_only" on public.owner_gus_validation_results;
create policy "owner_gus_validation_results_super_admin_only"
on public.owner_gus_validation_results
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');
