-- Scope training requirements by profile trade and site position (canonical lists in app).
alter table public.company_training_requirements
  add column if not exists apply_trades text[] not null default '{}'::text[],
  add column if not exists apply_positions text[] not null default '{}'::text[];

comment on column public.company_training_requirements.apply_trades is
  'Empty = applies to all trades; otherwise profile trade_specialty must match one value (case-insensitive).';
comment on column public.company_training_requirements.apply_positions is
  'Empty = applies to all positions; otherwise profile job_title must match one value (case-insensitive).';
