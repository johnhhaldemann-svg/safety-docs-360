update public.company_corrective_actions
set status = 'verified_closed'
where status = 'closed';

alter table public.company_corrective_actions
drop constraint if exists company_corrective_actions_status_check;

alter table public.company_corrective_actions
add constraint company_corrective_actions_status_check
check (
  status in (
    'open',
    'assigned',
    'in_progress',
    'corrected',
    'verified_closed',
    'escalated',
    'stop_work'
  )
);

update public.corrective_actions
set status = 'verified_closed'
where status = 'closed';

alter table public.corrective_actions
drop constraint if exists corrective_actions_status_check;

alter table public.corrective_actions
add constraint corrective_actions_status_check
check (
  status in (
    'open',
    'assigned',
    'in_progress',
    'corrected',
    'verified_closed',
    'escalated',
    'stop_work'
  )
);
