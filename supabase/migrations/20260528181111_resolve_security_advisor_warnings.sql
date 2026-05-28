-- Resolve remaining Supabase security advisor warnings without removing RLS helpers.
-- Vector search RPCs remain callable by signed-in users, but now run as invoker
-- functions so table RLS policies enforce tenant scope. Privileged helper
-- functions remain available to RLS policies and service-role server code only.

create schema if not exists extensions;

create or replace function public.match_company_memory_items (
  p_company_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  id uuid,
  company_id uuid,
  source text,
  title text,
  body text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.company_id,
    c.source,
    c.title,
    c.body,
    c.metadata,
    c.created_by,
    c.created_at,
    c.updated_at,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.company_memory_items c
  where c.company_id = p_company_id
    and c.embedding is not null
  order by c.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 8), 32);
$$;

create or replace function public.match_approved_knowledge (
  p_company_id uuid,
  p_project_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  id uuid,
  company_id uuid,
  project_id uuid,
  approved_source_id uuid,
  research_queue_id uuid,
  topic text,
  knowledge_title text,
  approved_summary text,
  source_url text,
  source_title text,
  source_type public.gus_learning_source_type,
  jurisdiction text,
  regulation_reference text,
  applies_to text,
  affected_modules text[],
  required_control_type public.gus_required_control_type,
  citation_excerpt text,
  citation_locator text,
  source_content_hash text,
  verification_notes text,
  quality_score numeric,
  supersedes_knowledge_id uuid,
  superseded_by_knowledge_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  review_due_date date,
  review_status public.gus_knowledge_review_status,
  version integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    k.id,
    k.company_id,
    k.project_id,
    k.approved_source_id,
    k.research_queue_id,
    k.topic,
    k.knowledge_title,
    k.approved_summary,
    k.source_url,
    k.source_title,
    k.source_type,
    k.jurisdiction,
    k.regulation_reference,
    k.applies_to,
    k.affected_modules,
    k.required_control_type,
    k.citation_excerpt,
    k.citation_locator,
    k.source_content_hash,
    k.verification_notes,
    k.quality_score,
    k.supersedes_knowledge_id,
    k.superseded_by_knowledge_id,
    k.approved_by,
    k.approved_at,
    k.review_due_date,
    k.review_status,
    k.version,
    k.is_active,
    k.created_at,
    k.updated_at,
    1 - (k.embedding <=> p_query_embedding) as similarity
  from public.approved_knowledge k
  where k.is_active = true
    and k.embedding is not null
    and (k.company_id is null or k.company_id = p_company_id)
    and (p_project_id is null or k.project_id is null or k.project_id = p_project_id)
  order by k.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 8), 32);
$$;

grant execute on function public.match_company_memory_items(uuid, vector(1536), int) to authenticated, service_role;
grant execute on function public.match_approved_knowledge(uuid, uuid, vector(1536), int) to authenticated, service_role;

revoke execute on function public.billing_is_super_platform() from public, anon, authenticated;
revoke execute on function public.billing_staff_can_mutate_company(uuid) from public, anon, authenticated;
revoke execute on function public.billing_user_can_access_company(uuid) from public, anon, authenticated;
revoke execute on function public.claim_approved_company_owner(text, uuid) from public, anon, authenticated;
revoke execute on function public.create_company_workspace(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.current_app_role() from public, anon, authenticated;
revoke execute on function public.is_admin_role() from public, anon, authenticated;
revoke execute on function public.is_company_finance_user() from public, anon, authenticated;
revoke execute on function public.is_company_portal_admin() from public, anon, authenticated;
revoke execute on function public.is_company_portal_employee() from public, anon, authenticated;
revoke execute on function public.is_company_portal_owner() from public, anon, authenticated;
revoke execute on function public.security_can_approve_gus_learning(uuid) from public, anon, authenticated;
revoke execute on function public.security_can_manage_safety_intelligence(uuid) from public, anon, authenticated;
revoke execute on function public.security_can_mutate_company_memory(uuid) from public, anon, authenticated;
revoke execute on function public.security_can_mutate_company_training_requirements(uuid) from public, anon, authenticated;
revoke execute on function public.security_can_review_gus_learning(uuid) from public, anon, authenticated;
revoke execute on function public.security_is_company_member(uuid) from public, anon, authenticated;

grant execute on function public.billing_is_super_platform() to service_role;
grant execute on function public.billing_staff_can_mutate_company(uuid) to service_role;
grant execute on function public.billing_user_can_access_company(uuid) to service_role;
grant execute on function public.claim_approved_company_owner(text, uuid) to service_role;
grant execute on function public.create_company_workspace(text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.current_app_role() to service_role;
grant execute on function public.is_admin_role() to service_role;
grant execute on function public.is_company_finance_user() to service_role;
grant execute on function public.is_company_portal_admin() to service_role;
grant execute on function public.is_company_portal_employee() to service_role;
grant execute on function public.is_company_portal_owner() to service_role;
grant execute on function public.security_can_approve_gus_learning(uuid) to service_role;
grant execute on function public.security_can_manage_safety_intelligence(uuid) to service_role;
grant execute on function public.security_can_mutate_company_memory(uuid) to service_role;
grant execute on function public.security_can_mutate_company_training_requirements(uuid) to service_role;
grant execute on function public.security_can_review_gus_learning(uuid) to service_role;
grant execute on function public.security_is_company_member(uuid) to service_role;

alter extension vector set schema extensions;
