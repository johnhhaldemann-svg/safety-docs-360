-- Compatibility bridge between existing company_* tables and normalized schema.
-- This migration is additive and idempotent.

-- 1) Backfill normalized core records from existing tables.
insert into public.company_users (
  company_id,
  user_id,
  role,
  status,
  display_name,
  created_at,
  updated_at,
  created_by,
  updated_by
)
select
  ur.company_id,
  ur.user_id,
  ur.role,
  case
    when ur.account_status = 'pending' then 'pending'
    when ur.account_status = 'suspended' then 'suspended'
    else 'active'
  end as status,
  null::text as display_name,
  now() as created_at,
  now() as updated_at,
  ur.created_by,
  ur.updated_by
from public.user_roles ur
where ur.company_id is not null
on conflict (company_id, user_id) do update
set
  role = excluded.role,
  status = excluded.status,
  updated_at = now(),
  updated_by = excluded.updated_by;

insert into public.jobsites (
  id,
  company_id,
  name,
  project_number,
  location,
  status,
  start_date,
  end_date,
  notes,
  created_at,
  updated_at,
  created_by,
  updated_by
)
select
  cj.id,
  cj.company_id,
  cj.name,
  cj.project_number,
  cj.location,
  cj.status,
  cj.start_date,
  cj.end_date,
  cj.notes,
  cj.created_at,
  cj.updated_at,
  cj.created_by,
  cj.updated_by
from public.company_jobsites cj
on conflict (id) do update
set
  company_id = excluded.company_id,
  name = excluded.name,
  project_number = excluded.project_number,
  location = excluded.location,
  status = excluded.status,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  notes = excluded.notes,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

insert into public.jobsite_users (
  company_id,
  jobsite_id,
  company_user_id,
  role,
  created_at,
  updated_at,
  created_by,
  updated_by
)
select
  cja.company_id,
  cja.jobsite_id,
  cu.id as company_user_id,
  cja.role,
  cja.created_at,
  cja.updated_at,
  cja.created_by,
  cja.updated_by
from public.company_jobsite_assignments cja
join public.company_users cu
  on cu.company_id = cja.company_id
 and cu.user_id = cja.user_id
on conflict (jobsite_id, company_user_id) do update
set
  role = excluded.role,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

-- 2) Backfill module tables into normalized entities.
insert into public.daps (
  id,
  company_id,
  jobsite_id,
  created_by_company_user_id,
  owner_company_user_id,
  title,
  description,
  status,
  severity,
  due_at,
  started_at,
  closed_at,
  created_at,
  updated_at
)
select
  cd.id,
  cd.company_id,
  cd.jobsite_id,
  cu_created.id as created_by_company_user_id,
  cu_owner.id as owner_company_user_id,
  cd.title,
  cd.description,
  cd.status,
  cd.severity,
  cd.due_at,
  null::timestamptz as started_at,
  null::timestamptz as closed_at,
  cd.created_at,
  cd.updated_at
from public.company_daps cd
left join public.company_users cu_created
  on cu_created.company_id = cd.company_id
 and cu_created.user_id = cd.created_by
left join public.company_users cu_owner
  on cu_owner.company_id = cd.company_id
 and cu_owner.user_id = cd.owner_user_id
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  severity = excluded.severity,
  due_at = excluded.due_at,
  updated_at = excluded.updated_at;

insert into public.observations (
  id,
  company_id,
  jobsite_id,
  observer_company_user_id,
  title,
  description,
  severity,
  category,
  status,
  occurred_at,
  created_at,
  updated_at
)
select
  cca.id,
  cca.company_id,
  cca.jobsite_id,
  cu_created.id as observer_company_user_id,
  cca.title,
  cca.description,
  cca.severity,
  cca.category,
  cca.status,
  null::timestamptz as occurred_at,
  cca.created_at,
  cca.updated_at
from public.company_corrective_actions cca
left join public.company_users cu_created
  on cu_created.company_id = cca.company_id
 and cu_created.user_id = cca.created_by
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  severity = excluded.severity,
  category = excluded.category,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public.observation_photos (
  id,
  observation_id,
  company_id,
  storage_bucket,
  file_path,
  file_name,
  content_type,
  uploaded_by_company_user_id,
  created_at
)
select
  cae.id,
  cae.action_id as observation_id,
  cae.company_id,
  'safety-assets' as storage_bucket,
  cae.file_path,
  cae.file_name,
  null::text as content_type,
  cu_uploaded.id as uploaded_by_company_user_id,
  cae.created_at
