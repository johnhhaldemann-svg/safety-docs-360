-- Recurring company billing support.
-- These fields make recurring invoice generation idempotent per monthly billing period.

alter table public.billing_invoices
  add column if not exists billing_source text not null default 'manual',
  add column if not exists billing_period_key text null,
  add column if not exists billing_period_start date null,
  add column if not exists billing_period_end date null;

alter table public.billing_invoices
  drop constraint if exists billing_invoices_billing_source_check;

alter table public.billing_invoices
  add constraint billing_invoices_billing_source_check
  check (
    billing_source in (
      'manual',
      'company_pricing',
      'recurring_company_pricing'
    )
  );

create index if not exists billing_invoices_billing_period_key_idx
  on public.billing_invoices (company_id, billing_source, billing_period_key);

create unique index if not exists billing_invoices_recurring_period_unique_idx
  on public.billing_invoices (company_id, billing_period_key)
  where billing_source = 'recurring_company_pricing' and billing_period_key is not null;

comment on column public.billing_invoices.billing_source is
  'Origin of the invoice: manual, company_pricing, or recurring_company_pricing.';

comment on column public.billing_invoices.billing_period_key is
  'UTC billing period key (YYYY-MM) for recurring company invoices.';

comment on column public.billing_invoices.billing_period_start is
  'UTC date for the beginning of the recurring billing period.';

comment on column public.billing_invoices.billing_period_end is
  'UTC date for the end of the recurring billing period.';

