create table if not exists public.ai_engine_recommendation_snapshots (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generated_at timestamptz not null default now(),
  snapshot_date date not null,
  surface text not null,
  window_days integer not null check (window_days >= 1 and window_days <= 30),
  aggregate_snapshot jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  summary text not null,
  summary_meta jsonb not null default '{}'::jsonb,
  generated_by uuid,
  unique (surface, window_days, snapshot_date)
);

create index if not exists ai_engine_recommendation_snapshots_scope_idx
  on public.ai_engine_recommendation_snapshots (surface, window_days, snapshot_date desc);

alter table public.ai_engine_recommendation_snapshots enable row level security;

-- Superadmin AI recommendation snapshots are service-role only. Route handlers
-- enforce `super_admin` before using the service-role client.
revoke all on public.ai_engine_recommendation_snapshots from public;
revoke all on public.ai_engine_recommendation_snapshots from authenticated;
revoke all on public.ai_engine_recommendation_snapshots from anon;

drop policy if exists "ai_engine_recommendation_snapshots_no_authenticated_select"
  on public.ai_engine_recommendation_snapshots;
create policy "ai_engine_recommendation_snapshots_no_authenticated_select"
on public.ai_engine_recommendation_snapshots
for select
to authenticated
using (false);
