create table if not exists public.owner_change_log_entries (
  id uuid primary key default gen_random_uuid(),
  change_key text not null unique,
  changed_at timestamptz not null default now(),
  module_key text null,
  module_name text not null,
  plain_english_description text not null,
  files_changed text[] not null default '{}',
  pages_affected text[] not null default '{}',
  risk_level text not null default 'Medium',
  owner_review_required boolean not null default true,
  validation_checklist_url text null,
  related_page_url text null,
  customer_ready_status text not null default 'Needs owner review',
  why_changed text not null default '',
  what_could_break text not null default '',
  owner_manual_review text not null default '',
  safe_to_show_customer text not null default 'Needs Review',
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_change_log_entries_risk_level_check check (
    risk_level in ('Low', 'Medium', 'High')
  ),
  constraint owner_change_log_entries_customer_ready_status_check check (
    customer_ready_status in (
      'Not tested',
      'Blocked',
      'Needs owner review',
      'Approved for demo',
      'Approved for customer use'
    )
  ),
  constraint owner_change_log_entries_safe_to_show_check check (
    safe_to_show_customer in ('Yes', 'No', 'Needs Review')
  )
);

create index if not exists owner_change_log_entries_changed_at_idx
  on public.owner_change_log_entries (changed_at desc);

create index if not exists owner_change_log_entries_module_key_idx
  on public.owner_change_log_entries (module_key);

drop trigger if exists set_owner_change_log_entries_updated_at on public.owner_change_log_entries;
create trigger set_owner_change_log_entries_updated_at
before update on public.owner_change_log_entries
for each row
execute function public.set_updated_at();

alter table public.owner_change_log_entries enable row level security;

grant select, insert, update, delete on public.owner_change_log_entries to authenticated;

drop policy if exists "owner_change_log_entries_super_admin_only" on public.owner_change_log_entries;
create policy "owner_change_log_entries_super_admin_only"
on public.owner_change_log_entries
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');
