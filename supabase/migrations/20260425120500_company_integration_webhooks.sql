-- Outbound webhook subscriptions for enterprise integrations (MVP).

create table if not exists public.company_integration_webhooks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  target_url text not null,
  secret text not null,
  event_types jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_integration_webhooks_name_nonempty check (length(trim(name)) > 0),
  constraint company_integration_webhooks_url_nonempty check (length(trim(target_url)) > 0)
);

create index if not exists company_integration_webhooks_company_idx
  on public.company_integration_webhooks(company_id, active);

drop trigger if exists set_company_integration_webhooks_updated_at on public.company_integration_webhooks;
create trigger set_company_integration_webhooks_updated_at
before update on public.company_integration_webhooks
for each row execute function public.set_updated_at();

create table if not exists public.company_integration_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  webhook_id uuid not null references public.company_integration_webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  response_status int null,
  delivered_at timestamptz not null default now()
);

create index if not exists company_integration_webhook_deliveries_webhook_idx
  on public.company_integration_webhook_deliveries(webhook_id, delivered_at desc);

alter table public.company_integration_webhooks enable row level security;
alter table public.company_integration_webhook_deliveries enable row level security;

grant select, insert, update on public.company_integration_webhooks to authenticated;
grant select, insert on public.company_integration_webhook_deliveries to authenticated;

drop policy if exists "company_integration_webhooks_select_scope" on public.company_integration_webhooks;
create policy "company_integration_webhooks_select_scope"
on public.company_integration_webhooks for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
);

drop policy if exists "company_integration_webhooks_insert_scope" on public.company_integration_webhooks;
create policy "company_integration_webhooks_insert_scope"
on public.company_integration_webhooks for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
);

drop policy if exists "company_integration_webhooks_update_scope" on public.company_integration_webhooks;
create policy "company_integration_webhooks_update_scope"
on public.company_integration_webhooks for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhooks.company_id)
);

drop policy if exists "company_integration_webhook_deliveries_select_scope" on public.company_integration_webhook_deliveries;
create policy "company_integration_webhook_deliveries_select_scope"
on public.company_integration_webhook_deliveries for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhook_deliveries.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhook_deliveries.company_id)
);

drop policy if exists "company_integration_webhook_deliveries_insert_scope" on public.company_integration_webhook_deliveries;
create policy "company_integration_webhook_deliveries_insert_scope"
on public.company_integration_webhook_deliveries for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhook_deliveries.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_integration_webhook_deliveries.company_id)
);
