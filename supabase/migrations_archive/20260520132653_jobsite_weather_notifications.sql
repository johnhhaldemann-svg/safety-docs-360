alter table public.company_jobsites
add column if not exists zip_code text null,
add column if not exists weather_address_line_1 text null,
add column if not exists weather_address_line_2 text null,
add column if not exists weather_city text null,
add column if not exists weather_state text null,
add column if not exists weather_country text null default 'US',
add column if not exists weather_latitude numeric(9, 6) null,
add column if not exists weather_longitude numeric(9, 6) null,
add column if not exists weather_location_source text null,
add column if not exists weather_location_confidence text null,
add column if not exists nws_grid_id text null,
add column if not exists nws_grid_x integer null,
add column if not exists nws_grid_y integer null,
add column if not exists nws_forecast_url text null,
add column if not exists nws_forecast_hourly_url text null,
add column if not exists weather_enabled boolean not null default false,
add column if not exists weather_last_checked_at timestamptz null;

alter table public.company_jobsites
drop constraint if exists company_jobsites_weather_location_source_check;

alter table public.company_jobsites
add constraint company_jobsites_weather_location_source_check
check (
  weather_location_source is null
  or weather_location_source in ('address', 'zip_centroid', 'manual')
);

alter table public.company_jobsites
drop constraint if exists company_jobsites_weather_location_confidence_check;

alter table public.company_jobsites
add constraint company_jobsites_weather_location_confidence_check
check (
  weather_location_confidence is null
  or weather_location_confidence in ('high', 'medium', 'low')
);

alter table public.company_jobsites
drop constraint if exists company_jobsites_weather_latitude_range;

alter table public.company_jobsites
add constraint company_jobsites_weather_latitude_range
check (weather_latitude is null or weather_latitude between -90 and 90);

alter table public.company_jobsites
drop constraint if exists company_jobsites_weather_longitude_range;

alter table public.company_jobsites
add constraint company_jobsites_weather_longitude_range
check (weather_longitude is null or weather_longitude between -180 and 180);

create index if not exists company_jobsites_weather_enabled_idx
on public.company_jobsites(weather_enabled, weather_last_checked_at)
where weather_enabled = true;

create index if not exists company_jobsites_weather_location_idx
on public.company_jobsites(weather_latitude, weather_longitude)
where weather_latitude is not null and weather_longitude is not null;

create table if not exists public.jobsite_weather_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  channels text[] not null default array['in_app']::text[],
  min_severity text not null default 'watch',
  event_allowlist jsonb null,
  quiet_hours_start time null,
  quiet_hours_end time null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobsite_weather_subscriptions_unique unique (jobsite_id, user_id),
  constraint jobsite_weather_subscriptions_min_severity_check check (
    min_severity in ('advisory', 'watch', 'warning')
  ),
  constraint jobsite_weather_subscriptions_channels_check check (
    channels <@ array['in_app', 'email', 'sms', 'push']::text[]
    and cardinality(channels) > 0
  )
);

create index if not exists jobsite_weather_subscriptions_company_jobsite_idx
on public.jobsite_weather_subscriptions(company_id, jobsite_id, enabled);

create index if not exists jobsite_weather_subscriptions_user_idx
on public.jobsite_weather_subscriptions(user_id, enabled);

drop trigger if exists set_jobsite_weather_subscriptions_updated_at on public.jobsite_weather_subscriptions;
create trigger set_jobsite_weather_subscriptions_updated_at
before update on public.jobsite_weather_subscriptions
for each row execute function public.set_updated_at();

create table if not exists public.weather_alert_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  nws_alert_id text not null,
  event_name text not null,
  severity text null,
  urgency text null,
  certainty text null,
  headline text null,
  description text null,
  instruction text null,
  effective_at timestamptz null,
  expires_at timestamptz null,
  status text null,
  raw_payload_json jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint weather_alert_events_unique unique (jobsite_id, nws_alert_id)
);

create index if not exists weather_alert_events_company_jobsite_idx
on public.weather_alert_events(company_id, jobsite_id, last_seen_at desc);

