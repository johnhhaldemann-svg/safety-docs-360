create table if not exists public.marketplace_document_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  invoice_id uuid null references public.billing_invoices(id) on delete set null,
  purchased_by_user_id uuid null references auth.users(id) on delete set null,
  amount_cents bigint not null,
  currency text not null default 'usd',
  paid_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_document_purchases_amount_nonneg check (amount_cents >= 0),
  constraint marketplace_document_purchases_currency_check check (currency in ('usd'))
);

create unique index if not exists marketplace_document_purchases_company_document_uidx
  on public.marketplace_document_purchases(company_id, document_id);

create index if not exists marketplace_document_purchases_company_created_idx
  on public.marketplace_document_purchases(company_id, created_at desc);

create index if not exists marketplace_document_purchases_document_idx
  on public.marketplace_document_purchases(document_id);

create index if not exists marketplace_document_purchases_invoice_idx
  on public.marketplace_document_purchases(invoice_id);

drop trigger if exists set_marketplace_document_purchases_updated_at
  on public.marketplace_document_purchases;
create trigger set_marketplace_document_purchases_updated_at
before update on public.marketplace_document_purchases
for each row execute function public.set_updated_at();

alter table public.billing_invoices
  drop constraint if exists billing_invoices_billing_source_check;

alter table public.billing_invoices
  add constraint billing_invoices_billing_source_check
  check (
    billing_source in (
      'manual',
      'company_pricing',
      'recurring_company_pricing',
      'marketplace_credit_pack',
      'marketplace_document_purchase'
    )
  );

comment on table public.marketplace_document_purchases is
  'Company-level paid entitlements for global marketplace documents.';

comment on column public.marketplace_document_purchases.amount_cents is
  'Amount paid for the document entitlement, in integer cents.';

grant select on public.marketplace_document_purchases to authenticated;
grant insert, update, delete on public.marketplace_document_purchases to service_role;

alter table public.marketplace_document_purchases enable row level security;

drop policy if exists marketplace_document_purchases_select_company_scope
  on public.marketplace_document_purchases;
create policy marketplace_document_purchases_select_company_scope
on public.marketplace_document_purchases
for select
to authenticated
using (public.billing_user_can_access_company(company_id));
