-- Semantic retrieval for approved AI Knowledge Graph memory.
-- The underlying graph tables remain service-role only; this RPC is for
-- server-side adaptive AI surfaces and never exposes unreviewed candidates.

create or replace function public.match_ai_knowledge_graph_memory (
  p_company_id uuid,
  p_project_id uuid,
  p_jobsite_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  id uuid,
  company_id uuid,
  project_id uuid,
  jobsite_id uuid,
  source_table text,
  source_id text,
  source_record_id text,
  title text,
  node_type text,
  type text,
  category text,
  description text,
  semantic_summary text,
  risk_level text,
  risk_score numeric,
  trade text,
  project text,
  source_url text,
  source_document text,
  metadata jsonb,
  confidence_score numeric,
  validation_status text,
  created_by_type text,
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
    n.id,
    n.company_id,
    n.project_id,
    n.jobsite_id,
    n.source_table,
    n.source_id,
    n.source_record_id,
    n.title,
    n.node_type,
    n.type,
    n.category,
    n.description,
    n.semantic_summary,
    n.risk_level,
    n.risk_score,
    n.trade,
    n.project,
    n.source_url,
    n.source_document,
    n.metadata,
    n.confidence_score,
    n.validation_status,
    n.created_by_type,
    n.created_at,
    n.updated_at,
    1 - (m.embedding <=> p_query_embedding) as similarity
  from public.ai_vector_memory m
  join public.ai_knowledge_nodes n
    on n.id = m.node_id
  where n.company_id = p_company_id
    and m.company_id = p_company_id
    and n.validation_status = 'approved'
    and m.status = 'indexed'
    and m.embedding is not null
    and (p_project_id is null or n.project_id is null or n.project_id = p_project_id)
    and (p_jobsite_id is null or n.jobsite_id is null or n.jobsite_id = p_jobsite_id)
  order by m.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 8), 32);
$$;

revoke execute on function public.match_ai_knowledge_graph_memory(uuid, uuid, uuid, vector(1536), int)
  from public, anon, authenticated;
grant execute on function public.match_ai_knowledge_graph_memory(uuid, uuid, uuid, vector(1536), int)
  to service_role;
