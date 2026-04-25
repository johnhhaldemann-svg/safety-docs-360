-- Append-only telemetry of every OpenAI Responses API call routed through
-- lib/ai/responses.ts (any AI subsystem). Service-role only; no end-user
-- visibility. Used to build cost/latency dashboards and debug regressions.

create table if not exists public.ai_call_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  surface text not null,
  model text,
  prompt_hash text,
  latency_ms integer not null,
  status text not null check (status in ('ok', 'fallback', 'http_error', 'exception')),
  http_status integer,
  attempts integer not null default 1 check (attempts >= 1),
  fallback_used boolean not null default false,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  error_message text
);

create index if not exists ai_call_log_created_at_idx
  on public.ai_call_log (created_at desc);

create index if not exists ai_call_log_surface_created_at_idx
  on public.ai_call_log (surface, created_at desc);

create index if not exists ai_call_log_status_created_at_idx
  on public.ai_call_log (status, created_at desc);

alter table public.ai_call_log enable row level security;

-- No grants to authenticated/anon. Only the service role (which bypasses RLS)
-- can insert or read these rows. Keeping the table behind RLS prevents
-- accidental client exposure even if a future grant is added.
revoke all on public.ai_call_log from public;
revoke all on public.ai_call_log from authenticated;
revoke all on public.ai_call_log from anon;

drop policy if exists "ai_call_log_no_anon_select" on public.ai_call_log;
create policy "ai_call_log_no_anon_select"
on public.ai_call_log
for select
to authenticated
using (false);
