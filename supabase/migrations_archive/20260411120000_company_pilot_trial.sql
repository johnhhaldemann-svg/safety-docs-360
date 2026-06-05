-- 30-day pilot trial: placeholder company details OK until customer confirms full profile.

alter table public.companies
  add column if not exists pilot_trial_ends_at timestamptz null;

alter table public.companies
  add column if not exists pilot_converted_at timestamptz null;

comment on column public.companies.pilot_trial_ends_at is
  'When set and pilot_converted_at is null, workspace is in pilot trial until this instant.';

comment on column public.companies.pilot_converted_at is
  'Set when the company admin completes the full company profile (exits pilot placeholder mode).';
