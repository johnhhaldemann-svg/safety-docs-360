update public.company_corrective_actions
set
  prediction_validation_status = 'approved',
  prediction_review_rating = coalesce(prediction_review_rating, 3),
  prediction_review_notes = coalesce(prediction_review_notes, 'Historical backfill approved for forecast continuity.'),
  prediction_review_tags = case
    when coalesce(array_length(prediction_review_tags, 1), 0) = 0 then array['historical_backfill']
    else prediction_review_tags
  end,
  prediction_reviewed_at = coalesce(prediction_reviewed_at, created_at)
where prediction_validation_status is null;