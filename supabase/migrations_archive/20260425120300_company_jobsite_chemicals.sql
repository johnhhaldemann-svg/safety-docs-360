-- Jobsite chemical register with SDS file path and review dates.

create table if not exists public.company_jobsite_chemicals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  chemical_name text not null,
  manufacturer text null,
  sds_file_path text null,
  sds_effective_date date null,
  next_review_date date null,
  quantity_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_jobsite_chemicals_name_nonempty check (length(trim(chemical_name)) > 0)
);

create index if not exists company_jobsite_chemicals_scope_idx
  on public.company_jobsite_chemicals(company_id, jobsite_id, next_review_date);

drop trigger if exists set_company_jobsite_chemicals_updated_at on public.company_jobsite_chemicals;
create trigger set_company_jobsite_chemicals_updated_at
before update on public.company_jobsite_chemicals
for each row execute function public.set_updated_at();

alter table public.company_jobsite_chemicals enable row level security;

grant select, insert, update on public.company_jobsite_chemicals to authenticated;

drop policy if exists "company_jobsite_chemicals_select_scope" on public.company_jobsite_chemicals;
create policy "company_jobsite_chemicals_select_scope"
on public.company_jobsite_chemicals for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
);

drop policy if exists "company_jobsite_chemicals_insert_scope" on public.company_jobsite_chemicals;
create policy "company_jobsite_chemicals_insert_scope"
on public.company_jobsite_chemicals for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
);

drop policy if exists "company_jobsite_chemicals_update_scope" on public.company_jobsite_chemicals;
create policy "company_jobsite_chemicals_update_scope"
on public.company_jobsite_chemicals for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jobsite_chemicals.company_id)
);
