create table if not exists public.user_dashboard_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_dashboard_layouts_updated_at on public.user_dashboard_layouts;
create trigger set_user_dashboard_layouts_updated_at
before update on public.user_dashboard_layouts
for each row
execute function public.set_updated_at();

alter table public.user_dashboard_layouts enable row level security;

grant select, insert, update, delete on public.user_dashboard_layouts to authenticated;

drop policy if exists "user_dashboard_layouts_select_self" on public.user_dashboard_layouts;
create policy "user_dashboard_layouts_select_self"
on public.user_dashboard_layouts
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists "user_dashboard_layouts_insert_self" on public.user_dashboard_layouts;
create policy "user_dashboard_layouts_insert_self"
on public.user_dashboard_layouts
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists "user_dashboard_layouts_update_self" on public.user_dashboard_layouts;
create policy "user_dashboard_layouts_update_self"
on public.user_dashboard_layouts
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists "user_dashboard_layouts_delete_self" on public.user_dashboard_layouts;
create policy "user_dashboard_layouts_delete_self"
on public.user_dashboard_layouts
for delete
to authenticated
using (
  auth.uid() = user_id
);
