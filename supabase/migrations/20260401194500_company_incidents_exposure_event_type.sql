-- Event/exposure type (OSHA/BLS-style loss event), distinct from incident `category` text.

alter table public.company_incidents
  add column if not exists exposure_event_type text null;

alter table public.company_incidents
  drop constraint if exists company_incidents_exposure_event_type_check;

alter table public.company_incidents
  add constraint company_incidents_exposure_event_type_check check (
    exposure_event_type is null
    or exposure_event_type in (
      'fall_same_level',
      'fall_to_lower_level',
      'struck_by_object',
      'caught_in_between',
      'overexertion',
      'contact_with_equipment',
      'exposure_harmful_substance',
      'electrical',
      'other'
    )
  );

comment on column public.company_incidents.exposure_event_type is
  'Structured event/exposure mechanism (falls, struck-by, etc.) for regulatory and loss modeling.';

create index if not exists company_incidents_company_exposure_event_type_idx
  on public.company_incidents (company_id, exposure_event_type)
  where exposure_event_type is not null;
