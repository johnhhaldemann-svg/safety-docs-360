-- Supabase advisor: RLS enabled on library taxonomy tables but no policies (blocked all access).
-- Read-only catalog for authenticated users.

drop policy if exists library_categories_select_authenticated on public.library_categories;
create policy library_categories_select_authenticated
  on public.library_categories
  for select
  to authenticated
  using (true);

drop policy if exists library_tags_select_authenticated on public.library_tags;
create policy library_tags_select_authenticated
  on public.library_tags
  for select
  to authenticated
  using (true);

drop policy if exists library_document_tags_select_authenticated on public.library_document_tags;
create policy library_document_tags_select_authenticated
  on public.library_document_tags
  for select
  to authenticated
  using (true);
