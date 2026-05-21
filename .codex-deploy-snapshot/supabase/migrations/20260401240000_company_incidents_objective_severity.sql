-- Objective severity (recordkeeping), distinct from subjective severity (low–critical).

alter table public.company_incidents
  add column if not exists recordable boolean not null default false;

alter table public.company_incidents
  add column if not exists lost_time boolean not null default false;

alter table public.company_incidents
  add column if not exists fatality boolean not null default false;

comment on column public.company_incidents.recordable is
  'OSHA-recordable case (medical treatment beyond first aid, etc.), independent of severity label.';

comment on column public.company_incidents.lost_time is
  'Lost-time case (days away or restricted beyond day of injury), DART-relevant.';

comment on column public.company_incidents.fatality is
  'Work-related fatality.';

create index if not exists company_incidents_company_recordable_idx
  on public.company_incidents (company_id, recordable)
  where recordable = true;

create index if not exists company_incidents_company_fatality_idx
  on public.company_incidents (company_id, fatality)
  where fatality = true;
