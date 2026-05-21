begin;

-- RLS helper functions still need authenticated execution when policies call
-- them, but they should not be callable anonymously through PostgREST RPC.
revoke execute on function public.billing_is_super_platform() from public, anon;
grant execute on function public.billing_is_super_platform() to authenticated, service_role;

revoke execute on function public.billing_user_can_access_company(uuid) from public, anon;
grant execute on function public.billing_user_can_access_company(uuid) to authenticated, service_role;

revoke execute on function public.billing_staff_can_mutate_company(uuid) from public, anon;
grant execute on function public.billing_staff_can_mutate_company(uuid) to authenticated, service_role;

revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;

revoke execute on function public.is_admin_role() from public, anon;
grant execute on function public.is_admin_role() to authenticated, service_role;

revoke execute on function public.is_company_finance_user() from public, anon;
grant execute on function public.is_company_finance_user() to authenticated, service_role;

revoke execute on function public.is_company_portal_admin() from public, anon;
grant execute on function public.is_company_portal_admin() to authenticated, service_role;

revoke execute on function public.is_company_portal_employee() from public, anon;
grant execute on function public.is_company_portal_employee() to authenticated, service_role;

revoke execute on function public.is_company_portal_owner() from public, anon;
grant execute on function public.is_company_portal_owner() to authenticated, service_role;

revoke execute on function public.match_company_memory_items(uuid, public.vector, integer) from public, anon;
grant execute on function public.match_company_memory_items(uuid, public.vector, integer) to authenticated, service_role;

revoke execute on function public.security_can_manage_safety_intelligence(uuid) from public, anon;
grant execute on function public.security_can_manage_safety_intelligence(uuid) to authenticated, service_role;

revoke execute on function public.security_can_mutate_company_memory(uuid) from public, anon;
grant execute on function public.security_can_mutate_company_memory(uuid) to authenticated, service_role;

revoke execute on function public.security_can_mutate_company_training_requirements(uuid) from public, anon;
grant execute on function public.security_can_mutate_company_training_requirements(uuid) to authenticated, service_role;

revoke execute on function public.security_is_company_member(uuid) from public, anon;
grant execute on function public.security_is_company_member(uuid) to authenticated, service_role;

-- Legacy mutation RPCs and trigger functions are not public API surfaces.
revoke execute on function public.create_company_workspace(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_company_workspace(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

revoke execute on function public.record_marketplace_purchase(uuid, integer, text, jsonb)
from public, anon, authenticated;
grant execute on function public.record_marketplace_purchase(uuid, integer, text, jsonb)
to service_role;

revoke execute on function public.si_log_history() from public, anon, authenticated;
grant execute on function public.si_log_history() to service_role;

revoke execute on function public.si_store_generated_document_version() from public, anon, authenticated;
grant execute on function public.si_store_generated_document_version() to service_role;

revoke execute on function public.sor_audit_log_write() from public, anon, authenticated;
grant execute on function public.sor_audit_log_write() to service_role;

commit;
