-- Superadmin-controlled pricing overrides for company subscriptions.
-- Null means "use the default plan pricing."

alter table public.company_subscriptions
  add column if not exists subscription_price_cents integer null,
  add column if not exists seat_price_cents integer null;

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_subscription_price_cents_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_subscription_price_cents_check
  check (subscription_price_cents is null or subscription_price_cents >= 0);

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_seat_price_cents_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_seat_price_cents_check
  check (seat_price_cents is null or seat_price_cents >= 0);

comment on column public.company_subscriptions.subscription_price_cents is
  'Optional override for the recurring subscription price in cents. Null uses the default plan price.';

comment on column public.company_subscriptions.seat_price_cents is
  'Optional override for per-user seat/license pricing in cents. Null uses the default plan price.';
