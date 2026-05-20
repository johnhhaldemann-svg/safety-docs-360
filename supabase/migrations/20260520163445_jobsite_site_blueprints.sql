create table if not exists public.company_jobsite_site_blueprints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  source_file_path text not null,
  preview_image_path text null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  page_number integer not null default 1,
  processing_status text not null default 'pending',
  image_width integer null,
  image_height integer null,
  transform_json jsonb not null default '{}'::jsonb,
  ai_meta jsonb not null default '{}'::jsonb,
  processing_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  constraint company_jobsite_site_blueprints_status_check check (
    processing_status in ('pending', 'uploaded', 'processing', 'ready', 'failed', 'archived')
  ),
  constraint company_jobsite_site_blueprints_mime_check check (
    mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp')
  ),
  constraint company_jobsite_site_blueprints_page_check check (page_number between 1 and 200),
  constraint company_jobsite_site_blueprints_size_check check (file_size >= 0 and file_size <= 26214400),
  constraint company_jobsite_site_blueprints_file_name_check check (length(trim(file_name)) > 0)
);

create index if not exists company_jobsite_site_blueprints_company_jobsite_idx
on public.company_jobsite_site_blueprints(company_id, jobsite_id, created_at desc)
where archived_at is null;

create index if not exists company_jobsite_site_blueprints_ready_idx
on public.company_jobsite_site_blueprints(company_id, jobsite_id, updated_at desc)
where archived_at is null and processing_status = 'ready';

drop trigger if exists set_company_jobsite_site_blueprints_updated_at on public.company_jobsite_site_blueprints;
create trigger set_company_jobsite_site_blueprints_updated_at
before update on public.company_jobsite_site_blueprints
for each row execute function public.set_updated_at();

alter table public.company_jobsite_site_blueprints enable row level security;

grant select, insert, update, delete on public.company_jobsite_site_blueprints to authenticated;
grant select, insert, update, delete on public.company_jobsite_site_blueprints to service_role;

drop policy if exists company_jobsite_site_blueprints_select_scope on public.company_jobsite_site_blueprints;
create policy company_jobsite_site_blueprints_select_scope
on public.company_jobsite_site_blueprints for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_site_blueprints_insert_scope on public.company_jobsite_site_blueprints;
create policy company_jobsite_site_blueprints_insert_scope
on public.company_jobsite_site_blueprints for insert to authenticated
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_site_blueprints.jobsite_id
      and jobsite.company_id = public.company_jobsite_site_blueprints.company_id
  )
);

drop policy if exists company_jobsite_site_blueprints_update_scope on public.company_jobsite_site_blueprints;
create policy company_jobsite_site_blueprints_update_scope
on public.company_jobsite_site_blueprints for update to authenticated
using (public.security_is_company_member(company_id))
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_site_blueprints.jobsite_id
      and jobsite.company_id = public.company_jobsite_site_blueprints.company_id
  )
);

drop policy if exists company_jobsite_site_blueprints_delete_scope on public.company_jobsite_site_blueprints;
create policy company_jobsite_site_blueprints_delete_scope
on public.company_jobsite_site_blueprints for delete to authenticated
using (public.security_can_write_company_data(company_id));

alter table public.company_jobsite_site_maps
add column if not exists blueprint_id uuid null references public.company_jobsite_site_blueprints(id) on delete set null;

create index if not exists company_jobsite_site_maps_blueprint_idx
on public.company_jobsite_site_maps(blueprint_id)
where blueprint_id is not null;
