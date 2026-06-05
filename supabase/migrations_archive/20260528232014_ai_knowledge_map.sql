-- AI Knowledge Map and Vector Coordinate Engine
-- Additive semantic index only. Existing source tables/folders remain unchanged.

create extension if not exists vector;

create table if not exists public.ai_knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id text not null,
  source_record_id text not null,
  project_id uuid null,
  company_id uuid null references public.companies(id) on delete cascade,
  jobsite_id uuid null,
  title text not null,
  node_type text not null,
  type text not null,
  category text not null,
  description text null,
  semantic_summary text null,
  risk_level text null,
  risk_score numeric null,
  trade text null,
  source_url text null,
  source_document text null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) null,
  x numeric null,
  y numeric null,
  z numeric null,
  vector_coordinates jsonb not null default '{}'::jsonb,
  vector_status text not null default 'pending',
  confidence_score numeric null,
  validation_status text not null default 'unreviewed',
  created_by_type text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_nodes_source_nonempty check (length(trim(source_table)) > 0 and length(trim(source_id)) > 0),
  constraint ai_knowledge_nodes_title_nonempty check (length(trim(title)) > 0),
  constraint ai_knowledge_nodes_risk_score_range check (risk_score is null or (risk_score >= 0 and risk_score <= 100)),
  constraint ai_knowledge_nodes_confidence_range check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  constraint ai_knowledge_nodes_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint ai_knowledge_nodes_vector_coordinates_object check (jsonb_typeof(vector_coordinates) = 'object'),
  constraint ai_knowledge_nodes_validation_status_check check (validation_status in ('unreviewed', 'pending_review', 'approved', 'rejected', 'incorrect', 'needs_review')),
  constraint ai_knowledge_nodes_created_by_type_check check (created_by_type in ('system', 'user', 'ai')),
  constraint ai_knowledge_nodes_source_unique unique (company_id, source_table, source_id)
);

create table if not exists public.ai_knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  source_node_id uuid not null references public.ai_knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.ai_knowledge_nodes(id) on delete cascade,
  from_node_id uuid not null references public.ai_knowledge_nodes(id) on delete cascade,
  to_node_id uuid not null references public.ai_knowledge_nodes(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  relationship_type text not null,
  relationship_strength numeric not null default 0.5,
  strength_score numeric not null default 0.5,
  reason text null,
  source_evidence jsonb not null default '[]'::jsonb,
  confidence_score numeric null,
  validation_status text not null default 'unreviewed',
  created_by_type text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_edges_not_self check (source_node_id <> target_node_id and from_node_id <> to_node_id),
  constraint ai_knowledge_edges_strength_range check (relationship_strength >= 0 and relationship_strength <= 1 and strength_score >= 0 and strength_score <= 1),
  constraint ai_knowledge_edges_confidence_range check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  constraint ai_knowledge_edges_evidence_array check (jsonb_typeof(source_evidence) = 'array'),
  constraint ai_knowledge_edges_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint ai_knowledge_edges_validation_status_check check (validation_status in ('unreviewed', 'pending_review', 'approved', 'rejected', 'incorrect', 'needs_review')),
  constraint ai_knowledge_edges_created_by_type_check check (created_by_type in ('system', 'user', 'ai')),
  constraint ai_knowledge_edges_unique unique (company_id, source_node_id, target_node_id, relationship_type)
);

create table if not exists public.ai_vector_memory (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.ai_knowledge_nodes(id) on delete cascade,
  knowledge_node_id uuid not null references public.ai_knowledge_nodes(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  source_table text not null,
  source_id text not null,
  content_text text not null,
  retrieval_text text not null,
  semantic_summary text null,
  embedding vector(1536) null,
  embedding_model text null,
  embedding_provider text null,
  prompt_hash text null,
  token_count integer null,
  retrieval_tags text[] null,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  error_message text null,
  indexed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_vector_memory_content_nonempty check (length(trim(content_text)) > 0),
  constraint ai_vector_memory_status_check check (status in ('pending', 'indexed', 'failed', 'fallback')),
  constraint ai_vector_memory_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint ai_vector_memory_node_unique unique (node_id)
);

create table if not exists public.ai_engine_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  company_id uuid null references public.companies(id) on delete cascade,
  source_table text null,
  source_id text null,
  source_record_id text null,
  node_id uuid null references public.ai_knowledge_nodes(id) on delete set null,
  edge_id uuid null references public.ai_knowledge_edges(id) on delete set null,
  description text null,
  message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_type text not null default 'system',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_engine_events_type_nonempty check (length(trim(event_type)) > 0),
  constraint ai_engine_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint ai_engine_events_created_by_type_check check (created_by_type in ('system', 'user', 'ai'))
);

