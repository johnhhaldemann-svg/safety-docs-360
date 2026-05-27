create table if not exists public.owner_validation_sandbox_records (
  id uuid primary key default gen_random_uuid(),
  sandbox_key text not null,
  sandbox_company_id uuid null references public.companies(id) on delete set null,
  record_table text not null,
  record_id uuid not null,
  record_kind text not null,
  record_label text not null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint owner_validation_sandbox_records_unique unique (sandbox_key, record_table, record_id)
);

create index if not exists owner_validation_sandbox_records_company_idx
  on public.owner_validation_sandbox_records(sandbox_company_id, record_table);

create index if not exists owner_validation_sandbox_records_key_idx
  on public.owner_validation_sandbox_records(sandbox_key, record_kind);

alter table public.owner_validation_sandbox_records enable row level security;

grant select, insert, update, delete on public.owner_validation_sandbox_records to authenticated;

drop policy if exists "owner_validation_sandbox_records_super_admin_only"
on public.owner_validation_sandbox_records;
create policy "owner_validation_sandbox_records_super_admin_only"
on public.owner_validation_sandbox_records
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');
