-- Predictability Engine data-source controls and privacy-safe aggregate contracts.

alter table public.companies
  add column if not exists predictability_settings jsonb not null default
    '{
      "predictabilityDataMode": "company_then_platform_then_osha",
      "allowCompanyData": true,
      "allowPlatformAggregateFallback": true,
      "allowOshaFallback": true,
      "visibleBenchmarkSources": ["company", "platform_aggregate", "osha"]
    }'::jsonb;

comment on column public.companies.predictability_settings is
  'Company-level Predictability Engine source settings. Company-specific predictions remain scoped by company_id; platform fallback uses aggregate benchmark data only.';

create table if not exists public.platform_predictability_aggregates (
  id uuid primary key default gen_random_uuid(),
  industry text null,
  company_size_bucket text null,
  region text null,
  incident_type text null,
  job_type text null,
  time_period date null,
  record_count integer not null default 0,
  company_count integer not null default 0,
  observation_days integer not null default 0,
  risk_score double precision null,
  aggregate_payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_predictability_aggregates_nonnegative_counts check (
    record_count >= 0
    and company_count >= 0
    and observation_days >= 0
  ),
  constraint platform_predictability_aggregates_no_company_identifiers check (
    not (aggregate_payload ? 'company_id')
    and not (aggregate_payload ? 'company_ids')
    and not (aggregate_payload ? 'company_name')
    and not (aggregate_payload ? 'company_names')
  )
);

comment on table public.platform_predictability_aggregates is
  'Pre-aggregated, anonymized Predictability Engine benchmark buckets. Do not store raw company records, company IDs, or company names.';

comment on column public.platform_predictability_aggregates.company_count is
  'Number of companies represented in this aggregate bucket; resolver requires a minimum group size before use.';

create index if not exists platform_predictability_aggregates_privacy_idx
  on public.platform_predictability_aggregates (company_count, record_count, observation_days);

create index if not exists platform_predictability_aggregates_dimensions_idx
  on public.platform_predictability_aggregates (industry, company_size_bucket, region, incident_type, job_type, time_period);

alter table public.platform_predictability_aggregates enable row level security;
revoke all on public.platform_predictability_aggregates from anon;
revoke all on public.platform_predictability_aggregates from authenticated;

create table if not exists public.osha_predictability_baselines (
  id uuid primary key default gen_random_uuid(),
  industry text not null default 'construction',
  incident_type text null,
  job_type text null,
  period_label text null,
  baseline_rate double precision null,
  source_url text null,
  source_note text not null default 'Public OSHA/BLS baseline reference.',
  baseline_payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.osha_predictability_baselines is
  'Public OSHA/BLS baseline values used when company and privacy-safe platform aggregate data are insufficient.';

create index if not exists osha_predictability_baselines_dimensions_idx
  on public.osha_predictability_baselines (industry, incident_type, job_type, period_label);

alter table public.osha_predictability_baselines enable row level security;
revoke all on public.osha_predictability_baselines from anon;
revoke all on public.osha_predictability_baselines from authenticated;
