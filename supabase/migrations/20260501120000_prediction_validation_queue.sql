alter table public.company_sor_records
  add column if not exists prediction_validation_status text null,
  add column if not exists prediction_review_rating integer null,
  add column if not exists prediction_review_notes text null,
  add column if not exists prediction_review_tags text[] not null default '{}'::text[],
  add column if not exists prediction_reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists prediction_reviewed_at timestamptz null;

alter table public.company_incidents
  add column if not exists prediction_validation_status text null,
  add column if not exists prediction_review_rating integer null,
  add column if not exists prediction_review_notes text null,
  add column if not exists prediction_review_tags text[] not null default '{}'::text[],
  add column if not exists prediction_reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists prediction_reviewed_at timestamptz null;

create or replace function public.sor_guard_locked_rows()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('submitted', 'locked', 'superseded') then
    if old.status = new.status
       and new.version_number = old.version_number
       and new.previous_version_id is not distinct from old.previous_version_id
       and new.record_hash is not distinct from old.record_hash
       and new.previous_hash is not distinct from old.previous_hash
       and new.change_reason is not distinct from old.change_reason
       and new.date is not distinct from old.date
       and new.project is not distinct from old.project
       and new.location is not distinct from old.location
       and new.trade is not distinct from old.trade
       and new.category is not distinct from old.category
       and new.hazard_category_code is not distinct from old.hazard_category_code
       and new.subcategory is not distinct from old.subcategory
       and new.description is not distinct from old.description
       and new.severity is not distinct from old.severity
       and new.created_by is not distinct from old.created_by
       and new.created_at is not distinct from old.created_at
       and new.is_deleted = old.is_deleted
    then
      return new;
    end if;

    if old.status = 'submitted'
       and new.status = 'superseded'
       and new.version_number = old.version_number
       and new.previous_version_id is not distinct from old.previous_version_id
       and new.record_hash is not distinct from old.record_hash
       and new.previous_hash is not distinct from old.previous_hash
       and new.change_reason is not distinct from old.change_reason
       and new.date is not distinct from old.date
       and new.project is not distinct from old.project
       and new.location is not distinct from old.location
       and new.trade is not distinct from old.trade
       and new.category is not distinct from old.category
       and new.hazard_category_code is not distinct from old.hazard_category_code
       and new.subcategory is not distinct from old.subcategory
       and new.description is not distinct from old.description
       and new.severity is not distinct from old.severity
       and new.created_by is not distinct from old.created_by
       and new.created_at is not distinct from old.created_at
       and new.is_deleted = old.is_deleted
    then
      return new;
    end if;

    raise exception 'Submitted/locked/superseded SOR rows are immutable except prediction-review metadata.';
  end if;

  return new;
end;
$$;

update public.company_sor_records
set
  prediction_validation_status = 'approved',
  prediction_review_rating = coalesce(prediction_review_rating, 3),
  prediction_review_notes = coalesce(prediction_review_notes, 'Historical backfill approved for prediction continuity.'),
  prediction_review_tags = case
    when coalesce(array_length(prediction_review_tags, 1), 0) = 0 then array['historical_backfill']
    else prediction_review_tags
  end,
  prediction_reviewed_at = coalesce(prediction_reviewed_at, created_at)
where prediction_validation_status is null;

update public.company_incidents
set
  prediction_validation_status = 'approved',
  prediction_review_rating = coalesce(prediction_review_rating, 3),
  prediction_review_notes = coalesce(prediction_review_notes, 'Historical backfill approved for prediction continuity.'),
  prediction_review_tags = case
    when coalesce(array_length(prediction_review_tags, 1), 0) = 0 then array['historical_backfill']
    else prediction_review_tags
  end,
  prediction_reviewed_at = coalesce(prediction_reviewed_at, created_at)
where prediction_validation_status is null;

alter table public.company_sor_records
  alter column prediction_validation_status set default 'pending',
  alter column prediction_validation_status set not null;

