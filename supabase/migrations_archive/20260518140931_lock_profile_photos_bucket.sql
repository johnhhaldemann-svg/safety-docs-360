-- Profile photos are private user-owned objects. Public buckets can be listed
-- by anonymous clients through the Storage API even when object SELECT policies
-- are tightened, so keep the bucket private and issue signed URLs from server
-- routes after normal app authorization.
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do update
set public = false,
    name = excluded.name;

drop policy if exists "profile_photos_public_read" on storage.objects;
drop policy if exists "profile_photos_select_own" on storage.objects;
create policy "profile_photos_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
