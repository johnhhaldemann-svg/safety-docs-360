-- Time-based dimensions derived from occurred_at (UTC) for seasonal / circadian analytics and injury-weather models.

alter table public.company_incidents
  add column if not exists injury_month smallint null;

alter table public.company_incidents
  add column if not exists injury_season text null;

alter table public.company_incidents
  add column if not exists injury_day_of_week text null;

alter table public.company_incidents
  add column if not exists injury_time_of_day text null;

alter table public.company_incidents
  drop constraint if exists company_incidents_injury_month_check;

alter table public.company_incidents
  add constraint company_incidents_injury_month_check check (
    injury_month is null or (injury_month >= 1 and injury_month <= 12)
  );

alter table public.company_incidents
  drop constraint if exists company_incidents_injury_season_check;

alter table public.company_incidents
  add constraint company_incidents_injury_season_check check (
    injury_season is null
    or injury_season in ('winter', 'spring', 'summer', 'fall')
  );

alter table public.company_incidents
  drop constraint if exists company_incidents_injury_day_of_week_check;

alter table public.company_incidents
  add constraint company_incidents_injury_day_of_week_check check (
    injury_day_of_week is null
    or injury_day_of_week in (
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    )
  );

alter table public.company_incidents
  drop constraint if exists company_incidents_injury_time_of_day_check;

alter table public.company_incidents
  add constraint company_incidents_injury_time_of_day_check check (
    injury_time_of_day is null
    or injury_time_of_day in (
      'night',
      'early_morning',
      'morning',
      'afternoon',
      'evening'
    )
  );

comment on column public.company_incidents.injury_month is 'Calendar month (1–12) from occurred_at UTC.';
comment on column public.company_incidents.injury_season is 'Meteorological season from occurred_at UTC (northern hemisphere).';
comment on column public.company_incidents.injury_day_of_week is 'Day of week from occurred_at UTC.';
comment on column public.company_incidents.injury_time_of_day is 'UTC hour band from occurred_at.';

create index if not exists company_incidents_company_injury_month_idx
  on public.company_incidents (company_id, injury_month)
  where injury_month is not null;

create index if not exists company_incidents_company_injury_season_idx
  on public.company_incidents (company_id, injury_season)
  where injury_season is not null;
