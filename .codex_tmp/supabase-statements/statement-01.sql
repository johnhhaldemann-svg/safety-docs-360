alter table public.company_corrective_actions
  add column if not exists prediction_validation_status text null,
  add column if not exists prediction_review_rating integer null,
  add column if not exists prediction_review_notes text null,
  add column if not exists prediction_review_tags text[] not null default '{}'::text[],
  add column if not exists prediction_reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists prediction_reviewed_at timestamptz null;