-- Keep SECURITY DEFINER helpers from being callable as public RPC endpoints.
-- Invite consumption is now handled by server-side service-role code only.

revoke execute on function public.consume_company_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_company_invite(text, uuid) to service_role;

revoke execute on function public.match_approved_knowledge(uuid, uuid, vector(1536), int) from public, anon;
grant execute on function public.match_approved_knowledge(uuid, uuid, vector(1536), int) to authenticated, service_role;

revoke execute on function public.security_can_approve_gus_learning(uuid) from public, anon;
grant execute on function public.security_can_approve_gus_learning(uuid) to authenticated, service_role;

revoke execute on function public.security_can_review_gus_learning(uuid) from public, anon;
grant execute on function public.security_can_review_gus_learning(uuid) to authenticated, service_role;