create table if not exists public.ai_engine_validation_logs (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  company_id uuid null references public.companies(id) on delete cascade,
  edge_id uuid null references public.ai_knowledge_edges(id) on delete set null,
  node_id uuid null references public.ai_knowledge_nodes(id) on delete set null,
  validation_action text not null,
  validation_note text null,
  previous_status text null,
  new_status text null,
  validation_status text null,
  reason text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_engine_validation_logs_target_check check (target_type in ('node', 'edge', 'index', 'source_record')),
  constraint ai_engine_validation_logs_action_nonempty check (length(trim(validation_action)) > 0),
  constraint ai_engine_validation_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.ai_knowledge_map_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  layout_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_map_views_name_nonempty check (length(trim(name)) > 0),
  constraint ai_knowledge_map_views_filters_object check (jsonb_typeof(filters) = 'object'),
  constraint ai_knowledge_map_views_layout_object check (jsonb_typeof(layout_settings) = 'object')
);

create index if not exists ai_knowledge_nodes_company_type_idx on public.ai_knowledge_nodes(company_id, node_type, risk_level, updated_at desc);
create index if not exists ai_knowledge_nodes_source_idx on public.ai_knowledge_nodes(source_table, source_id);
create index if not exists ai_knowledge_nodes_vector_hnsw on public.ai_knowledge_nodes using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index if not exists ai_knowledge_edges_company_status_idx on public.ai_knowledge_edges(company_id, validation_status, relationship_type, updated_at desc);
create index if not exists ai_knowledge_edges_source_idx on public.ai_knowledge_edges(company_id, source_node_id);
create index if not exists ai_knowledge_edges_target_idx on public.ai_knowledge_edges(company_id, target_node_id);
create index if not exists ai_vector_memory_source_idx on public.ai_vector_memory(company_id, source_table, source_id);
create index if not exists ai_vector_memory_embedding_hnsw on public.ai_vector_memory using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index if not exists ai_engine_events_created_idx on public.ai_engine_events(company_id, created_at desc);
create index if not exists ai_engine_validation_logs_created_idx on public.ai_engine_validation_logs(company_id, created_at desc);
create index if not exists ai_knowledge_map_views_user_idx on public.ai_knowledge_map_views(user_id, updated_at desc);

drop trigger if exists set_ai_knowledge_nodes_updated_at on public.ai_knowledge_nodes;
create trigger set_ai_knowledge_nodes_updated_at before update on public.ai_knowledge_nodes
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_knowledge_edges_updated_at on public.ai_knowledge_edges;
create trigger set_ai_knowledge_edges_updated_at before update on public.ai_knowledge_edges
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_vector_memory_updated_at on public.ai_vector_memory;
create trigger set_ai_vector_memory_updated_at before update on public.ai_vector_memory
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_knowledge_map_views_updated_at on public.ai_knowledge_map_views;
create trigger set_ai_knowledge_map_views_updated_at before update on public.ai_knowledge_map_views
for each row execute function public.set_updated_at();

alter table public.ai_knowledge_nodes enable row level security;
alter table public.ai_knowledge_edges enable row level security;
alter table public.ai_vector_memory enable row level security;
alter table public.ai_engine_events enable row level security;
alter table public.ai_engine_validation_logs enable row level security;
alter table public.ai_knowledge_map_views enable row level security;

revoke all on public.ai_knowledge_nodes from public, anon, authenticated;
revoke all on public.ai_knowledge_edges from public, anon, authenticated;
revoke all on public.ai_vector_memory from public, anon, authenticated;
revoke all on public.ai_engine_events from public, anon, authenticated;
revoke all on public.ai_engine_validation_logs from public, anon, authenticated;
revoke all on public.ai_knowledge_map_views from public, anon, authenticated;

grant select, insert, update, delete on public.ai_knowledge_nodes to service_role;
grant select, insert, update, delete on public.ai_knowledge_edges to service_role;
grant select, insert, update, delete on public.ai_vector_memory to service_role;
grant select, insert, update, delete on public.ai_engine_events to service_role;
grant select, insert, update, delete on public.ai_engine_validation_logs to service_role;
grant select, insert, update, delete on public.ai_knowledge_map_views to service_role;
