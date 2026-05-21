-- Structured injury nature (insurance / cost / recovery modeling), distinct from severity (low–critical).

alter table public.company_incidents
  add column if not exists injury_type text null;

alter table public.company_incidents
  drop constraint if exists company_incidents_injury_type_check;

alter table public.company_incidents
  add constraint company_incidents_injury_type_check check (
    injury_type is null
    or injury_type in (
      'strain',
      'sprain',
      'fracture',
      'laceration',
      'contusion',
      'burn',
      'amputation',
      'other'
    )
  );

comment on column public.company_incidents.injury_type is
  'Nature of injury (strain, fracture, etc.) for analytics and loss modeling. Null for near misses, hazards, or legacy rows.';

create index if not exists company_incidents_company_injury_type_idx
  on public.company_incidents (company_id, injury_type)
  where injury_type is not null;
