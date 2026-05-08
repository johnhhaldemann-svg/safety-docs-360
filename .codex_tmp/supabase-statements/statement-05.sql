create index if not exists company_corrective_actions_prediction_review_idx
  on public.company_corrective_actions(company_id, prediction_validation_status, created_at desc);