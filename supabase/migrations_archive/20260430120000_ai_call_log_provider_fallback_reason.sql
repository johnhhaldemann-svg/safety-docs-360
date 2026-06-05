alter table public.ai_call_log
  add column if not exists provider text,
  add column if not exists fallback_reason text;

create index if not exists ai_call_log_provider_created_at_idx
  on public.ai_call_log (provider, created_at desc);
