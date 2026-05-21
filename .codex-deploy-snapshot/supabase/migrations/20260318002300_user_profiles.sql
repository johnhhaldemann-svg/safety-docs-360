create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text null,
  preferred_name text null,
  job_title text null,
  trade_specialty text null,
  years_experience integer null,
  phone text null,
  city text null,
  state_region text null,
  readiness_status text not null default 'ready',
  certifications text[] not null default '{}'::text[],
  specialties text[] not null default '{}'::text[],
  equipment text[] not null default '{}'::text[],
  bio text null,
  photo_url text null,
  photo_path text null,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_readiness_status_check check (
    readiness_status in ('ready', 'travel_ready', 'limited')
  ),
  constraint user_profiles_years_experience_check check (
    years_experience is null or years_experience >= 0
  )
);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

grant select, insert, update on public.user_profiles to authenticated;

drop policy if exists "user_profiles_select_self_or_admin" on public.user_profiles;
create policy "user_profiles_select_self_or_admin"
on public.user_profiles
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin_role()
);

drop policy if exists "user_profiles_insert_self" on public.user_profiles;
create policy "user_profiles_insert_self"
on public.user_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists "user_profiles_update_self" on public.user_profiles;
create policy "user_profiles_update_self"
on public.user_profiles
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update
set public = excluded.public,
    name = excluded.name;

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_delete_own" on storage.objects;
create policy "profile_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
