-- Exposure hours for insurance / OSHA-style rates: (cases × 200,000) / hours_worked.

alter table public.companies
  add column if not exists hours_worked double precision null;

alter table public.companies
  drop constraint if exists companies_hours_worked_check;

alter table public.companies
  add constraint companies_hours_worked_check check (
    hours_worked is null
    or (hours_worked >= 0 and hours_worked <= 1e15)
  );

comment on column public.companies.hours_worked is
  'Total hours worked for the same period as injury counts used in incident rate (typically annual); denominator for (incidents × 200,000) / hours_worked.';
