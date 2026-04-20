alter table public.company_training_requirements
  add column if not exists apply_sub_trades text[] not null default '{}'::text[],
  add column if not exists apply_task_codes text[] not null default '{}'::text[],
  add column if not exists is_generated boolean not null default false,
  add column if not exists generated_source_type text,
  add column if not exists generated_source_document_id uuid,
  add column if not exists generated_source_operation_key text;
