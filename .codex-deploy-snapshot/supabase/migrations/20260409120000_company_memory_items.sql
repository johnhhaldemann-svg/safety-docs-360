-- Company-wide memory bank for AI RAG (company-scoped; no cross-tenant reads).

create extension if not exists vector;

create table if not exists public.company_memory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source text not null default 'manual'
    check (source in ('manual', 'document_excerpt', 'incident_summary', 'other')),
  title text not null default '',
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_memory_items_company_id_idx
  on public.company_memory_items (company_id);

create index if not exists company_memory_items_company_created_idx
  on public.company_memory_items (company_id, created_at desc);

-- HNSW cosine index (no training step; suitable for incremental inserts)
create index if not exists company_memory_items_embedding_hnsw
  on public.company_memory_items
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

alter table public.company_memory_items enable row level security;

grant select, insert, update, delete on public.company_memory_items to authenticated;

-- Leads who can curate memory (aligned with training requirements mutate pattern)
create or replace function public.security_can_mutate_company_memory (target_company_id uuid)
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
      from public.company_memberships m
      where m.company_id = target_company_id
        and m.user_id = auth.uid()
        and coalesce(m.status, '') = 'active'
        and coalesce(m.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'operations_manager',
          'safety_director',
          'safety_director_safety_manager'
        )
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and coalesce(ur.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'platform_admin',
          'super_admin',
          'admin'
        )
    );
$$;

grant execute on function public.security_can_mutate_company_memory (uuid) to authenticated;

drop policy if exists "company_memory_items_select_member" on public.company_memory_items;
create policy "company_memory_items_select_member"
on public.company_memory_items
for select
to authenticated
using (public.security_is_company_member (company_id));

drop policy if exists "company_memory_items_insert_lead" on public.company_memory_items;
create policy "company_memory_items_insert_lead"
on public.company_memory_items
for insert
to authenticated
with check (public.security_can_mutate_company_memory (company_id));

drop policy if exists "company_memory_items_update_lead" on public.company_memory_items;
create policy "company_memory_items_update_lead"
on public.company_memory_items
for update
to authenticated
using (public.security_can_mutate_company_memory (company_id))
with check (public.security_can_mutate_company_memory (company_id));

drop policy if exists "company_memory_items_delete_lead" on public.company_memory_items;
create policy "company_memory_items_delete_lead"
on public.company_memory_items
for delete
to authenticated
using (public.security_can_mutate_company_memory (company_id));

drop trigger if exists trg_company_memory_items_updated_at on public.company_memory_items;
create trigger trg_company_memory_items_updated_at
before update on public.company_memory_items
for each row
execute function public.set_updated_at ();

-- Semantic retrieval: only returns rows for companies the caller belongs to (definer bypasses RLS safely with explicit check)
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
security definer
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
    and public.security_is_company_member (p_company_id)
  order by c.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 8), 32);
$$;

grant execute on function public.match_company_memory_items (uuid, vector(1536), int) to authenticated;
