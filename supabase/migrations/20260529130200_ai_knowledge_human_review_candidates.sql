-- Human-reviewed staging layer for the AI Knowledge Map.
-- Rebuilds write candidates here first; only approved candidates are promoted
-- into trusted ai_knowledge_nodes / ai_knowledge_edges / ai_vector_memory.

create table if not exists public.ai_knowledge_ingest_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  batch_type text not null default 'rebuild_index',
  status text not null default 'pending_review',
  source_counts jsonb not null default '{}'::jsonb,
  candidate_counts jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_by_type text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_ingest_batches_status_check check (status in ('pending_review', 'partially_approved', 'approved', 'rejected', 'promoted', 'failed')),
  constraint ai_knowledge_ingest_batches_counts_object check (jsonb_typeof(source_counts) = 'object' and jsonb_typeof(candidate_counts) = 'object'),
  constraint ai_knowledge_ingest_batches_warnings_array check (jsonb_typeof(warnings) = 'array'),
  constraint ai_knowledge_ingest_batches_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint ai_knowledge_ingest_batches_created_by_type_check check (created_by_type in ('system', 'user', 'ai'))
);

create table if not exists public.ai_knowledge_ingest_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid null references public.ai_knowledge_ingest_batches(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete cascade,
  candidate_type text not null,
  source_table text null,
  source_id text null,
  source_record_id text null,
  source_node_key text null,
  target_node_key text null,
  relationship_type text null,
  title text not null,
  semantic_summary text null,
  reason text null,
  source_evidence jsonb not null default '[]'::jsonb,
  proposed_payload jsonb not null default '{}'::jsonb,
  confidence_score numeric null,
  validation_status text not null default 'pending_review',
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  review_note text null,
  promoted_node_id uuid null references public.ai_knowledge_nodes(id) on delete set null,
  promoted_edge_id uuid null references public.ai_knowledge_edges(id) on delete set null,
  promoted_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_type text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_ingest_candidates_type_check check (candidate_type in ('node', 'edge', 'failed_source')),
  constraint ai_knowledge_ingest_candidates_status_check check (validation_status in ('pending_review', 'approved', 'rejected', 'incorrect', 'promoted', 'failed')),
  constraint ai_knowledge_ingest_candidates_confidence_range check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  constraint ai_knowledge_ingest_candidates_evidence_array check (jsonb_typeof(source_evidence) = 'array'),
  constraint ai_knowledge_ingest_candidates_payload_object check (jsonb_typeof(proposed_payload) = 'object'),
  constraint ai_knowledge_ingest_candidates_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint ai_knowledge_ingest_candidates_created_by_type_check check (created_by_type in ('system', 'user', 'ai'))
);

create index if not exists ai_knowledge_ingest_batches_company_status_idx
  on public.ai_knowledge_ingest_batches(company_id, status, created_at desc);

create index if not exists ai_knowledge_ingest_candidates_company_status_idx
  on public.ai_knowledge_ingest_candidates(company_id, validation_status, candidate_type, created_at desc);

create index if not exists ai_knowledge_ingest_candidates_batch_idx
  on public.ai_knowledge_ingest_candidates(batch_id, validation_status, candidate_type);

create index if not exists ai_knowledge_ingest_candidates_source_idx
  on public.ai_knowledge_ingest_candidates(company_id, source_table, source_id);

drop trigger if exists set_ai_knowledge_ingest_batches_updated_at on public.ai_knowledge_ingest_batches;
create trigger set_ai_knowledge_ingest_batches_updated_at before update on public.ai_knowledge_ingest_batches
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_knowledge_ingest_candidates_updated_at on public.ai_knowledge_ingest_candidates;
create trigger set_ai_knowledge_ingest_candidates_updated_at before update on public.ai_knowledge_ingest_candidates
for each row execute function public.set_updated_at();

alter table public.ai_knowledge_ingest_batches enable row level security;
alter table public.ai_knowledge_ingest_candidates enable row level security;

revoke all on public.ai_knowledge_ingest_batches from public, anon, authenticated;
revoke all on public.ai_knowledge_ingest_candidates from public, anon, authenticated;

grant select, insert, update, delete on public.ai_knowledge_ingest_batches to service_role;
grant select, insert, update, delete on public.ai_knowledge_ingest_candidates to service_role;
