alter table public.company_dap_activities
drop constraint if exists company_dap_activities_status_check;

alter table public.company_dap_activities
add constraint company_dap_activities_status_check
check (
  status in (
    'planned',
    'monitored',
    'not_started',
    'active',
    'paused',
    'completed',
    'cancelled'
  )
);
