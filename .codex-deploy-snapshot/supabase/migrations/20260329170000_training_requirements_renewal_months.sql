-- Optional typical renewal period for documentation / UX (months).
-- Worker-entered expiration dates on user_profiles remain authoritative for matrix matching.
alter table public.company_training_requirements
add column if not exists renewal_months integer null;

comment on column public.company_training_requirements.renewal_months is
  'Optional typical renewal period in months (company policy hint). Null if not set. Valid range enforced in application (1–600).';
