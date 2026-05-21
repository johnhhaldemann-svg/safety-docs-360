create table if not exists public.company_jobsite_site_maps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  generation_status text not null default 'ready',
  prompt_hash text null,
  ai_meta jsonb not null default '{}'::jsonb,
  scene_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  constraint company_jobsite_site_maps_status_check check (
    generation_status in ('ready', 'fallback', 'failed', 'archived')
  )
);

create index if not exists company_jobsite_site_maps_company_jobsite_idx
on public.company_jobsite_site_maps(company_id, jobsite_id, created_at desc)
where archived_at is null;

drop trigger if exists set_company_jobsite_site_maps_updated_at on public.company_jobsite_site_maps;
create trigger set_company_jobsite_site_maps_updated_at
before update on public.company_jobsite_site_maps
for each row execute function public.set_updated_at();

alter table public.company_jobsite_site_maps enable row level security;

grant select, insert, update, delete on public.company_jobsite_site_maps to authenticated;
grant select, insert, update, delete on public.company_jobsite_site_maps to service_role;

drop policy if exists company_jobsite_site_maps_select_scope on public.company_jobsite_site_maps;
create policy company_jobsite_site_maps_select_scope
on public.company_jobsite_site_maps for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_site_maps_insert_scope on public.company_jobsite_site_maps;
create policy company_jobsite_site_maps_insert_scope
on public.company_jobsite_site_maps for insert to authenticated
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_site_maps.jobsite_id
      and jobsite.company_id = public.company_jobsite_site_maps.company_id
  )
);

drop policy if exists company_jobsite_site_maps_update_scope on public.company_jobsite_site_maps;
create policy company_jobsite_site_maps_update_scope
on public.company_jobsite_site_maps for update to authenticated
using (public.security_is_company_member(company_id))
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsites jobsite
    where jobsite.id = public.company_jobsite_site_maps.jobsite_id
      and jobsite.company_id = public.company_jobsite_site_maps.company_id
  )
);

drop policy if exists company_jobsite_site_maps_delete_scope on public.company_jobsite_site_maps;
create policy company_jobsite_site_maps_delete_scope
on public.company_jobsite_site_maps for delete to authenticated
using (public.security_can_write_company_data(company_id));

create table if not exists public.company_jobsite_visual_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  site_map_id uuid not null references public.company_jobsite_site_maps(id) on delete cascade,
  schedule_item_id uuid null references public.company_jobsite_schedule_items(id) on delete set null,
  source_type text not null default 'manual',
  source_id text null,
  label text not null,
  trade text null,
  work_area text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  risk_level text not null default 'medium',
  controls text[] not null default array[]::text[],
  color text not null default '#2563eb',
  position_x numeric not null default 0,
  position_y numeric not null default 0.5,
  position_z numeric not null default 0,
  size_x numeric not null default 4,
  size_y numeric not null default 1,
  size_z numeric not null default 4,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_jobsite_visual_zones_label_nonempty check (length(trim(label)) > 0),
  constraint company_jobsite_visual_zones_source_type_check check (
    source_type in ('schedule', 'jsa_activity', 'permit', 'observation', 'manual')
  ),
  constraint company_jobsite_visual_zones_risk_level_check check (
    risk_level in ('low', 'medium', 'high', 'critical')
  ),
  constraint company_jobsite_visual_zones_size_positive check (
    size_x > 0 and size_y > 0 and size_z > 0
  )
);

create index if not exists company_jobsite_visual_zones_map_idx
on public.company_jobsite_visual_zones(company_id, jobsite_id, site_map_id, created_at);

create index if not exists company_jobsite_visual_zones_schedule_idx
on public.company_jobsite_visual_zones(schedule_item_id)
where schedule_item_id is not null;

drop trigger if exists set_company_jobsite_visual_zones_updated_at on public.company_jobsite_visual_zones;
create trigger set_company_jobsite_visual_zones_updated_at
before update on public.company_jobsite_visual_zones
for each row execute function public.set_updated_at();

alter table public.company_jobsite_visual_zones enable row level security;

grant select, insert, update, delete on public.company_jobsite_visual_zones to authenticated;
grant select, insert, update, delete on public.company_jobsite_visual_zones to service_role;

drop policy if exists company_jobsite_visual_zones_select_scope on public.company_jobsite_visual_zones;
create policy company_jobsite_visual_zones_select_scope
on public.company_jobsite_visual_zones for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_jobsite_visual_zones_insert_scope on public.company_jobsite_visual_zones;
create policy company_jobsite_visual_zones_insert_scope
on public.company_jobsite_visual_zones for insert to authenticated
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsite_site_maps site_map
    where site_map.id = public.company_jobsite_visual_zones.site_map_id
      and site_map.company_id = public.company_jobsite_visual_zones.company_id
      and site_map.jobsite_id = public.company_jobsite_visual_zones.jobsite_id
  )
);

drop policy if exists company_jobsite_visual_zones_update_scope on public.company_jobsite_visual_zones;
create policy company_jobsite_visual_zones_update_scope
on public.company_jobsite_visual_zones for update to authenticated
using (public.security_is_company_member(company_id))
with check (
  public.security_can_write_company_data(company_id)
  and exists (
    select 1
    from public.company_jobsite_site_maps site_map
    where site_map.id = public.company_jobsite_visual_zones.site_map_id
      and site_map.company_id = public.company_jobsite_visual_zones.company_id
      and site_map.jobsite_id = public.company_jobsite_visual_zones.jobsite_id
  )
);

drop policy if exists company_jobsite_visual_zones_delete_scope on public.company_jobsite_visual_zones;
create policy company_jobsite_visual_zones_delete_scope
on public.company_jobsite_visual_zones for delete to authenticated
using (public.security_can_write_company_data(company_id));
