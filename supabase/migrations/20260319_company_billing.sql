create table if not exists public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  status text not null default 'inactive',
  plan_name text null,
  credit_balance integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create table if not exists public.company_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  amount integer not null,
  transaction_type text not null,
  document_id uuid null references public.documents(id) on delete set null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_credit_transactions_company_created_at_idx
  on public.company_credit_transactions(company_id, created_at desc);

insert into public.company_subscriptions (company_id, status)
select distinct
  c.id,
  coalesce(
    (
      select s.status
      from public.subscriptions s
      join public.user_roles ur on ur.user_id = s.user_id
      where ur.company_id = c.id
      order by s.created_at desc nulls last
      limit 1
    ),
    'inactive'
  ) as status
from public.companies c
on conflict (company_id) do nothing;