create index if not exists weather_alert_events_expires_idx
on public.weather_alert_events(company_id, jobsite_id, expires_at desc);

create table if not exists public.weather_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  weather_alert_event_id uuid not null references public.weather_alert_events(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  sent_at timestamptz null,
  error_message text null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint weather_notification_deliveries_channel_check check (
    channel in ('in_app', 'email', 'sms', 'push')
  ),
  constraint weather_notification_deliveries_status_check check (
    status in ('pending', 'sent', 'skipped', 'failed')
  ),
  constraint weather_notification_deliveries_dedupe_unique unique (dedupe_key)
);

create index if not exists weather_notification_deliveries_user_idx
on public.weather_notification_deliveries(user_id, status, created_at desc);

create index if not exists weather_notification_deliveries_jobsite_idx
on public.weather_notification_deliveries(company_id, jobsite_id, created_at desc);

alter table public.jobsite_weather_subscriptions enable row level security;
alter table public.weather_alert_events enable row level security;
alter table public.weather_notification_deliveries enable row level security;

grant select, insert, update, delete on public.jobsite_weather_subscriptions to authenticated;
grant select on public.weather_alert_events to authenticated;
grant select on public.weather_notification_deliveries to authenticated;

grant select, insert, update, delete on public.jobsite_weather_subscriptions to service_role;
grant select, insert, update, delete on public.weather_alert_events to service_role;
grant select, insert, update, delete on public.weather_notification_deliveries to service_role;

drop policy if exists jobsite_weather_subscriptions_select_scope on public.jobsite_weather_subscriptions;
create policy jobsite_weather_subscriptions_select_scope
on public.jobsite_weather_subscriptions for select to authenticated
using (
  public.security_is_company_manager(company_id)
  or (
    user_id = auth.uid()
    and public.security_has_jobsite_access(company_id, jobsite_id)
  )
);

drop policy if exists jobsite_weather_subscriptions_insert_scope on public.jobsite_weather_subscriptions;
create policy jobsite_weather_subscriptions_insert_scope
on public.jobsite_weather_subscriptions for insert to authenticated
with check (
  (
    public.security_is_company_manager(company_id)
    or user_id = auth.uid()
  )
  and public.security_has_jobsite_access(company_id, jobsite_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.jobsite_weather_subscriptions.jobsite_id
      and jobsite.company_id = public.jobsite_weather_subscriptions.company_id
  )
);

drop policy if exists jobsite_weather_subscriptions_update_scope on public.jobsite_weather_subscriptions;
create policy jobsite_weather_subscriptions_update_scope
on public.jobsite_weather_subscriptions for update to authenticated
using (
  public.security_is_company_manager(company_id)
  or (
    user_id = auth.uid()
    and public.security_has_jobsite_access(company_id, jobsite_id)
  )
)
with check (
  (
    public.security_is_company_manager(company_id)
    or user_id = auth.uid()
  )
  and public.security_has_jobsite_access(company_id, jobsite_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.jobsite_weather_subscriptions.jobsite_id
      and jobsite.company_id = public.jobsite_weather_subscriptions.company_id
  )
);

drop policy if exists jobsite_weather_subscriptions_delete_scope on public.jobsite_weather_subscriptions;
create policy jobsite_weather_subscriptions_delete_scope
on public.jobsite_weather_subscriptions for delete to authenticated
using (
  public.security_is_company_manager(company_id)
  or (
    user_id = auth.uid()
    and public.security_has_jobsite_access(company_id, jobsite_id)
  )
);

drop policy if exists weather_alert_events_select_scope on public.weather_alert_events;
create policy weather_alert_events_select_scope
on public.weather_alert_events for select to authenticated
using (
  public.security_has_jobsite_access(company_id, jobsite_id)
);

drop policy if exists weather_notification_deliveries_select_scope on public.weather_notification_deliveries;
create policy weather_notification_deliveries_select_scope
on public.weather_notification_deliveries for select to authenticated
using (
  public.security_is_company_manager(company_id)
  or (
    user_id = auth.uid()
    and public.security_has_jobsite_access(company_id, jobsite_id)
  )
);
