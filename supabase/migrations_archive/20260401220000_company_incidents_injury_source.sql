-- Equipment / object source (SOR ↔ hazard ↔ outcome linkage).

alter table public.company_incidents
  add column if not exists injury_source text null;

alter table public.company_incidents
  drop constraint if exists company_incidents_injury_source_check;

alter table public.company_incidents
  add constraint company_incidents_injury_source_check check (
    injury_source is null
    or injury_source in (
      'ladder',
      'scaffold',
      'hand_tools',
      'heavy_equipment',
      'material_handling',
      'electrical_system',
      'other'
    )
  );

comment on column public.company_incidents.injury_source is
  'Equipment or object category involved (ladder, scaffold, etc.). API: JSON field `source`.';

create index if not exists company_incidents_company_injury_source_idx
  on public.company_incidents (company_id, injury_source)
  where injury_source is not null;
