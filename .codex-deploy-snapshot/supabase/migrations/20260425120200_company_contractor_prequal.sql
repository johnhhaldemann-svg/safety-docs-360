-- Contractor compliance documents and optional evaluation scores.

create table if not exists public.company_contractor_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contractor_id uuid not null references public.company_contractors(id) on delete cascade,
  doc_type text not null,
  title text not null,
  expires_on date null,
  file_path text null,
  verification_status text not null default 'pending',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_contractor_documents_doc_type_check check (
    doc_type in ('coi', 'wcb', 'license', 'emr', 'safety_manual', 'other')
  ),
  constraint company_contractor_documents_verification_check check (
    verification_status in ('pending', 'approved', 'rejected')
  ),
  constraint company_contractor_documents_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists company_contractor_documents_contractor_idx
  on public.company_contractor_documents(company_id, contractor_id, expires_on);

drop trigger if exists set_company_contractor_documents_updated_at on public.company_contractor_documents;
create trigger set_company_contractor_documents_updated_at
before update on public.company_contractor_documents
for each row execute function public.set_updated_at();

create table if not exists public.company_contractor_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contractor_id uuid not null references public.company_contractors(id) on delete cascade,
  score numeric not null default 0,
  blocking_flags jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  evaluator_id uuid null references auth.users(id) on delete set null,
  notes text null
);

create index if not exists company_contractor_evaluations_contractor_idx
  on public.company_contractor_evaluations(company_id, contractor_id, evaluated_at desc);

alter table public.company_contractor_documents enable row level security;
alter table public.company_contractor_evaluations enable row level security;

grant select, insert, update on public.company_contractor_documents to authenticated;
grant select, insert, update on public.company_contractor_evaluations to authenticated;

drop policy if exists "company_contractor_documents_select_scope" on public.company_contractor_documents;
create policy "company_contractor_documents_select_scope"
on public.company_contractor_documents for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
);

drop policy if exists "company_contractor_documents_insert_scope" on public.company_contractor_documents;
create policy "company_contractor_documents_insert_scope"
on public.company_contractor_documents for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
);

drop policy if exists "company_contractor_documents_update_scope" on public.company_contractor_documents;
create policy "company_contractor_documents_update_scope"
on public.company_contractor_documents for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_documents.company_id)
);

drop policy if exists "company_contractor_evaluations_select_scope" on public.company_contractor_evaluations;
create policy "company_contractor_evaluations_select_scope"
on public.company_contractor_evaluations for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_evaluations.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_evaluations.company_id)
);

drop policy if exists "company_contractor_evaluations_insert_scope" on public.company_contractor_evaluations;
create policy "company_contractor_evaluations_insert_scope"
on public.company_contractor_evaluations for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_evaluations.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_contractor_evaluations.company_id)
);
