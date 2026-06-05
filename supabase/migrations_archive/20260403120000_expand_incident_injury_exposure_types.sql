-- Expand allowed injury_type and exposure_event_type values (aligned with app lib/incidents).

alter table public.company_incidents
  drop constraint if exists company_incidents_injury_type_check;

alter table public.company_incidents
  add constraint company_incidents_injury_type_check check (
    injury_type is null
    or injury_type in (
      'abrasion',
      'amputation',
      'burn',
      'chemical_burn',
      'cold_injury',
      'concussion',
      'contusion',
      'crush_injury',
      'dislocation',
      'foreign_body',
      'fracture',
      'heat_illness',
      'hearing_loss',
      'insect_animal',
      'internal_injury',
      'laceration',
      'multiple_injuries',
      'poisoning',
      'puncture',
      'respiratory',
      'sprain',
      'strain',
      'vision_loss',
      'other'
    )
  );

alter table public.company_incidents
  drop constraint if exists company_incidents_exposure_event_type_check;

alter table public.company_incidents
  add constraint company_incidents_exposure_event_type_check check (
    exposure_event_type is null
    or exposure_event_type in (
      'caught_in_between',
      'caught_on_object',
      'confined_space',
      'contact_with_equipment',
      'drowning',
      'electrical',
      'excavation_collapse',
      'explosion',
      'exposure_harmful_substance',
      'fall_same_level',
      'fall_to_lower_level',
      'fire',
      'motor_vehicle',
      'noise_exposure',
      'overexertion',
      'repetitive_motion',
      'slip_trip_without_fall',
      'struck_against_object',
      'struck_by_object',
      'struck_by_vehicle',
      'structure_collapse',
      'temperature_extreme',
      'workplace_violence',
      'other'
    )
  );
