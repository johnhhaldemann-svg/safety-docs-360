create extension if not exists vector;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'gus_learning_source_type') then
    create type public.gus_learning_source_type as enum (
      'OSHA',
      'NIOSH',
      'CDC',
      'NFPA reference',
      'manufacturer manual',
      'company policy',
      'site safety plan',
      'SDS',
      'owner requirement',
      'insurance carrier guidance',
      'blog_article',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gus_learning_trust_level') then
    create type public.gus_learning_trust_level as enum ('high', 'medium', 'low', 'blocked');
  end if;

  if not exists (select 1 from pg_type where typname = 'gus_research_status') then
    create type public.gus_research_status as enum (
      'pending_review',
      'approved',
      'rejected',
      'needs_more_review',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gus_required_control_type') then
    create type public.gus_required_control_type as enum (
      'regulatory_requirement',
      'company_policy',
      'site_requirement',
      'manufacturer_instruction',
      'best_practice',
      'ai_suggestion'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gus_knowledge_change_type') then
    create type public.gus_knowledge_change_type as enum (
      'created',
      'edited',
      'approved',
      'rejected',
      'archived',
      'expired'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gus_knowledge_review_status') then
    create type public.gus_knowledge_review_status as enum ('current', 'needs_review', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'gus_answer_feedback_type') then
    create type public.gus_answer_feedback_type as enum (
      'helpful',
      'not_helpful',
      'unsafe',
      'incorrect',
      'missing_source'
    );
  end if;
end
$$;

create or replace function public.security_can_approve_gus_learning(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and coalesce(ur.role, '') in ('platform_admin', 'super_admin', 'admin', 'company_admin')
    )
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
        and coalesce(cm.status, 'active') = 'active'
        and coalesce(cm.role, '') = 'company_admin'
    );
$$;

create or replace function public.security_can_review_gus_learning(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.security_can_approve_gus_learning(target_company_id)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and coalesce(ur.role, '') in ('safety_manager', 'manager')
    )
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
        and coalesce(cm.status, 'active') = 'active'
        and coalesce(cm.role, '') in ('safety_manager', 'manager')
    );
$$;

grant execute on function public.security_can_approve_gus_learning(uuid) to authenticated, service_role;
grant execute on function public.security_can_review_gus_learning(uuid) to authenticated, service_role;

create table if not exists public.approved_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  domain text not null,
  source_type public.gus_learning_source_type not null,
  jurisdiction text not null default 'Federal',
  trust_level public.gus_learning_trust_level not null default 'medium',
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_sources_name_not_blank check (length(trim(source_name)) > 0),
  constraint approved_sources_url_not_blank check (length(trim(source_url)) > 0),
  constraint approved_sources_domain_not_blank check (length(trim(domain)) > 0)
);

create table if not exists public.research_queue (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid null references auth.users(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid null references public.company_jobsites(id) on delete set null,
  approved_source_id uuid null references public.approved_sources(id) on delete set null,
  topic text not null,
  question text not null,
  source_url text not null,
  source_title text null,
  source_domain text not null,
  source_type public.gus_learning_source_type not null,
  date_accessed timestamptz not null default now(),
  raw_summary text not null default '',
  ai_confidence numeric(4,3) null check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  jurisdiction text not null default 'Federal',
  affected_modules text[] not null default '{}'::text[],
  status public.gus_research_status not null default 'pending_review',
  reviewer_id uuid null references auth.users(id) on delete set null,
  reviewer_notes text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint research_queue_topic_not_blank check (length(trim(topic)) > 0),
  constraint research_queue_question_not_blank check (length(trim(question)) > 0),
  constraint research_queue_source_url_not_blank check (length(trim(source_url)) > 0)
);

create table if not exists public.approved_knowledge (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  project_id uuid null references public.company_jobsites(id) on delete set null,
  approved_source_id uuid null references public.approved_sources(id) on delete set null,
  research_queue_id uuid null references public.research_queue(id) on delete set null,
  topic text not null,
  knowledge_title text not null,
  approved_summary text not null,
  source_url text not null,
  source_title text null,
  source_type public.gus_learning_source_type not null,
  jurisdiction text not null default 'Federal',
  regulation_reference text null,
  applies_to text null,
  affected_modules text[] not null default '{}'::text[],
  required_control_type public.gus_required_control_type not null,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  review_due_date date not null,
  review_status public.gus_knowledge_review_status not null default 'current',
  version integer not null default 1 check (version >= 1),
  is_active boolean not null default true,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_knowledge_topic_not_blank check (length(trim(topic)) > 0),
  constraint approved_knowledge_title_not_blank check (length(trim(knowledge_title)) > 0),
  constraint approved_knowledge_summary_not_blank check (length(trim(approved_summary)) > 0),
  constraint approved_knowledge_source_url_not_blank check (length(trim(source_url)) > 0)
);

create table if not exists public.knowledge_change_log (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid null references public.approved_knowledge(id) on delete set null,
  company_id uuid null references public.companies(id) on delete cascade,
  change_type public.gus_knowledge_change_type not null,
  old_value jsonb null,
  new_value jsonb null,
  changed_by uuid null references auth.users(id) on delete set null,
  change_reason text null,
  created_at timestamptz not null default now()
);

create table if not exists public.gus_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  answer_id text not null,
  user_id uuid null references auth.users(id) on delete set null,
  company_id uuid null references public.companies(id) on delete cascade,
  project_id uuid null references public.company_jobsites(id) on delete set null,
  feedback_type public.gus_answer_feedback_type not null,
  comment text null,
  needs_admin_review boolean not null default false,
  review_status public.gus_research_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  constraint gus_answer_feedback_answer_id_not_blank check (length(trim(answer_id)) > 0)
);

create index if not exists approved_sources_scope_idx
  on public.approved_sources(company_id, domain, is_active, trust_level);
create index if not exists research_queue_company_status_idx
  on public.research_queue(company_id, status, created_at desc);
create index if not exists research_queue_project_status_idx
  on public.research_queue(company_id, project_id, status, created_at desc);
create index if not exists approved_knowledge_company_priority_idx
  on public.approved_knowledge(company_id, project_id, required_control_type, review_status, is_active, approved_at desc);
create index if not exists approved_knowledge_review_due_idx
  on public.approved_knowledge(review_due_date, review_status, is_active);
create index if not exists approved_knowledge_embedding_hnsw
  on public.approved_knowledge
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null and is_active = true;
create index if not exists knowledge_change_log_company_created_idx
  on public.knowledge_change_log(company_id, created_at desc);
create index if not exists gus_answer_feedback_review_idx
  on public.gus_answer_feedback(company_id, needs_admin_review, created_at desc);

drop trigger if exists set_approved_sources_updated_at on public.approved_sources;
create trigger set_approved_sources_updated_at
before update on public.approved_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_approved_knowledge_updated_at on public.approved_knowledge;
create trigger set_approved_knowledge_updated_at
before update on public.approved_knowledge
for each row execute function public.set_updated_at();

alter table public.approved_sources enable row level security;
alter table public.research_queue enable row level security;
alter table public.approved_knowledge enable row level security;
alter table public.knowledge_change_log enable row level security;
alter table public.gus_answer_feedback enable row level security;

revoke all on public.approved_sources from public, anon, authenticated;
revoke all on public.research_queue from public, anon, authenticated;
revoke all on public.approved_knowledge from public, anon, authenticated;
revoke all on public.knowledge_change_log from public, anon, authenticated;
revoke all on public.gus_answer_feedback from public, anon, authenticated;

grant select on public.approved_sources to authenticated;
grant select on public.approved_knowledge to authenticated;
grant select on public.research_queue to authenticated;
grant select on public.knowledge_change_log to authenticated;
grant select on public.gus_answer_feedback to authenticated;
grant select, insert, update, delete on public.approved_sources to service_role;
grant select, insert, update, delete on public.research_queue to service_role;
grant select, insert, update, delete on public.approved_knowledge to service_role;
grant select, insert, update, delete on public.knowledge_change_log to service_role;
grant select, insert, update, delete on public.gus_answer_feedback to service_role;

drop policy if exists approved_sources_select_active_scope on public.approved_sources;
create policy approved_sources_select_active_scope
on public.approved_sources
for select
to authenticated
using (
  public.is_admin_role()
  or (
    is_active = true
    and trust_level <> 'blocked'
    and (company_id is null or public.security_is_company_member(company_id))
  )
);

drop policy if exists research_queue_select_review_scope on public.research_queue;
create policy research_queue_select_review_scope
on public.research_queue
for select
to authenticated
using (public.security_can_review_gus_learning(company_id));

drop policy if exists approved_knowledge_select_active_scope on public.approved_knowledge;
create policy approved_knowledge_select_active_scope
on public.approved_knowledge
for select
to authenticated
using (
  public.is_admin_role()
  or (
    is_active = true
    and (company_id is null or public.security_is_company_member(company_id))
  )
);

drop policy if exists knowledge_change_log_select_admin_scope on public.knowledge_change_log;
create policy knowledge_change_log_select_admin_scope
on public.knowledge_change_log
for select
to authenticated
using (
  public.is_admin_role()
  or (company_id is not null and public.security_can_approve_gus_learning(company_id))
);

drop policy if exists gus_answer_feedback_select_review_scope on public.gus_answer_feedback;
create policy gus_answer_feedback_select_review_scope
on public.gus_answer_feedback
for select
to authenticated
using (
  public.is_admin_role()
  or (company_id is not null and public.security_can_review_gus_learning(company_id))
  or user_id = auth.uid()
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
  review_due_date date,
  review_status public.gus_knowledge_review_status,
  version integer,
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
    k.review_due_date,
    k.review_status,
    k.version,
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
