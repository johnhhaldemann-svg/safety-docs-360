-- Optional per-certification expiration dates (calendar dates, UTC).
-- Keys are exact certification strings as stored in certifications[].
alter table public.user_profiles
add column if not exists certification_expirations jsonb not null default '{}'::jsonb;

comment on column public.user_profiles.certification_expirations is
  'Map of certification label -> YYYY-MM-DD expiry. Omitted keys mean no expiry recorded (treated as current for compliance checks).';
