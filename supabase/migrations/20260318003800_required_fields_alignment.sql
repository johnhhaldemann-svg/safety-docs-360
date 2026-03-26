-- Ensure required fields are present exactly as requested.
-- Additive/idempotent migration aligned to requested field list.

-- companies
alter table public.companies
  alter column status set default 'pending';

update public.companies
set status = case
  when status = 'active' then 'approved'
  when status = 'inactive' then 'pending'
  when status is null or trim(status) = '' then 'pending'
  when status not in ('pending', 'approved', 'suspended') then 'pending'
  else status
end
where status is null
   or trim(status) = ''
   or status in ('active', 'inactive')
   or status not in ('pending', 'approved', 'suspended');

alter table public.companies
  drop constraint if exists companies_status_check;

alter table public.companies
  add constraint companies_status_check
  check (status in ('pending', 'approved', 'suspended'));

-- jobsites
alter table public.jobsites
  add column if not exists address text null;

-- daps
alter table public.daps
  add column if not exists work_date date null,
  add column if not exists created_by uuid null references auth.users(id) on delete set null,
  add column if not exists supervisor_name text null,
  add column if not exists weather_summary text null,
  add column if not exists overall_risk_level text null,
  add column if not exists signed_by uuid null references auth.users(id) on delete set null,
  add column if not exists signed_at timestamptz null;

-- dap_activities
alter table public.dap_activities
  add column if not exists trade text null,
  add column if not exists activity_name text null,
  add column if not exists area text null,
  add column if not exists crew_size integer null,
  add column if not exists hazard_category text null,
  add column if not exists hazard_description text null,
  add column if not exists mitigation text null,
  add column if not exists permit_required boolean null,
  add column if not exists permit_type text null,
  add column if not exists planned_risk_level text null;

-- observations
alter table public.observations
  add column if not exists dap_activity_id uuid null references public.dap_activities(id) on delete set null,
  add column if not exists observed_at timestamptz null,
  add column if not exists observer_id uuid null references auth.users(id) on delete set null,
  add column if not exists trade text null,
  add column if not exists area text null,
  add column if not exists activity_name text null,
  add column if not exists hazard_category text null,
  add column if not exists observation_type text null,
  add column if not exists risk_level text null,
  add column if not exists sif_potential boolean not null default false,
  add column if not exists sif_category text null,
  add column if not exists responsible_party text null,
  add column if not exists corrective_action text null,
  add column if not exists identified_at timestamptz null,
  add column if not exists corrected_at timestamptz null,
  add column if not exists verified_at timestamptz null;

update public.observations
set status = case
  when status = 'closed' then 'verified_closed'
  else status
end
where status = 'closed';

alter table public.observations
  drop constraint if exists observations_status_check;

alter table public.observations
  add constraint observations_status_check
  check (
    status in (
      'open',
      'assigned',
      'in_progress',
      'corrected',
      'verified_closed',
      'escalated',
      'stop_work'
    )
  );

alter table public.observations
  drop constraint if exists observations_observation_type_check;

alter table public.observations
  add constraint observations_observation_type_check
  check (
    observation_type is null
    or observation_type in ('positive', 'negative', 'near_miss')
  );

alter table public.observations
  drop constraint if exists observations_risk_level_check;

alter table public.observations
  add constraint observations_risk_level_check
  check (
    risk_level is null
    or risk_level in ('low', 'medium', 'high')
  );

-- observation_photos
alter table public.observation_photos
  add column if not exists file_type text null,
  add column if not exists uploaded_by uuid null references auth.users(id) on delete set null;

-- permits
alter table public.permits
  add column if not exists dap_activity_id uuid null references public.dap_activities(id) on delete set null,
  add column if not exists permit_type text null,
  add column if not exists issued_to text null,
  add column if not exists issued_by uuid null references auth.users(id) on delete set null,
  add column if not exists issued_at timestamptz null,
  add column if not exists expires_at timestamptz null;

-- incidents
alter table public.incidents
  add column if not exists observation_id uuid null references public.observations(id) on delete set null,
  add column if not exists incident_type text null,
  add column if not exists root_cause text null,
  add column if not exists reported_by uuid null references auth.users(id) on delete set null,
  add column if not exists reported_at timestamptz null;
