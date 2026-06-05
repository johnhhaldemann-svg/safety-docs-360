alter table public.company_corrective_actions
  add column if not exists observation_type text not null default 'negative',
  add column if not exists sif_potential boolean null,
  add column if not exists sif_category text null,
  add column if not exists priority text not null default 'medium',
  add column if not exists immediate_action_required boolean not null default false,
  add column if not exists closure_note text null,
  add column if not exists validation_reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists validation_reviewed_at timestamptz null,
  add column if not exists time_to_close_hours numeric null;

update public.company_corrective_actions
set sif_potential = false
where observation_type = 'negative'
  and sif_potential is null;

update public.company_corrective_actions
set priority = 'high'
where coalesce(sif_potential, false) = true;

alter table public.company_corrective_actions
drop constraint if exists company_corrective_actions_observation_type_check;

alter table public.company_corrective_actions
add constraint company_corrective_actions_observation_type_check
check (observation_type in ('positive', 'negative', 'near_miss'));

alter table public.company_corrective_actions
drop constraint if exists company_corrective_actions_sif_category_check;

alter table public.company_corrective_actions
add constraint company_corrective_actions_sif_category_check
check (
  sif_category is null
  or sif_category in (
    'fall_from_height',
    'struck_by',
    'caught_between',
    'electrical',
    'excavation_collapse',
    'confined_space',
    'hazardous_energy',
    'crane_rigging',
    'line_of_fire'
  )
);

alter table public.company_corrective_actions
drop constraint if exists company_corrective_actions_priority_check;

alter table public.company_corrective_actions
add constraint company_corrective_actions_priority_check
check (priority in ('low', 'medium', 'high', 'critical'));

alter table public.company_corrective_actions
drop constraint if exists company_corrective_actions_negative_requires_sif_eval_check;

alter table public.company_corrective_actions
add constraint company_corrective_actions_negative_requires_sif_eval_check
check (
  observation_type <> 'negative'
  or sif_potential is not null
);
