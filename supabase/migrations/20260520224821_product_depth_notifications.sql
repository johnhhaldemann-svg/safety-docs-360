create table if not exists public.company_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  title text not null,
  body text null,
  priority text not null default 'normal',
  href text null,
  source_table text null,
  source_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint company_notifications_title_nonempty check (length(trim(title)) > 0),
  constraint company_notifications_priority_check check (priority in ('low', 'normal', 'high', 'critical'))
);

create index if not exists company_notifications_recipient_unread_idx
  on public.company_notifications(recipient_user_id, company_id, created_at desc)
  where read_at is null and archived_at is null;

create index if not exists company_notifications_company_event_idx
  on public.company_notifications(company_id, event_type, created_at desc);

create index if not exists company_notifications_source_idx
  on public.company_notifications(source_table, source_id)
  where source_table is not null and source_id is not null;

create table if not exists public.company_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_notification_preferences_event_nonempty check (length(trim(event_type)) > 0),
  constraint company_notification_preferences_unique unique (company_id, user_id, event_type)
);

create index if not exists company_notification_preferences_user_idx
  on public.company_notification_preferences(user_id, company_id);

drop trigger if exists set_company_notification_preferences_updated_at on public.company_notification_preferences;
create trigger set_company_notification_preferences_updated_at
before update on public.company_notification_preferences
for each row execute function public.set_updated_at();

alter table public.company_notifications enable row level security;
alter table public.company_notification_preferences enable row level security;

grant select, insert, update on public.company_notifications to authenticated;
grant select, insert, update on public.company_notification_preferences to authenticated;

drop policy if exists "company_notifications_select_recipient_or_admin" on public.company_notifications;
create policy "company_notifications_select_recipient_or_admin"
on public.company_notifications for select to authenticated
using (
  recipient_user_id = auth.uid()
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
      and actor.status = 'active'
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
);

drop policy if exists "company_notifications_insert_company_scope" on public.company_notifications;
create policy "company_notifications_insert_company_scope"
on public.company_notifications for insert to authenticated
with check (
  public.is_admin_role()
  or recipient_user_id = auth.uid()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
      and actor.status = 'active'
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
  )
);

drop policy if exists "company_notifications_update_recipient_or_admin" on public.company_notifications;
create policy "company_notifications_update_recipient_or_admin"
on public.company_notifications for update to authenticated
using (
  recipient_user_id = auth.uid()
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
      and actor.status = 'active'
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
)
with check (
  recipient_user_id = auth.uid()
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
      and actor.status = 'active'
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notifications.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
);

drop policy if exists "company_notification_preferences_select_self_or_admin" on public.company_notification_preferences;
create policy "company_notification_preferences_select_self_or_admin"
on public.company_notification_preferences for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notification_preferences.company_id
      and actor.status = 'active'
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notification_preferences.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
);

drop policy if exists "company_notification_preferences_insert_self" on public.company_notification_preferences;
create policy "company_notification_preferences_insert_self"
on public.company_notification_preferences for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_notification_preferences.company_id
      and actor.status = 'active'
  )
);

drop policy if exists "company_notification_preferences_update_self" on public.company_notification_preferences;
create policy "company_notification_preferences_update_self"
on public.company_notification_preferences for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
