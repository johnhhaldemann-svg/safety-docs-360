insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create table if not exists public.company_report_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  report_id uuid not null references public.company_reports(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text null,
  file_size bigint null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists company_report_attachments_company_report_idx
  on public.company_report_attachments(company_id, report_id, created_at desc);

alter table public.company_report_attachments enable row level security;
grant select, insert on public.company_report_attachments to authenticated;

drop policy if exists "company_report_attachments_scope" on public.company_report_attachments;
create policy "company_report_attachments_scope"
on public.company_report_attachments
for all
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.company_id = company_report_attachments.company_id
      and ur.account_status = 'active'
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.company_id = company_report_attachments.company_id
      and ur.account_status = 'active'
  )
);

drop policy if exists "documents_bucket_select_company_scope" on storage.objects;
create policy "documents_bucket_select_company_scope"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.account_status = 'active'
        and ur.company_id::text = split_part(storage.objects.name, '/', 2)
    )
  )
);

drop policy if exists "documents_bucket_insert_company_scope" on storage.objects;
create policy "documents_bucket_insert_company_scope"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.account_status = 'active'
        and ur.role in ('company_admin', 'manager', 'safety_manager', 'project_manager', 'foreman', 'field_user')
        and ur.company_id::text = split_part(storage.objects.name, '/', 2)
    )
  )
);

drop policy if exists "documents_bucket_update_company_scope" on storage.objects;
create policy "documents_bucket_update_company_scope"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and (
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.account_status = 'active'
        and ur.company_id::text = split_part(storage.objects.name, '/', 2)
    )
  )
)
with check (
  bucket_id = 'documents'
  and (
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.account_status = 'active'
        and ur.company_id::text = split_part(storage.objects.name, '/', 2)
    )
  )
);
