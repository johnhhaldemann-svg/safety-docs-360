create index if not exists injury_forecast_audit_log_jobsite_generated_idx
  on public.injury_forecast_audit_log(jobsite_id, generated_at desc)
  where jobsite_id is not null;