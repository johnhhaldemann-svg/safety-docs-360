-- Strengthen Human Review for AI Knowledge memory promotion.
-- High/critical learned memory requires a second Super Admin approval before
-- it can become trusted graph/vector memory. Provenance/review-due data is
-- stored in metadata on promoted nodes, edges, and vector rows.

alter table public.ai_knowledge_ingest_candidates
  drop constraint if exists ai_knowledge_ingest_candidates_status_check;

alter table public.ai_knowledge_ingest_candidates
  add constraint ai_knowledge_ingest_candidates_status_check
  check (validation_status in ('pending_review', 'pending_second_approval', 'approved', 'rejected', 'incorrect', 'promoted', 'failed'));

create index if not exists ai_knowledge_ingest_candidates_second_approval_idx
  on public.ai_knowledge_ingest_candidates(company_id, validation_status, created_at desc)
  where validation_status = 'pending_second_approval';
