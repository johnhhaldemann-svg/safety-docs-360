begin;

-- Security-definer views bypass the caller's RLS context unless explicitly marked
-- invoker. Recreate the compatibility projections with the same columns and
-- security_invoker so legacy consumers still see RLS-filtered rows.
create or replace view public.compat_company_users
with (security_invoker = true) as
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

create or replace view public.compat_company_jobsites
with (security_invoker = true) as
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

create or replace view public.compat_company_daps
with (security_invoker = true) as
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

create or replace view public.compat_company_observations
with (security_invoker = true) as
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

create or replace view public.compat_company_corrective_actions
with (security_invoker = true) as
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

create or replace view public.compat_company_permits
with (security_invoker = true) as
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

create or replace view public.compat_company_incidents
with (security_invoker = true) as
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

create or replace view public.compat_company_reports
with (security_invoker = true) as
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

create or replace view public.compat_company_documents
with (security_invoker = true) as
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

-- These security-definer RPCs are server-route implementation details. Keep
-- execution available to the service role and remove broad direct API access.
revoke execute on function public.lookup_company_invite(text) from public, anon, authenticated;
grant execute on function public.lookup_company_invite(text) to service_role;

revoke execute on function public.consume_company_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_company_invite(text, uuid) to service_role;

revoke execute on function public.claim_approved_company_owner(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_approved_company_owner(text, uuid) to service_role;

revoke execute on function public.lookup_my_company_signup_request() from public, anon, authenticated;
grant execute on function public.lookup_my_company_signup_request() to service_role;

revoke execute on function public.upsert_company_invite(text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.upsert_company_invite(text, text, text, uuid, text) to service_role;

revoke execute on function public.admin_list_workspace_users() from public, anon, authenticated;
grant execute on function public.admin_list_workspace_users() to service_role;

revoke execute on function public.admin_list_company_users(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_company_users(uuid) to service_role;

revoke execute on function public.billing_generate_invoice_number() from public, anon, authenticated;
grant execute on function public.billing_generate_invoice_number() to service_role;

-- Signup requests are accepted through Next.js server routes so the public API
-- no longer needs a permissive insert policy.
drop policy if exists "company_signup_requests_public_insert" on public.company_signup_requests;
revoke insert on public.company_signup_requests from anon, authenticated;
grant select, insert, update, delete on public.company_signup_requests to service_role;

-- Profile photos remain public objects, but clients should not be able to list
-- every object in the bucket through a broad SELECT policy.
drop policy if exists "profile_photos_public_read" on storage.objects;

-- Remove legacy broad policies if they still exist on older environments.
do $$
begin
  if to_regclass('public.submissions') is not null then
    execute 'drop policy if exists "authenticated can update submissions for now" on public.submissions';
  end if;

  if to_regclass('public.peshep_submissions') is not null then
    execute 'drop policy if exists "authenticated can update peshep submissions for now" on public.peshep_submissions';
  end if;

  if to_regclass('public.demo_requests') is not null then
    execute 'drop policy if exists "Public users can create demo requests" on public.demo_requests';
    execute 'revoke insert on public.demo_requests from anon, authenticated';
    execute 'grant select, insert, update, delete on public.demo_requests to service_role';
  end if;
end $$;

-- Lock function name resolution for functions flagged by the advisor.
do $$
begin
  if to_regprocedure('public.sor_set_updated_at()') is not null then
    execute 'alter function public.sor_set_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.sor_prevent_hard_delete()') is not null then
    execute 'alter function public.sor_prevent_hard_delete() set search_path = public';
  end if;

  if to_regprocedure('public.si_bump_generated_document_version()') is not null then
    execute 'alter function public.si_bump_generated_document_version() set search_path = public';
  end if;

  if to_regprocedure('public.security_can_submit_company_field_audit(uuid)') is not null then
    execute 'alter function public.security_can_submit_company_field_audit(uuid) set search_path = public';
  end if;

  if to_regprocedure('public.sor_guard_locked_rows()') is not null then
    execute 'alter function public.sor_guard_locked_rows() set search_path = public';
  end if;

  if to_regprocedure('public.normalize_legacy_rbac_role(text)') is not null then
    execute 'alter function public.normalize_legacy_rbac_role(text) set search_path = public';
  end if;
end $$;

commit;
