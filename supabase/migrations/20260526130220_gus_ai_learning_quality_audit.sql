do $$
begin
  if not exists (select 1 from pg_type where typname = 'gus_learning_review_item_type') then
    create type public.gus_learning_review_item_type as enum (
      'unsafe_answer',
      'incorrect_answer',
      'missing_source',
      'weak_citation',
      'expired_source_used',
      'classification_dispute'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gus_learning_review_item_status') then
    create type public.gus_learning_review_item_status as enum (
      'pending_review',
      'in_review',
      'resolved',
      'archived'
    );
  end if;
end
$$;

alter table public.approved_knowledge
  add column if not exists citation_excerpt text null,
  add column if not exists citation_locator text null,
  add column if not exists source_content_hash text null,
  add column if not exists verification_notes text null,
  add column if not exists quality_score numeric(5,2) not null default 0 check (quality_score >= 0 and quality_score <= 100),
  add column if not exists supersedes_knowledge_id uuid null references public.approved_knowledge(id) on delete set null,
  add column if not exists superseded_by_knowledge_id uuid null references public.approved_knowledge(id) on delete set null;

create table if not exists public.gus_answer_audit (
  id uuid primary key default gen_random_uuid(),
  answer_id text not null,
  user_id uuid null references auth.users(id) on delete set null,
  company_id uuid null references public.companies(id) on delete cascade,
  project_id uuid null references public.company_jobsites(id) on delete set null,
  question text not null,
  question_hash text not null,
  retrieval_method text not null default 'none',
  selected_knowledge_ids uuid[] not null default '{}'::uuid[],
  rejected_candidate_ids uuid[] not null default '{}'::uuid[],
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  unsupported boolean not null default false,
  needs_review boolean not null default false,
  answer_text_hash text not null,
  retrieval_trace jsonb not null default '{}'::jsonb,
  citation_snippets jsonb not null default '[]'::jsonb,
  quality_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint gus_answer_audit_answer_id_not_blank check (length(trim(answer_id)) > 0),
  constraint gus_answer_audit_question_not_blank check (length(trim(question)) > 0),
  constraint gus_answer_audit_question_hash_not_blank check (length(trim(question_hash)) > 0),
  constraint gus_answer_audit_answer_hash_not_blank check (length(trim(answer_text_hash)) > 0)
);

alter table public.gus_answer_feedback
  add column if not exists answer_audit_id uuid null references public.gus_answer_audit(id) on delete set null;

create table if not exists public.gus_learning_review_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  project_id uuid null references public.company_jobsites(id) on delete set null,
  answer_audit_id uuid null references public.gus_answer_audit(id) on delete set null,
  feedback_id uuid null references public.gus_answer_feedback(id) on delete set null,
  item_type public.gus_learning_review_item_type not null,
  status public.gus_learning_review_item_status not null default 'pending_review',
  title text not null,
  user_comment text null,
  recommended_admin_action text not null,
  review_notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  resolved_by uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gus_learning_review_items_title_not_blank check (length(trim(title)) > 0),
  constraint gus_learning_review_items_action_not_blank check (length(trim(recommended_admin_action)) > 0)
);

create index if not exists approved_knowledge_quality_idx
  on public.approved_knowledge(company_id, quality_score desc, review_status, is_active);
create index if not exists approved_knowledge_supersession_idx
  on public.approved_knowledge(supersedes_knowledge_id, superseded_by_knowledge_id);
create index if not exists gus_answer_audit_company_created_idx
  on public.gus_answer_audit(company_id, created_at desc);
create index if not exists gus_answer_audit_answer_id_idx
  on public.gus_answer_audit(answer_id);
create index if not exists gus_answer_feedback_audit_idx
  on public.gus_answer_feedback(answer_audit_id);
create index if not exists gus_learning_review_items_company_status_idx
  on public.gus_learning_review_items(company_id, status, created_at desc);
create index if not exists gus_learning_review_items_feedback_idx
  on public.gus_learning_review_items(feedback_id);

drop trigger if exists set_gus_learning_review_items_updated_at on public.gus_learning_review_items;
create trigger set_gus_learning_review_items_updated_at
before update on public.gus_learning_review_items
for each row execute function public.set_updated_at();

alter table public.gus_answer_audit enable row level security;
alter table public.gus_learning_review_items enable row level security;

revoke all on public.gus_answer_audit from public, anon, authenticated;
revoke all on public.gus_learning_review_items from public, anon, authenticated;

grant select on public.gus_answer_audit to authenticated;
grant select on public.gus_learning_review_items to authenticated;
grant select, insert, update, delete on public.gus_answer_audit to service_role;
grant select, insert, update, delete on public.gus_learning_review_items to service_role;

drop policy if exists gus_answer_audit_select_scope on public.gus_answer_audit;
create policy gus_answer_audit_select_scope
on public.gus_answer_audit
for select
to authenticated
using (
  public.is_admin_role()
  or user_id = auth.uid()
  or (company_id is not null and public.security_can_review_gus_learning(company_id))
);

drop policy if exists gus_learning_review_items_select_scope on public.gus_learning_review_items;
create policy gus_learning_review_items_select_scope
on public.gus_learning_review_items
for select
to authenticated
using (
  public.is_admin_role()
  or (company_id is not null and public.security_can_review_gus_learning(company_id))
);

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
security definer
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
    and (k.company_id is null or public.security_is_company_member(k.company_id))
    and (p_project_id is null or k.project_id is null or k.project_id = p_project_id)
  order by k.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 8), 32);
$$;

grant execute on function public.match_approved_knowledge(uuid, uuid, vector(1536), int) to authenticated, service_role;
