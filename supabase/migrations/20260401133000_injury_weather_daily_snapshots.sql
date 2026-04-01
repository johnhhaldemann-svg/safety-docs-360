create table if not exists public.injury_weather_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  generated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists injury_weather_daily_snapshots_date_idx
  on public.injury_weather_daily_snapshots(snapshot_date desc);

alter table public.injury_weather_daily_snapshots enable row level security;
grant select, insert, update on public.injury_weather_daily_snapshots to authenticated;

drop policy if exists "injury_weather_daily_snapshots_select_admin_only" on public.injury_weather_daily_snapshots;
create policy "injury_weather_daily_snapshots_select_admin_only"
on public.injury_weather_daily_snapshots
for select
to authenticated
using (public.is_admin_role());
