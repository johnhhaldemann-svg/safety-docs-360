-- Industry / trade benchmarking baselines (NAICS + reference injury rates for comparisons vs company metrics).

alter table public.companies
  add column if not exists industry_code text null;

alter table public.companies
  add column if not exists industry_injury_rate double precision null;

alter table public.companies
  add column if not exists trade_injury_rate double precision null;

comment on column public.companies.industry_code is
  'NAICS industry code (2–6 digits) for industry benchmarking.';

comment on column public.companies.industry_injury_rate is
  'Reference injury rate for the NAICS sector (e.g. per 100 FTE/year); use same unit as company computed rate.';

comment on column public.companies.trade_injury_rate is
  'Reference injury rate for primary trade / craft; use same unit as company computed rate.';

create index if not exists companies_industry_code_idx
  on public.companies (industry_code)
  where industry_code is not null;
