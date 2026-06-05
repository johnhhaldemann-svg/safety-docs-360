create table if not exists public.platform_help_tickets (
  id uuid primary key default gen_random_uuid(),
  submitter_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  submitter_email text null,
  submitter_name text null,
  submitter_role text null,
  company_name text null,
  category text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  title text not null,
  description text not null,
  page_url text null,
  browser_user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  admin_notes text null,
  resolution_note text null,
  assigned_superadmin_user_id uuid null references auth.users(id) on delete set null,
  superadmin_seen_at timestamptz null,
  superadmin_seen_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  closed_at timestamptz null,
  constraint platform_help_tickets_category_check check (
    category in (
      'login_access',
      'documents',
      'jobsites',
      'billing',
      'integrations',
      'performance',
      'bug',
      'other'
    )
  ),
  constraint platform_help_tickets_priority_check check (
    priority in ('normal', 'high', 'critical')
  ),
  constraint platform_help_tickets_status_check check (
    status in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')
  ),
  constraint platform_help_tickets_title_nonempty check (length(trim(title)) > 0),
  constraint platform_help_tickets_description_nonempty check (length(trim(description)) > 0)
);

create index if not exists platform_help_tickets_submitter_idx
  on public.platform_help_tickets(submitter_user_id, created_at desc);

create index if not exists platform_help_tickets_company_idx
  on public.platform_help_tickets(company_id, created_at desc)
  where company_id is not null;

create index if not exists platform_help_tickets_queue_idx
  on public.platform_help_tickets(status, priority, created_at desc);

create index if not exists platform_help_tickets_unseen_idx
  on public.platform_help_tickets(created_at desc)
  where superadmin_seen_at is null and status in ('open', 'in_progress', 'waiting_on_user');

drop trigger if exists set_platform_help_tickets_updated_at on public.platform_help_tickets;
create trigger set_platform_help_tickets_updated_at
before update on public.platform_help_tickets
for each row execute function public.set_updated_at();

alter table public.platform_help_tickets enable row level security;

grant select, insert on public.platform_help_tickets to authenticated;
grant select, insert, update, delete on public.platform_help_tickets to service_role;

drop policy if exists "platform_help_tickets_select_submitter_or_superadmin"
  on public.platform_help_tickets;
create policy "platform_help_tickets_select_submitter_or_superadmin"
on public.platform_help_tickets for select to authenticated
using (
  submitter_user_id = (select auth.uid())
  or public.current_app_role() = 'super_admin'
);

drop policy if exists "platform_help_tickets_insert_own"
  on public.platform_help_tickets;
create policy "platform_help_tickets_insert_own"
on public.platform_help_tickets for insert to authenticated
with check (
  submitter_user_id = (select auth.uid())
);

drop policy if exists "platform_help_tickets_update_superadmin"
  on public.platform_help_tickets;
create policy "platform_help_tickets_update_superadmin"
on public.platform_help_tickets for update to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');
