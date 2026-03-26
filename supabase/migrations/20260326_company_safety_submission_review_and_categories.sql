alter table public.company_safety_submissions
add column if not exists category text not null default 'hazard',
add column if not exists review_status text not null default 'pending',
add column if not exists reviewed_by uuid null references auth.users(id) on delete set null,
add column if not exists reviewed_at timestamptz null,
add column if not exists linked_action_id uuid null references public.company_corrective_actions(id) on delete set null;

alter table public.company_safety_submissions
drop constraint if exists company_safety_submissions_category_check;
alter table public.company_safety_submissions
add constraint company_safety_submissions_category_check check (
  category in (
    'hazard',
    'near_miss',
    'incident',
    'good_catch',
    'ppe_violation',
    'housekeeping',
    'equipment_issue',
    'fall_hazard',
    'electrical_hazard',
    'excavation_trench_concern',
    'fire_hot_work_concern',
    'corrective_action'
  )
);

alter table public.company_safety_submissions
drop constraint if exists company_safety_submissions_review_status_check;
alter table public.company_safety_submissions
add constraint company_safety_submissions_review_status_check check (
  review_status in ('pending', 'approved', 'rejected')
);

create index if not exists company_safety_submissions_review_status_idx
  on public.company_safety_submissions(company_id, review_status, created_at desc);

alter table public.company_corrective_actions
add column if not exists category text not null default 'corrective_action';

alter table public.company_corrective_actions
drop constraint if exists company_corrective_actions_category_check;
alter table public.company_corrective_actions
add constraint company_corrective_actions_category_check check (
  category in (
    'hazard',
    'near_miss',
    'incident',
    'good_catch',
    'ppe_violation',
    'housekeeping',
    'equipment_issue',
    'fall_hazard',
    'electrical_hazard',
    'excavation_trench_concern',
    'fire_hot_work_concern',
    'corrective_action'
  )
);

create index if not exists company_corrective_actions_category_idx
  on public.company_corrective_actions(company_id, category, status, updated_at desc);