alter table public.company_incidents
  alter column prediction_validation_status set default 'pending',
  alter column prediction_validation_status set not null;

alter table public.company_sor_records
  drop constraint if exists company_sor_records_prediction_validation_status_check,
  drop constraint if exists company_sor_records_prediction_review_rating_check,
  drop constraint if exists company_sor_records_prediction_approved_rating_check,
  add constraint company_sor_records_prediction_validation_status_check
    check (prediction_validation_status in ('pending', 'approved', 'rejected')),
  add constraint company_sor_records_prediction_review_rating_check
    check (prediction_review_rating is null or prediction_review_rating between 1 and 5),
  add constraint company_sor_records_prediction_approved_rating_check
    check (prediction_validation_status <> 'approved' or prediction_review_rating is not null);

alter table public.company_incidents
  drop constraint if exists company_incidents_prediction_validation_status_check,
  drop constraint if exists company_incidents_prediction_review_rating_check,
  drop constraint if exists company_incidents_prediction_approved_rating_check,
  add constraint company_incidents_prediction_validation_status_check
    check (prediction_validation_status in ('pending', 'approved', 'rejected')),
  add constraint company_incidents_prediction_review_rating_check
    check (prediction_review_rating is null or prediction_review_rating between 1 and 5),
  add constraint company_incidents_prediction_approved_rating_check
    check (prediction_validation_status <> 'approved' or prediction_review_rating is not null);

create index if not exists company_sor_records_prediction_review_idx
  on public.company_sor_records(company_id, prediction_validation_status, created_at desc);

create index if not exists company_incidents_prediction_review_idx
  on public.company_incidents(company_id, prediction_validation_status, created_at desc);

create index if not exists company_incidents_prediction_injury_review_idx
  on public.company_incidents(company_id, prediction_validation_status, injury_type, body_part, created_at desc)
  where injury_type is not null or body_part is not null;

create or replace function public.sor_guard_locked_rows()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('submitted', 'locked', 'superseded') then
    if old.status = new.status
       and new.version_number = old.version_number
       and new.previous_version_id is not distinct from old.previous_version_id
       and new.record_hash is not distinct from old.record_hash
       and new.previous_hash is not distinct from old.previous_hash
       and new.change_reason is not distinct from old.change_reason
       and new.date is not distinct from old.date
       and new.project is not distinct from old.project
       and new.location is not distinct from old.location
       and new.trade is not distinct from old.trade
       and new.category is not distinct from old.category
       and new.hazard_category_code is not distinct from old.hazard_category_code
       and new.subcategory is not distinct from old.subcategory
       and new.description is not distinct from old.description
       and new.severity is not distinct from old.severity
       and new.created_by is not distinct from old.created_by
       and new.created_at is not distinct from old.created_at
       and new.is_deleted = old.is_deleted
    then
      return new;
    end if;

    if old.status = 'submitted'
       and new.status = 'superseded'
       and new.version_number = old.version_number
       and new.previous_version_id is not distinct from old.previous_version_id
       and new.record_hash is not distinct from old.record_hash
       and new.previous_hash is not distinct from old.previous_hash
       and new.change_reason is not distinct from old.change_reason
       and new.date is not distinct from old.date
       and new.project is not distinct from old.project
       and new.location is not distinct from old.location
       and new.trade is not distinct from old.trade
       and new.category is not distinct from old.category
       and new.hazard_category_code is not distinct from old.hazard_category_code
       and new.subcategory is not distinct from old.subcategory
       and new.description is not distinct from old.description
       and new.severity is not distinct from old.severity
       and new.created_by is not distinct from old.created_by
       and new.created_at is not distinct from old.created_at
       and new.is_deleted = old.is_deleted
    then
      return new;
    end if;

    raise exception 'Submitted/locked/superseded SOR rows are immutable except prediction-review metadata.';
  end if;

  return new;
end;
$$;
