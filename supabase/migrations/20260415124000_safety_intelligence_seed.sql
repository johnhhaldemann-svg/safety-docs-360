insert into public.platform_trades (code, name, description, metadata)
values
  ('welding', 'Welding', 'Hot work and metal fabrication operations.', '{"hazard_families":["hot_work","fire","fumes"]}'::jsonb),
  ('electrical', 'Electrical', 'Energized and de-energized electrical construction work.', '{"hazard_families":["electrical","arc_flash"]}'::jsonb),
  ('excavation', 'Excavation', 'Excavation, trenching, shoring, and soil disturbance work.', '{"hazard_families":["excavation","struck_by","utility_strike"]}'::jsonb),
  ('scaffolding', 'Scaffolding', 'Scaffold erection, modification, and dismantle work.', '{"hazard_families":["fall","overhead_work"]}'::jsonb),
  ('painting', 'Painting', 'Painting, coatings, solvents, and finish work.', '{"hazard_families":["flammables","fumes","line_of_fire"]}'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();

insert into public.platform_task_templates (
  trade_id,
  code,
  name,
  equipment_used,
  work_conditions,
  hazard_families,
  required_controls,
  permit_triggers,
  training_requirements,
  weather_sensitivity,
  metadata
)
select
  t.id,
  x.code,
  x.name,
  x.equipment_used,
  x.work_conditions,
  x.hazard_families,
  x.required_controls,
  x.permit_triggers,
  x.training_requirements,
  x.weather_sensitivity::public.si_weather_sensitivity,
  x.metadata
from public.platform_trades t
join (
  values
    ('welding', 'hot_work_welding', 'Welding and hot work', array['welder','grinder']::text[], array['interior','active_zone']::text[], array['hot_work','fire','fumes']::text[], array['fire_watch','spark_containment','ppe_face_shield']::text[], array['hot_work_permit']::text[], array['hot_work_training']::text[], 'medium', '{"document_types":["jsa","permit","work_plan"]}'::jsonb),
    ('electrical', 'energized_troubleshooting', 'Energized troubleshooting', array['meter','hand_tools']::text[], array['energized_system']::text[], array['electrical','arc_flash']::text[], array['loto','arc_flash_ppe','qualified_worker']::text[], array['energized_electrical_permit']::text[], array['nfpa70e','qualified_electrical_worker']::text[], 'low', '{"document_types":["jsa","permit","sop"]}'::jsonb),
    ('excavation', 'excavation_trenching', 'Excavation and trenching', array['excavator','shoring']::text[], array['soil_disturbance','public_interface']::text[], array['excavation','collapse','utility_strike']::text[], array['competent_person','barricade','access_egress']::text[], array['excavation_permit']::text[], array['competent_person_excavation']::text[], 'high', '{"document_types":["jsa","permit","work_plan"]}'::jsonb),
    ('scaffolding', 'scaffold_erection', 'Scaffold erection', array['scaffold_components','fall_protection']::text[], array['elevated_work','shared_area']::text[], array['fall','overhead_work']::text[], array['toe_boards','drop_zone_control','fall_protection']::text[], array['elevated_work_notice']::text[], array['scaffold_user_training']::text[], 'high', '{"document_types":["jsa","work_plan"]}'::jsonb),
    ('painting', 'spray_painting', 'Spray painting and coatings', array['sprayer','respirator']::text[], array['enclosed_area','flammables']::text[], array['flammables','fumes']::text[], array['ventilation','ignition_source_control','respiratory_protection']::text[], array['hot_work_exclusion_zone']::text[], array['hazcom','respiratory_protection']::text[], 'medium', '{"document_types":["jsa","work_plan"]}'::jsonb)
) as x(trade_code, code, name, equipment_used, work_conditions, hazard_families, required_controls, permit_triggers, training_requirements, weather_sensitivity, metadata)
  on x.trade_code = t.code
on conflict (code) do update
set
  name = excluded.name,
  equipment_used = excluded.equipment_used,
  work_conditions = excluded.work_conditions,
  hazard_families = excluded.hazard_families,
  required_controls = excluded.required_controls,
  permit_triggers = excluded.permit_triggers,
  training_requirements = excluded.training_requirements,
  weather_sensitivity = excluded.weather_sensitivity,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();

insert into public.platform_permit_trigger_rules (
  permit_code,
  trade_code,
  task_template_code,
  hazard_family,
  work_condition,
  weather_condition,
  rationale,
  required_controls,
  metadata
)
values
  ('hot_work_permit', 'welding', 'hot_work_welding', 'hot_work', 'active_zone', null, 'Hot work in active areas requires permit review, ignition control, and fire watch coverage.', array['fire_watch','spark_containment','hot_work_monitoring']::text[], '{"document_types":["jsa","permit"]}'::jsonb),
  ('energized_electrical_permit', 'electrical', 'energized_troubleshooting', 'electrical', 'energized_system', null, 'Energized troubleshooting requires permit authorization, qualified worker verification, and shock/arc-flash controls.', array['loto','arc_flash_ppe','qualified_worker']::text[], '{"document_types":["jsa","permit","sop"]}'::jsonb),
  ('excavation_permit', 'excavation', 'excavation_trenching', 'excavation', 'soil_disturbance', 'rain', 'Excavation in disturbed or wet ground conditions requires permit controls, competent person review, and public protection.', array['competent_person','barricade','access_egress']::text[], '{"document_types":["jsa","permit","work_plan"]}'::jsonb),
  ('elevated_work_notice', 'scaffolding', 'scaffold_erection', 'overhead_work', 'shared_area', null, 'Scaffold erection in shared work zones requires notice, drop-zone controls, and overhead protection planning.', array['drop_zone_control','toe_boards','fall_protection']::text[], '{"document_types":["jsa","work_plan"]}'::jsonb)
on conflict do nothing;

insert into public.platform_conflict_rules (
  conflict_code,
  conflict_type,
  left_trade_code,
  left_task_code,
  left_hazard_family,
  right_trade_code,
  right_task_code,
  right_hazard_family,
  requires_same_area,
  requires_time_overlap,
  weather_condition,
  severity,
  rationale,
  recommended_controls,
  metadata
)
values
  ('welding_near_painters', 'trade_vs_trade', 'welding', 'hot_work_welding', 'hot_work', 'painting', 'spray_painting', 'flammables', true, true, null, 'critical', 'Hot work near painters creates ignition and vapor exposure risk.', array['separate_work_windows','fire_watch','ventilation']::text[], '{"left":"welding","right":"painting"}'::jsonb),
  ('scaffold_above_electricians', 'overhead_location', 'scaffolding', 'scaffold_erection', 'overhead_work', 'electrical', 'energized_troubleshooting', 'electrical', true, true, null, 'high', 'Scaffold erection above electrical crews creates overhead dropped-object exposure.', array['drop_zone_control','sequence_shift','toe_boards']::text[], '{"left":"scaffolding","right":"electrical"}'::jsonb),
  ('excavation_pedestrian_route', 'location_overlap', 'excavation', 'excavation_trenching', 'excavation', null, null, 'pedestrian_route', true, true, 'rain', 'high', 'Excavation adjacent to pedestrian routes requires barricades, rerouting, and additional controls in wet conditions.', array['reroute_pedestrians','barricade','spotter']::text[], '{"left":"excavation","right":"pedestrian_route"}'::jsonb),
  ('crane_pick_active_work_zone', 'permit_overlap', null, 'crane_pick', 'line_of_fire', null, null, 'active_work_zone', true, true, 'wind', 'critical', 'Crane picks over active work zones require exclusion zones, lift planning, and wind checks.', array['lift_plan','exclusion_zone','signal_person']::text[], '{"left":"crane_pick","right":"active_work_zone"}'::jsonb),
  ('energized_mechanical_startup', 'task_vs_task', 'electrical', 'energized_troubleshooting', 'electrical', null, 'mechanical_startup', 'unexpected_energization', true, true, null, 'critical', 'Energized electrical work near mechanical startup creates unexpected energization risk.', array['loto','startup_hold','coordination_meeting']::text[], '{"left":"energized_electrical","right":"mechanical_startup"}'::jsonb),
  ('overhead_finishing_crews', 'hazard_propagation', null, null, 'overhead_work', null, null, 'finishing_crews', true, true, null, 'high', 'Overhead work above finishing crews creates line-of-fire and dropped-object exposure.', array['staggered_schedule','overhead_protection','drop_zone_control']::text[], '{"left":"overhead_work","right":"finishing_crews"}'::jsonb)
on conflict (conflict_code) do update
set
  conflict_type = excluded.conflict_type,
  left_trade_code = excluded.left_trade_code,
  left_task_code = excluded.left_task_code,
  left_hazard_family = excluded.left_hazard_family,
  right_trade_code = excluded.right_trade_code,
  right_task_code = excluded.right_task_code,
  right_hazard_family = excluded.right_hazard_family,
  requires_same_area = excluded.requires_same_area,
  requires_time_overlap = excluded.requires_time_overlap,
  weather_condition = excluded.weather_condition,
  severity = excluded.severity,
  rationale = excluded.rationale,
  recommended_controls = excluded.recommended_controls,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();
