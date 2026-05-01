alter table public.company_corrective_actions
  add column if not exists prediction_validation_status text null,
  add column if not exists prediction_review_rating integer null,
  add column if not exists prediction_review_notes text null,
  add column if not exists prediction_review_tags text[] not null default '{}'::text[],
  add column if not exists prediction_reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists prediction_reviewed_at timestamptz null;

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

alter table public.company_corrective_actions
  alter column prediction_validation_status set default 'pending',
  alter column prediction_validation_status set not null;

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

create index if not exists company_corrective_actions_prediction_review_idx
  on public.company_corrective_actions(company_id, prediction_validation_status, created_at desc);

create table if not exists public.injury_forecast_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete set null,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  generated_at timestamptz not null default now(),
  forecast_month text not null,
  model_version text not null,
  risk_level text not null,
  confidence_score numeric not null,
  included_record_count integer not null default 0,
  excluded_record_count integer not null default 0,
  source_mix jsonb not null default '{}'::jsonb,
  trust_mix jsonb not null default '{}'::jsonb,
  exclusion_reasons jsonb not null default '{}'::jsonb,
  forecast_integrity jsonb not null default '{}'::jsonb,
  recommended_controls jsonb not null default '[]'::jsonb,
  reviewed_by uuid null references auth.users(id) on delete set null,
  final_human_decision text null,
  post_review_changes jsonb not null default '{}'::jsonb
);

create index if not exists injury_forecast_audit_log_company_generated_idx
  on public.injury_forecast_audit_log(company_id, generated_at desc);

create index if not exists injury_forecast_audit_log_jobsite_generated_idx
  on public.injury_forecast_audit_log(jobsite_id, generated_at desc)
  where jobsite_id is not null;

alter table public.injury_forecast_audit_log enable row level security;

grant select, insert, update on public.injury_forecast_audit_log to authenticated;

drop policy if exists "injury_forecast_audit_log_select_scope" on public.injury_forecast_audit_log;
create policy "injury_forecast_audit_log_select_scope"
on public.injury_forecast_audit_log
for select
to authenticated
using (
  public.is_admin_role()
  or (
    company_id is not null
    and exists (
      select 1
      from public.company_memberships actor
      where actor.user_id = auth.uid()
        and actor.company_id = injury_forecast_audit_log.company_id
    )
  )
  or (
    company_id is not null
    and exists (
      select 1
      from public.user_roles actor
      where actor.user_id = auth.uid()
        and actor.company_id = injury_forecast_audit_log.company_id
        and actor.account_status = 'active'
    )
  )
);

drop policy if exists "injury_forecast_audit_log_insert_admin_scope" on public.injury_forecast_audit_log;
create policy "injury_forecast_audit_log_insert_admin_scope"
on public.injury_forecast_audit_log
for insert
to authenticated
with check (
  public.is_admin_role()
  or (
    company_id is not null
    and exists (
      select 1
      from public.user_roles actor
      where actor.user_id = auth.uid()
        and actor.company_id = injury_forecast_audit_log.company_id
        and actor.role in ('company_admin', 'manager', 'admin', 'super_admin', 'platform_admin')
        and actor.account_status = 'active'
    )
  )
);
