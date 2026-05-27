create table if not exists public.owner_validation_modules (
  module_key text primary key,
  display_name text not null,
  status text not null default 'gray',
  summary text not null default 'Not tested yet.',
  last_tested_at timestamptz null,
  last_tested_by uuid null references auth.users (id) on delete set null,
  related_page_url text null,
  customer_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_validation_modules_status_check check (status in ('green', 'yellow', 'red', 'gray'))
);

create table if not exists public.owner_validation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  started_by uuid null references auth.users (id) on delete set null,
  overall_status text not null default 'gray',
  overall_score integer not null default 0,
  passed_count integer not null default 0,
  warning_count integer not null default 0,
  failed_count integer not null default 0,
  summary text not null default 'Validation run started.',
  created_at timestamptz not null default now(),
  constraint owner_validation_runs_status_check check (overall_status in ('green', 'yellow', 'red', 'gray')),
  constraint owner_validation_runs_score_check check (overall_score between 0 and 100),
  constraint owner_validation_runs_counts_check check (
    passed_count >= 0 and warning_count >= 0 and failed_count >= 0
  )
);

create table if not exists public.owner_validation_check_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.owner_validation_runs (id) on delete cascade,
  module_key text not null references public.owner_validation_modules (module_key) on delete cascade,
  check_name text not null,
  status text not null,
  result text not null,
  technical_details jsonb null,
  recommended_owner_action text null,
  created_at timestamptz not null default now(),
  constraint owner_validation_check_results_status_check check (status in ('green', 'yellow', 'red', 'gray'))
);

create table if not exists public.owner_manual_review_items (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.owner_validation_modules (module_key) on delete cascade,
  checklist_item text not null,
  completed boolean not null default false,
  completed_by uuid null references auth.users (id) on delete set null,
  completed_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_customer_ready_gates (
  module_key text primary key references public.owner_validation_modules (module_key) on delete cascade,
  automated_validation_status text not null default 'gray',
  owner_visual_review_status text not null default 'not_started',
  customer_ready boolean not null default false,
  blocking_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_customer_ready_gates_auto_status_check check (
    automated_validation_status in ('green', 'yellow', 'red', 'gray')
  ),
  constraint owner_customer_ready_gates_review_status_check check (
    owner_visual_review_status in ('not_started', 'passed', 'needs_review', 'failed')
  ),
  constraint owner_customer_ready_gates_ready_check check (
    customer_ready = false
    or (
      automated_validation_status = 'green'
      and owner_visual_review_status = 'passed'
      and blocking_reason is null
    )
  )
);

create index if not exists owner_validation_modules_status_idx
  on public.owner_validation_modules (status);

create index if not exists owner_validation_runs_started_at_idx
  on public.owner_validation_runs (started_at desc);

create index if not exists owner_validation_check_results_run_id_idx
  on public.owner_validation_check_results (run_id);

create index if not exists owner_validation_check_results_module_key_idx
  on public.owner_validation_check_results (module_key);

create index if not exists owner_manual_review_items_module_key_idx
  on public.owner_manual_review_items (module_key);

drop trigger if exists set_owner_validation_modules_updated_at on public.owner_validation_modules;
create trigger set_owner_validation_modules_updated_at
before update on public.owner_validation_modules
for each row
execute function public.set_updated_at();

drop trigger if exists set_owner_manual_review_items_updated_at on public.owner_manual_review_items;
create trigger set_owner_manual_review_items_updated_at
before update on public.owner_manual_review_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_owner_customer_ready_gates_updated_at on public.owner_customer_ready_gates;
create trigger set_owner_customer_ready_gates_updated_at
before update on public.owner_customer_ready_gates
for each row
execute function public.set_updated_at();

alter table public.owner_validation_modules enable row level security;
alter table public.owner_validation_runs enable row level security;
alter table public.owner_validation_check_results enable row level security;
alter table public.owner_manual_review_items enable row level security;
alter table public.owner_customer_ready_gates enable row level security;

grant select, insert, update, delete on public.owner_validation_modules to authenticated;
grant select, insert, update, delete on public.owner_validation_runs to authenticated;
grant select, insert, update, delete on public.owner_validation_check_results to authenticated;
grant select, insert, update, delete on public.owner_manual_review_items to authenticated;
grant select, insert, update, delete on public.owner_customer_ready_gates to authenticated;

drop policy if exists "owner_validation_modules_super_admin_only" on public.owner_validation_modules;
create policy "owner_validation_modules_super_admin_only"
on public.owner_validation_modules
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

drop policy if exists "owner_validation_runs_super_admin_only" on public.owner_validation_runs;
create policy "owner_validation_runs_super_admin_only"
on public.owner_validation_runs
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

drop policy if exists "owner_validation_check_results_super_admin_only" on public.owner_validation_check_results;
create policy "owner_validation_check_results_super_admin_only"
on public.owner_validation_check_results
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

drop policy if exists "owner_manual_review_items_super_admin_only" on public.owner_manual_review_items;
create policy "owner_manual_review_items_super_admin_only"
on public.owner_manual_review_items
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

drop policy if exists "owner_customer_ready_gates_super_admin_only" on public.owner_customer_ready_gates;
create policy "owner_customer_ready_gates_super_admin_only"
on public.owner_customer_ready_gates
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');
