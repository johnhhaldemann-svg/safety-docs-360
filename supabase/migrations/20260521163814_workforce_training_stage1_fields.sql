-- Stage 1 workforce and training matrix metadata.
--
-- Extends existing company-scoped tables only. RLS policies already protect these
-- tables through company membership/manager checks.

alter table public.company_employee_profiles
  add column if not exists worker_type text not null default 'External Worker',
  add column if not exists company_name text null,
  add column if not exists department_name text null,
  add column if not exists manager_id uuid null references auth.users(id) on delete set null,
  add column if not exists supervisor_id uuid null references auth.users(id) on delete set null,
  add column if not exists responsible_sponsor_id uuid null references auth.users(id) on delete set null,
  add column if not exists access_status text not null default 'restricted',
  add column if not exists access_start_date date null,
  add column if not exists access_end_date date null,
  add column if not exists restrictions text[] not null default '{}'::text[],
  add constraint company_employee_profiles_worker_type_check check (
    worker_type in (
      'Employee',
      'Contractor',
      'Agency Worker',
      'Supplier',
      'Visitor',
      'Temporary Worker',
      'External Worker'
    )
  ) not valid,
  add constraint company_employee_profiles_access_status_check check (
    access_status in ('active', 'pending_review', 'restricted', 'blocked', 'inactive')
  ) not valid;

alter table public.company_employee_profiles
  validate constraint company_employee_profiles_worker_type_check,
  validate constraint company_employee_profiles_access_status_check;

comment on column public.company_employee_profiles.worker_type is
  'Stage 1 workforce directory display type for no-portal tracked workers.';
comment on column public.company_employee_profiles.access_status is
  'Stage 1 no-login site access status: active, pending_review, restricted, blocked, inactive.';

alter table public.company_training_requirements
  add column if not exists category text null,
  add column if not exists description text null,
  add column if not exists renewal_period_days integer null,
  add column if not exists owner_id uuid null references auth.users(id) on delete set null,
  add column if not exists active boolean not null default true,
  add column if not exists version text not null default 'Current',
  add column if not exists requires_evidence boolean not null default true,
  add column if not exists required_because text[] not null default '{}'::text[],
  add constraint company_training_requirements_renewal_period_days_check check (
    renewal_period_days is null or renewal_period_days > 0
  ) not valid;

alter table public.company_training_requirements
  validate constraint company_training_requirements_renewal_period_days_check;

comment on column public.company_training_requirements.required_because is
  'Optional explicit Stage 1 reasons; app still derives reasons from role, trade, site/task, and permit context when empty.';
