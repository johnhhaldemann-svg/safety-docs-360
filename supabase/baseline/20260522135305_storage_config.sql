-- SafetyDocs360 Supabase storage config baseline.

-- Source project ref: mdqkfbnwxrasdmbsjcqv

-- Baseline migration: 20260522135305_gus_planning_sessions

-- Data handling: bucket configuration and storage.objects policies only; no storage objects.



insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('company-documents', 'company-documents', 'f', null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documents', 'documents', 'f', null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('finance-receipts', 'finance-receipts', 'f', null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('library', 'library', 'f', null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('profile-photos', 'profile-photos', 'f', null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('sumissions', 'sumissions', 'f', null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('userdocs', 'userdocs', 'f', null, null) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow authenticated read access to documents bucket" on storage.objects;
create policy "Allow authenticated read access to documents bucket" on storage.objects as permissive for select to authenticated using ((bucket_id = 'documents'::text));

drop policy if exists "Allow authenticated uploads to documents bucket" on storage.objects;
create policy "Allow authenticated uploads to documents bucket" on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'documents'::text));

drop policy if exists "Employees can delete company document files" on storage.objects;
create policy "Employees can delete company document files" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'company-documents'::text) AND is_company_portal_employee()));

drop policy if exists "Employees can replace company document files" on storage.objects;
create policy "Employees can replace company document files" on storage.objects as permissive for update to authenticated using (((bucket_id = 'company-documents'::text) AND is_company_portal_employee())) with check (((bucket_id = 'company-documents'::text) AND is_company_portal_employee()));

drop policy if exists "Employees can upload company document files" on storage.objects;
create policy "Employees can upload company document files" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'company-documents'::text) AND (owner = ( SELECT auth.uid() AS uid)) AND is_company_portal_employee()));

drop policy if exists "Employees can view company document files" on storage.objects;
create policy "Employees can view company document files" on storage.objects as permissive for select to authenticated using (((bucket_id = 'company-documents'::text) AND is_company_portal_employee()));

drop policy if exists "Finance users can delete receipt files" on storage.objects;
create policy "Finance users can delete receipt files" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'finance-receipts'::text) AND is_company_finance_user()));

drop policy if exists "Finance users can replace receipt files" on storage.objects;
create policy "Finance users can replace receipt files" on storage.objects as permissive for update to authenticated using (((bucket_id = 'finance-receipts'::text) AND is_company_finance_user())) with check (((bucket_id = 'finance-receipts'::text) AND is_company_finance_user()));

drop policy if exists "Finance users can upload receipt files" on storage.objects;
create policy "Finance users can upload receipt files" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'finance-receipts'::text) AND (owner = ( SELECT auth.uid() AS uid)) AND is_company_finance_user()));

drop policy if exists "Finance users can view receipt files" on storage.objects;
create policy "Finance users can view receipt files" on storage.objects as permissive for select to authenticated using (((bucket_id = 'finance-receipts'::text) AND is_company_finance_user()));

drop policy if exists "allow authenticated read" on storage.objects;
create policy "allow authenticated read" on storage.objects as permissive for select to authenticated using ((bucket_id = 'documents'::text));

drop policy if exists "allow authenticated upload" on storage.objects;
create policy "allow authenticated upload" on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'documents'::text));

drop policy if exists documents_bucket_admin_delete on storage.objects;
create policy documents_bucket_admin_delete on storage.objects as permissive for delete to authenticated using (((bucket_id = 'documents'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text])))))));

drop policy if exists documents_bucket_admin_insert on storage.objects;
create policy documents_bucket_admin_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'documents'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text])))))));

drop policy if exists documents_bucket_admin_select on storage.objects;
create policy documents_bucket_admin_select on storage.objects as permissive for select to authenticated using (((bucket_id = 'documents'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text])))))));

