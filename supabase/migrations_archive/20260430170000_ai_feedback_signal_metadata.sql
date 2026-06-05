alter table public.ai_output_feedback
  add column if not exists signal_metadata jsonb not null default '{}'::jsonb;

create index if not exists ai_output_feedback_signal_metadata_gin_idx
  on public.ai_output_feedback
  using gin (signal_metadata);
