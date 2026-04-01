-- Stores each historical back-test run so we can track whether the model is improving vs outcomes.
-- Rows are written by the server with the Supabase service role (bypasses RLS).

create table if not exists public.injury_weather_backtest_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  lookback_months int not null,
  pearson_structural_vs_incidents double precision null,
  spearman_structural_vs_incidents double precision null,
  pearson_likelihood_vs_incidents double precision null,
  spearman_likelihood_vs_incidents double precision null,
  pearson_cases_vs_incidents double precision null,
  spearman_cases_vs_incidents double precision null,
  row_count int not null default 0,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists injury_weather_backtest_runs_run_at_idx
  on public.injury_weather_backtest_runs(run_at desc);

alter table public.injury_weather_backtest_runs enable row level security;

grant select on public.injury_weather_backtest_runs to authenticated;

drop policy if exists "injury_weather_backtest_runs_select_admin" on public.injury_weather_backtest_runs;
create policy "injury_weather_backtest_runs_select_admin"
on public.injury_weather_backtest_runs
for select
to authenticated
using (public.is_admin_role());