from public.company_corrective_action_evidence cae
left join public.company_users cu_uploaded
  on cu_uploaded.company_id = cae.company_id
 and cu_uploaded.user_id = cae.created_by
on conflict (id) do update
set
  file_path = excluded.file_path,
  file_name = excluded.file_name,
  content_type = excluded.content_type;

insert into public.corrective_actions (
  id,
  company_id,
  jobsite_id,
  observation_id,
  title,
  description,
  category,
  severity,
  status,
  assigned_company_user_id,
  due_at,
  closed_at,
  verified_by_company_user_id,
  created_at,
  updated_at
)
select
  cca.id,
  cca.company_id,
  cca.jobsite_id,
  cca.id as observation_id,
  cca.title,
  cca.description,
  cca.category,
  cca.severity,
  cca.status,
  cu_assigned.id as assigned_company_user_id,
  cca.due_at,
  cca.closed_at,
  cu_verified.id as verified_by_company_user_id,
  cca.created_at,
  cca.updated_at
from public.company_corrective_actions cca
left join public.company_users cu_assigned
  on cu_assigned.company_id = cca.company_id
 and cu_assigned.user_id = cca.assigned_user_id
left join public.company_users cu_verified
  on cu_verified.company_id = cca.company_id
 and cu_verified.user_id = cca.updated_by
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  severity = excluded.severity,
  status = excluded.status,
  due_at = excluded.due_at,
  closed_at = excluded.closed_at,
  updated_at = excluded.updated_at;

insert into public.permits (
  id,
  company_id,
  jobsite_id,
  title,
  status,
  severity,
  requested_by_company_user_id,
  approved_by_company_user_id,
  created_at,
  updated_at
)
select
  cp.id,
  cp.company_id,
  cp.jobsite_id,
  cp.title,
  cp.status,
  cp.severity,
  cu_created.id as requested_by_company_user_id,
  null::uuid as approved_by_company_user_id,
  cp.created_at,
  cp.updated_at
from public.company_permits cp
left join public.company_users cu_created
  on cu_created.company_id = cp.company_id
 and cu_created.user_id = cp.created_by
on conflict (id) do update
set
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  updated_at = excluded.updated_at;

insert into public.incidents (
  id,
  company_id,
  jobsite_id,
  title,
  description,
  category,
  severity,
  status,
  occurred_at,
  reported_by_company_user_id,
  created_at,
  updated_at
)
select
  ci.id,
  ci.company_id,
  ci.jobsite_id,
  ci.title,
  ci.description,
  ci.category,
  ci.severity,
  ci.status,
  ci.occurred_at,
  cu_created.id as reported_by_company_user_id,
  ci.created_at,
  ci.updated_at
from public.company_incidents ci
left join public.company_users cu_created
  on cu_created.company_id = ci.company_id
 and cu_created.user_id = ci.created_by
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  severity = excluded.severity,
  status = excluded.status,
  occurred_at = excluded.occurred_at,
  updated_at = excluded.updated_at;

insert into public.daily_reports (
  id,
  company_id,
  jobsite_id,
  report_date,
  title,
  summary,
  status,
  created_by_company_user_id,
  published_at,
  created_at,
  updated_at
)
select
  cr.id,
  cr.company_id,
  cr.jobsite_id,
  coalesce((cr.generated_at at time zone 'utc')::date, (cr.created_at at time zone 'utc')::date) as report_date,
  cr.title,
  null::text as summary,
  case
    when cr.status = 'published' then 'published'
    when cr.status = 'archived' then 'archived'
    else 'draft'
  end as status,
  cu_created.id as created_by_company_user_id,
  cr.generated_at as published_at,
  cr.created_at,
  cr.updated_at
from public.company_reports cr
left join public.company_users cu_created
  on cu_created.company_id = cr.company_id
 and cu_created.user_id = cr.created_by
on conflict (id) do update
set
  title = excluded.title,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at;

insert into public.report_snapshots (
  id,
  daily_report_id,
  company_id,
  jobsite_id,
  snapshot_date,
  metrics,
  created_at,
  created_by_company_user_id
)
select
  cas.id,
  null::uuid as daily_report_id,
  cas.company_id,
  cas.jobsite_id,
  cas.snapshot_date,
  cas.metrics,
  cas.created_at,
  cu_created.id as created_by_company_user_id
from public.company_analytics_snapshots cas
left join public.company_users cu_created
  on cu_created.company_id = cas.company_id
 and cu_created.user_id = cas.created_by
on conflict (id) do update
set
  metrics = excluded.metrics,
  created_at = excluded.created_at;

