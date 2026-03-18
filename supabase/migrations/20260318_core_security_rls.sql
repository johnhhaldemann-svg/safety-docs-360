alter table if exists public.submissions enable row level security;
alter table if exists public.subscriptions enable row level security;
alter table if exists public.documents enable row level security;
alter table if exists public.credit_transactions enable row level security;
alter table if exists public.document_downloads enable row level security;
alter table if exists public.platform_settings enable row level security;

drop policy if exists "submissions_select_own_or_admin" on public.submissions;
create policy "submissions_select_own_or_admin"
on public.submissions
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "submissions_insert_own_or_admin" on public.submissions;
create policy "submissions_insert_own_or_admin"
on public.submissions
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "submissions_update_own_or_admin" on public.submissions;
create policy "submissions_update_own_or_admin"
on public.submissions
for update
to authenticated
using (auth.uid() = user_id or public.is_admin_role())
with check (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "documents_select_own_admin_or_approved" on public.documents;
create policy "documents_select_own_admin_or_approved"
on public.documents
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin_role()
  or (
    lower(coalesce(status, '')) = 'approved'
    and final_file_path is not null
  )
);

drop policy if exists "documents_insert_own_or_admin" on public.documents;
create policy "documents_insert_own_or_admin"
on public.documents
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "documents_update_own_or_admin" on public.documents;
create policy "documents_update_own_or_admin"
on public.documents
for update
to authenticated
using (auth.uid() = user_id or public.is_admin_role())
with check (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "credit_transactions_select_own_or_admin" on public.credit_transactions;
create policy "credit_transactions_select_own_or_admin"
on public.credit_transactions
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "document_downloads_select_own_or_admin" on public.document_downloads;
create policy "document_downloads_select_own_or_admin"
on public.document_downloads
for select
to authenticated
using (
  auth.uid() = actor_user_id
  or auth.uid() = owner_user_id
  or public.is_admin_role()
);

drop policy if exists "document_downloads_insert_authenticated" on public.document_downloads;
create policy "document_downloads_insert_authenticated"
on public.document_downloads
for insert
to authenticated
with check (
  auth.uid() = actor_user_id
  or public.is_admin_role()
);

drop policy if exists "platform_settings_select_admin" on public.platform_settings;
create policy "platform_settings_select_admin"
on public.platform_settings
for select
to authenticated
using (public.is_admin_role());

drop policy if exists "platform_settings_insert_admin" on public.platform_settings;
create policy "platform_settings_insert_admin"
on public.platform_settings
for insert
to authenticated
with check (public.is_admin_role());

drop policy if exists "platform_settings_update_admin" on public.platform_settings;
create policy "platform_settings_update_admin"
on public.platform_settings
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());
