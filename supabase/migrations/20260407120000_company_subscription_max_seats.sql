-- Per-company seat cap (enforced when sending new company invites). Null = unlimited.
alter table public.company_subscriptions
  add column if not exists max_user_seats integer null;

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_max_user_seats_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_max_user_seats_check
  check (max_user_seats is null or max_user_seats >= 1);

comment on column public.company_subscriptions.max_user_seats is
  'Maximum company users + pending invites; null means no cap.';
