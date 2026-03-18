create extension if not exists pgcrypto;

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount integer not null,
  transaction_type text not null,
  document_id uuid null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_id_idx
  on public.credit_transactions (user_id, created_at desc);

create index if not exists credit_transactions_document_id_idx
  on public.credit_transactions (document_id);
