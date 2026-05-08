alter table public.company_corrective_actions
  alter column prediction_validation_status set default 'pending',
  alter column prediction_validation_status set not null;