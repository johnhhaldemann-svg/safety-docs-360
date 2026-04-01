-- Structured SOR hazard category for analytics / mapping to exposure event types (leading indicators).

alter table public.company_sor_records
  add column if not exists hazard_category_code text null;

alter table public.company_sor_records
  drop constraint if exists company_sor_records_hazard_category_code_check;

alter table public.company_sor_records
  add constraint company_sor_records_hazard_category_code_check check (
    hazard_category_code is null
    or hazard_category_code in (
      'falls_same_level',
      'falls_elevation',
      'struck_by',
      'caught_in_between',
      'overexertion',
      'contact_equipment',
      'hazardous_substance',
      'electrical',
      'material_handling',
      'ppe_behavioral',
      'environmental',
      'other'
    )
  );

comment on column public.company_sor_records.hazard_category_code is
  'Normalized hazard class for SOR; correlates to incident exposure_event_type for prediction analytics.';

create index if not exists company_sor_records_company_hazard_code_idx
  on public.company_sor_records (company_id, hazard_category_code)
  where hazard_category_code is not null and is_deleted = false;
