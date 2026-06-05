-- Audit log for HRIS / roster sync MVP (batch metadata only; no PII payload storage).

create table if not exists public.company_hris_roster_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source text not null default 'api',
  row_count int not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_hris_roster_imports_row_count_nonneg check (row_count >= 0)
);

create index if not exists company_hris_roster_imports_company_idx
  on public.company_hris_roster_imports(company_id, created_at desc);

alter table public.company_hris_roster_imports enable row level security;

grant select, insert on public.company_hris_roster_imports to authenticated;

drop policy if exists "company_hris_roster_imports_select_scope" on public.company_hris_roster_imports;
create policy "company_hris_roster_imports_select_scope"
on public.company_hris_roster_imports for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_hris_roster_imports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_hris_roster_imports.company_id)
);

drop policy if exists "company_hris_roster_imports_insert_scope" on public.company_hris_roster_imports;
create policy "company_hris_roster_imports_insert_scope"
on public.company_hris_roster_imports for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_hris_roster_imports.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_hris_roster_imports.company_id)
);
