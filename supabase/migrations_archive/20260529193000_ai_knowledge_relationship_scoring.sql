-- Adds explicit relationship review/scoring fields without changing existing
-- validation_status behavior used by the Knowledge Map review flow.

alter table public.ai_knowledge_edges
  add column if not exists evidence_text text null,
  add column if not exists status text null,
  add column if not exists created_by uuid null references auth.users(id) on delete set null,
  add column if not exists reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz null;

update public.ai_knowledge_edges
set status = case
  when validation_status = 'approved' then 'human_approved'
  when validation_status in ('rejected', 'incorrect') then 'rejected'
  when validation_status = 'needs_review' then 'needs_more_data'
  when validation_status = 'unreviewed' then 'draft'
  else 'suggested'
end
where status is null;

alter table public.ai_knowledge_edges
  alter column status set default 'suggested',
  alter column status set not null;

alter table public.ai_knowledge_edges
  drop constraint if exists ai_knowledge_edges_status_check;

alter table public.ai_knowledge_edges
  add constraint ai_knowledge_edges_status_check
  check (status in ('draft', 'suggested', 'auto_linked', 'human_approved', 'rejected', 'needs_more_data'));

create index if not exists ai_knowledge_edges_company_review_status_idx
  on public.ai_knowledge_edges(company_id, status, confidence_score, updated_at desc);

create index if not exists ai_knowledge_edges_reviewed_by_idx
  on public.ai_knowledge_edges(reviewed_by, reviewed_at desc)
  where reviewed_by is not null;
