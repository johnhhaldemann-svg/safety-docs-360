create table if not exists public.training_expiration_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_context text not null,
  recipient_user_id uuid null references auth.users(id) on delete cascade,
  recipient_email text null,
  subject_type text not null,
  subject_id uuid not null,
  subject_user_id uuid null references auth.users(id) on delete set null,
  training_title text not null,
  expires_on date not null,
  reminder_stage text not null,
  source_table text not null,
  source_id uuid not null,
  channel text not null default 'email',
  status text not null default 'pending',
  attempt_count integer not null default 1,
  provider_message_id text null,
  error_message text null,
  dedupe_key text not null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_expiration_deliveries_context_check check (recipient_context in ('worker', 'safety_manager')),
  constraint training_expiration_deliveries_subject_check check (subject_type in ('app_user', 'tracked_employee', 'contractor_employee')),
  constraint training_expiration_deliveries_stage_check check (reminder_stage in ('30d', '14d', '7d', 'expired')),
  constraint training_expiration_deliveries_channel_check check (channel in ('email', 'in_app')),
  constraint training_expiration_deliveries_status_check check (status in ('pending', 'sent', 'skipped', 'failed')),
  constraint training_expiration_deliveries_attempt_check check (attempt_count > 0),
  constraint training_expiration_deliveries_title_nonempty check (length(trim(training_title)) > 0),
  constraint training_expiration_deliveries_dedupe_unique unique (dedupe_key)
);

create index if not exists training_expiration_deliveries_company_idx
  on public.training_expiration_notification_deliveries(company_id, reminder_stage, status, created_at desc);

create index if not exists training_expiration_deliveries_recipient_idx
  on public.training_expiration_notification_deliveries(recipient_user_id, company_id, created_at desc)
  where recipient_user_id is not null;

create index if not exists training_expiration_deliveries_subject_idx
  on public.training_expiration_notification_deliveries(company_id, subject_type, subject_id, expires_on desc);

drop trigger if exists set_training_expiration_notification_deliveries_updated_at
  on public.training_expiration_notification_deliveries;
create trigger set_training_expiration_notification_deliveries_updated_at
before update on public.training_expiration_notification_deliveries
for each row execute function public.set_updated_at();

alter table public.training_expiration_notification_deliveries enable row level security;

grant select on public.training_expiration_notification_deliveries to authenticated;
grant select, insert, update, delete on public.training_expiration_notification_deliveries to service_role;

drop policy if exists "training_expiration_deliveries_select_scope"
  on public.training_expiration_notification_deliveries;
create policy "training_expiration_deliveries_select_scope"
on public.training_expiration_notification_deliveries for select to authenticated
using (
  recipient_user_id = auth.uid()
  or public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.training_expiration_notification_deliveries.company_id
      and actor.status = 'active'
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.training_expiration_notification_deliveries.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
);
