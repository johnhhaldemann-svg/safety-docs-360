create index if not exists injury_forecast_audit_log_company_generated_idx
  on public.injury_forecast_audit_log(company_id, generated_at desc);