do $$
begin
  if to_regclass('public.company_documents') is not null then
    insert into public.documents (
      id,
      company_id,
      jobsite_id,
      title,
      document_type,
      status,
      current_version,
      owner_company_user_id,
      created_at,
      updated_at
    )
    select
      cd.id,
      cd.company_id,
      cd.jobsite_id,
      coalesce(cd.title, cd.document_type, 'Document') as title,
      coalesce(cd.document_type, 'document') as document_type,
      case
        when cd.status = 'archived' then 'archived'
        when cd.status = 'active' then 'active'
        else 'draft'
      end as status,
      greatest(1, coalesce(cd.version, 1)) as current_version,
      cu_owner.id as owner_company_user_id,
      cd.created_at,
      coalesce(cd.updated_at, cd.created_at) as updated_at
    from public.company_documents cd
    left join public.company_users cu_owner
      on cu_owner.company_id = cd.company_id
     and cu_owner.user_id = cd.created_by
    on conflict (id) do update
    set
      title = excluded.title,
      document_type = excluded.document_type,
      status = excluded.status,
      current_version = excluded.current_version,
      updated_at = excluded.updated_at;

    insert into public.document_versions (
      id,
      document_id,
      company_id,
      version_number,
      storage_bucket,
      file_path,
      checksum,
      change_notes,
      created_at,
      created_by_company_user_id
    )
    select
      cd.id,
      cd.id as document_id,
      cd.company_id,
      greatest(1, coalesce(cd.version, 1)) as version_number,
      'documents' as storage_bucket,
      coalesce(cd.file_path, '') as file_path,
      null::text as checksum,
      null::text as change_notes,
      cd.created_at,
      cu_owner.id as created_by_company_user_id
    from public.company_documents cd
    left join public.company_users cu_owner
      on cu_owner.company_id = cd.company_id
     and cu_owner.user_id = cd.created_by
    where coalesce(cd.file_path, '') <> ''
    on conflict (id) do update
    set
      version_number = excluded.version_number,
      file_path = excluded.file_path;
  end if;
end $$;

-- 3) Compatibility views for transition (read-only projections).
create or replace view public.compat_company_users as
select
  cu.id,
  cu.company_id,
  cu.user_id,
  cu.role,
  cu.status as account_status,
  cu.display_name,
  cu.title,
  cu.created_at,
  cu.updated_at
from public.company_users cu;

create or replace view public.compat_company_jobsites as
select
  j.id,
  j.company_id,
  j.name,
  j.project_number,
  j.location,
  j.status,
  j.start_date,
  j.end_date,
  j.notes,
  j.created_at,
  j.updated_at
from public.jobsites j;

create or replace view public.compat_company_daps as
select
  d.id,
  d.company_id,
  null::uuid as jobsite_id,
  d.title,
  d.description,
  d.status,
  d.severity,
  d.due_at,
  d.created_at,
  d.updated_at
from public.daps d;

create or replace view public.compat_company_observations as
select
  o.id,
  o.company_id,
  o.jobsite_id,
  o.title,
  o.description,
  o.severity,
  o.category,
  o.status,
  o.created_at,
  o.updated_at
from public.observations o;

create or replace view public.compat_company_corrective_actions as
select
  ca.id,
  ca.company_id,
  ca.jobsite_id,
  ca.observation_id,
  ca.title,
  ca.description,
  ca.category,
  ca.severity,
  ca.status,
  ca.due_at,
  ca.closed_at,
  ca.created_at,
  ca.updated_at
from public.corrective_actions ca;

create or replace view public.compat_company_permits as
select
  p.id,
  p.company_id,
  p.jobsite_id,
  p.permit_type_id,
  p.title,
  p.status,
  p.severity,
  p.valid_from,
  p.valid_to,
  p.created_at,
  p.updated_at
from public.permits p;

create or replace view public.compat_company_incidents as
select
  i.id,
  i.company_id,
  i.jobsite_id,
  i.title,
  i.description,
  i.category,
  i.severity,
  i.status,
  i.occurred_at,
  i.created_at,
  i.updated_at
from public.incidents i;

create or replace view public.compat_company_reports as
select
  dr.id,
  dr.company_id,
  dr.jobsite_id,
  dr.title,
  dr.status,
  dr.report_date,
  dr.published_at,
  dr.created_at,
  dr.updated_at
from public.daily_reports dr;

create or replace view public.compat_company_documents as
select
  d.id,
  null::uuid as company_id,
  null::uuid as jobsite_id,
  null::text as title,
  null::text as document_type,
  null::text as status,
  null::integer as current_version,
  d.created_at,
  d.updated_at
from public.documents d;
