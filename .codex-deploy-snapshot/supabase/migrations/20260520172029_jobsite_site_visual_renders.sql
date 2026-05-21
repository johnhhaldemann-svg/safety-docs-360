create table if not exists public.company_jobsite_site_renders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  site_map_id uuid null references public.company_jobsite_site_maps(id) on delete cascade,
  blueprint_id uuid null references public.company_jobsite_site_blueprints(id) on delete set null,
  render_status text not null default 'ready',
  prompt_hash text null,
  image_path text null,
  thumbnail_path text null,
  image_width integer null,
  image_height integer null,
  overlay_json jsonb not null default '{}'::jsonb,
  ai_meta jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  constraint company_jobsite_site_renders_status_check check (
    render_status in ('ready', 'failed', 'archived')
  ),
  constraint company_jobsite_site_renders_image_width_check check (image_width is null or image_width > 0),
  constraint company_jobsite_site_renders_image_height_check check (image_height is null or image_height > 0)
);

create index if not exists company_jobsite_site_renders_company_jobsite_idx
on public.company_jobsite_site_renders(company_id, jobsite_id, created_at desc)
where archived_at is null;

create index if not exists company_jobsite_site_renders_site_map_idx
on public.company_jobsite_site_renders(site_map_id)
where site_map_id is not null and archived_at is null;

create index if not exists company_jobsite_site_renders_blueprint_idx
on public.company_jobsite_site_renders(blueprint_id)
where blueprint_id is not null and archived_at is null;

drop trigger if exists set_company_jobsite_site_renders_updated_at on public.company_jobsite_site_renders;
create trigger set_company_jobsite_site_renders_updated_at
before update on public.company_jobsite_site_renders
for each row execute function public.set_updated_at();

alter table public.company_jobsite_site_renders enable row level security;

grant select, insert, update, delete on public.company_jobsite_site_renders to authenticated;
grant select, insert, update, delete on public.company_jobsite_site_renders to service_role;

drop policy if exists company_jobsite_site_renders_select_scope on public.company_jobsite_site_renders;
create policy company_jobsite_site_renders_select_scope
on public.company_jobsite_site_renders for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_site_renders_insert_scope on public.company_jobsite_site_renders;
create policy company_jobsite_site_renders_insert_scope
on public.company_jobsite_site_renders for insert to authenticated
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_site_renders.jobsite_id
      and jobsite.company_id = public.company_jobsite_site_renders.company_id
  )
);

drop policy if exists company_jobsite_site_renders_update_scope on public.company_jobsite_site_renders;
create policy company_jobsite_site_renders_update_scope
on public.company_jobsite_site_renders for update to authenticated
using (public.security_is_company_member(company_id))
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_site_renders.jobsite_id
      and jobsite.company_id = public.company_jobsite_site_renders.company_id
  )
);

drop policy if exists company_jobsite_site_renders_delete_scope on public.company_jobsite_site_renders;
create policy company_jobsite_site_renders_delete_scope
on public.company_jobsite_site_renders for delete to authenticated
using (public.security_can_write_company_data(company_id));
