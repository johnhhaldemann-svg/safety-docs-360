alter table public.jobsite_contractor_training_requirements
  add column if not exists apply_trades text[] not null default '{}'::text[],
  add column if not exists apply_positions text[] not null default '{}'::text[];

create index if not exists jobsite_contractor_training_requirements_trade_scope_idx
  on public.jobsite_contractor_training_requirements using gin (apply_trades);

create index if not exists jobsite_contractor_training_requirements_position_scope_idx
  on public.jobsite_contractor_training_requirements using gin (apply_positions);
