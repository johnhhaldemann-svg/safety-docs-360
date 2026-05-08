alter table public.company_corrective_actions
  drop constraint if exists company_corrective_actions_prediction_validation_status_check,
  drop constraint if exists company_corrective_actions_prediction_review_rating_check,
  drop constraint if exists company_corrective_actions_prediction_approved_rating_check,
  add constraint company_corrective_actions_prediction_validation_status_check
    check (prediction_validation_status in ('pending', 'approved', 'rejected')),
  add constraint company_corrective_actions_prediction_review_rating_check
    check (prediction_review_rating is null or prediction_review_rating between 1 and 5),
  add constraint company_corrective_actions_prediction_approved_rating_check
    check (prediction_validation_status <> 'approved' or prediction_review_rating is not null);