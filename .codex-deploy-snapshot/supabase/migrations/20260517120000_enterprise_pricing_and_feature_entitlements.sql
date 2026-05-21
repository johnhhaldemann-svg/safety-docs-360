alter table public.company_subscriptions
  add column if not exists plan_tier_key text null,
  add column if not exists annual_platform_price_cents integer null,
  add column if not exists included_jobsite_limit integer null,
  add column if not exists included_user_limit integer null,
  add column if not exists included_page_credits integer null,
  add column if not exists onboarding_fee_cents integer null,
  add column if not exists enabled_feature_keys jsonb null,
  add column if not exists selected_addons jsonb not null default '[]'::jsonb,
  add column if not exists commercial_notes text null;

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_annual_platform_price_cents_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_annual_platform_price_cents_check
  check (annual_platform_price_cents is null or annual_platform_price_cents >= 0);

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_included_jobsite_limit_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_included_jobsite_limit_check
  check (included_jobsite_limit is null or included_jobsite_limit >= 0);

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_included_user_limit_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_included_user_limit_check
  check (included_user_limit is null or included_user_limit >= 0);

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_included_page_credits_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_included_page_credits_check
  check (included_page_credits is null or included_page_credits >= 0);

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_onboarding_fee_cents_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_onboarding_fee_cents_check
  check (onboarding_fee_cents is null or onboarding_fee_cents >= 0);

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_enabled_feature_keys_array_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_enabled_feature_keys_array_check
  check (enabled_feature_keys is null or jsonb_typeof(enabled_feature_keys) = 'array');

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_selected_addons_array_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_selected_addons_array_check
  check (jsonb_typeof(selected_addons) = 'array');

comment on column public.company_subscriptions.plan_tier_key is
  'Internal enterprise tier label assigned by platform admins.';

comment on column public.company_subscriptions.annual_platform_price_cents is
  'Annual platform contract price in integer cents used for admin draft invoices.';

comment on column public.company_subscriptions.included_jobsite_limit is
  'Number of active jobsites included in the company contract.';

comment on column public.company_subscriptions.included_user_limit is
  'Number of active or pending users/invites included in the company contract.';

comment on column public.company_subscriptions.included_page_credits is
  'Annual document page credits included in the company contract.';

comment on column public.company_subscriptions.enabled_feature_keys is
  'Manual company feature entitlement keys selected by platform admins. Null means legacy/unconfigured.';