drop policy if exists documents_bucket_admin_update on storage.objects;
create policy documents_bucket_admin_update on storage.objects as permissive for update to authenticated using (((bucket_id = 'documents'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text]))))))) with check (((bucket_id = 'documents'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text])))))));

drop policy if exists documents_bucket_delete_company_scope on storage.objects;
create policy documents_bucket_delete_company_scope on storage.objects as permissive for delete to authenticated using (((bucket_id = 'documents'::text) AND (split_part(name, '/'::text, 1) = 'companies'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND security_can_write_company_data((split_part(name, '/'::text, 2))::uuid) AND ((split_part(name, '/'::text, 4) !~* '^[0-9a-f-]{36}$'::text) OR security_has_jobsite_access((split_part(name, '/'::text, 2))::uuid, (split_part(name, '/'::text, 4))::uuid))));

drop policy if exists documents_bucket_insert_company_scope on storage.objects;
create policy documents_bucket_insert_company_scope on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'documents'::text) AND (split_part(name, '/'::text, 1) = 'companies'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND security_can_write_company_data((split_part(name, '/'::text, 2))::uuid) AND ((split_part(name, '/'::text, 4) !~* '^[0-9a-f-]{36}$'::text) OR security_has_jobsite_access((split_part(name, '/'::text, 2))::uuid, (split_part(name, '/'::text, 4))::uuid))));

drop policy if exists documents_bucket_select_company_scope on storage.objects;
create policy documents_bucket_select_company_scope on storage.objects as permissive for select to authenticated using (((bucket_id = 'documents'::text) AND (split_part(name, '/'::text, 1) = 'companies'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND security_is_company_member((split_part(name, '/'::text, 2))::uuid) AND ((split_part(name, '/'::text, 4) !~* '^[0-9a-f-]{36}$'::text) OR security_has_jobsite_access((split_part(name, '/'::text, 2))::uuid, (split_part(name, '/'::text, 4))::uuid))));

drop policy if exists documents_bucket_update_company_scope on storage.objects;
create policy documents_bucket_update_company_scope on storage.objects as permissive for update to authenticated using (((bucket_id = 'documents'::text) AND (split_part(name, '/'::text, 1) = 'companies'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND security_can_write_company_data((split_part(name, '/'::text, 2))::uuid) AND ((split_part(name, '/'::text, 4) !~* '^[0-9a-f-]{36}$'::text) OR security_has_jobsite_access((split_part(name, '/'::text, 2))::uuid, (split_part(name, '/'::text, 4))::uuid)))) with check (((bucket_id = 'documents'::text) AND (split_part(name, '/'::text, 1) = 'companies'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND security_can_write_company_data((split_part(name, '/'::text, 2))::uuid) AND ((split_part(name, '/'::text, 4) !~* '^[0-9a-f-]{36}$'::text) OR security_has_jobsite_access((split_part(name, '/'::text, 2))::uuid, (split_part(name, '/'::text, 4))::uuid))));

drop policy if exists library_bucket_delete_admin on storage.objects;
create policy library_bucket_delete_admin on storage.objects as permissive for delete to authenticated using (((bucket_id = 'library'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text))))));

drop policy if exists library_bucket_insert_admin on storage.objects;
create policy library_bucket_insert_admin on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'library'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text))))));

drop policy if exists library_bucket_select_authenticated on storage.objects;
create policy library_bucket_select_authenticated on storage.objects as permissive for select to authenticated using ((bucket_id = 'library'::text));

drop policy if exists profile_photos_delete_own on storage.objects;
create policy profile_photos_delete_own on storage.objects as permissive for delete to authenticated using (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

drop policy if exists profile_photos_insert_own on storage.objects;
create policy profile_photos_insert_own on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

drop policy if exists profile_photos_select_own on storage.objects;
create policy profile_photos_select_own on storage.objects as permissive for select to authenticated using (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

drop policy if exists profile_photos_update_own on storage.objects;
create policy profile_photos_update_own on storage.objects as permissive for update to authenticated using (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

