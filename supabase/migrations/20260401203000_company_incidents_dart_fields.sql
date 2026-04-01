-- DART-style outcomes: days away, restricted duty, job transfer (loss / OSHA analytics).

alter table public.company_incidents
  add column if not exists days_away_from_work integer not null default 0;

alter table public.company_incidents
  add column if not exists days_restricted integer not null default 0;

alter table public.company_incidents
  add column if not exists job_transfer boolean not null default false;

alter table public.company_incidents
  drop constraint if exists company_incidents_days_away_from_work_check;

alter table public.company_incidents
  add constraint company_incidents_days_away_from_work_check check (days_away_from_work >= 0);

alter table public.company_incidents
  drop constraint if exists company_incidents_days_restricted_check;

alter table public.company_incidents
  add constraint company_incidents_days_restricted_check check (days_restricted >= 0);

comment on column public.company_incidents.days_away_from_work is
  'Calendar days away from work attributable to the case (DART / severity proxy).';

comment on column public.company_incidents.days_restricted is
  'Days on restricted / light duty attributable to the case.';

comment on column public.company_incidents.job_transfer is
  'Whether the worker was transferred to another job due to the case (DART transfer).';

create index if not exists company_incidents_company_dart_idx
  on public.company_incidents (company_id, days_away_from_work, days_restricted)
  where days_away_from_work > 0 or days_restricted > 0 or job_transfer = true;
