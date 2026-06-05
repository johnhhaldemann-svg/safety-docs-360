alter table public.weather_notification_deliveries
add column if not exists recipient_employee_id uuid null references public.company_employee_profiles(id) on delete set null;

alter table public.weather_notification_deliveries
alter column user_id drop not null;

alter table public.weather_notification_deliveries
drop constraint if exists weather_notification_deliveries_recipient_check;

alter table public.weather_notification_deliveries
add constraint weather_notification_deliveries_recipient_check
check (
  user_id is not null
  or recipient_employee_id is not null
);

create index if not exists weather_notification_deliveries_employee_idx
on public.weather_notification_deliveries(recipient_employee_id, status, created_at desc)
where recipient_employee_id is not null;
