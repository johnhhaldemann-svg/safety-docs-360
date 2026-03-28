-- PESHEP/CSEP/API submit inserts use the authenticated user's Supabase client.
-- documents_scope (company-only) blocked inserts when company_id was null or when
-- core_security_rls policies were missing — error: "new row violates row-level security policy for table documents".
-- Extend documents_scope: owners may read/write their own rows; null company_id allowed for own user_id;
-- keep company-scoped access and public approved reads aligned with documents_select_own_admin_or_approved.

drop policy if exists "documents_scope" on public.documents;

create policy "documents_scope"
on public.documents
for all
to authenticated
using (
  public.is_admin_role()
  or auth.uid() = user_id
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.documents.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.documents.company_id
      and actor.account_status = 'active'
  )
  or (
    lower(coalesce(public.documents.status, '')) = 'approved'
    and public.documents.final_file_path is not null
  )
)
with check (
  public.is_admin_role()
  or (
    auth.uid() = user_id
    and (
      company_id is null
      or exists (
        select 1
        from public.company_memberships actor
        where actor.user_id = auth.uid()
          and actor.company_id = public.documents.company_id
      )
      or exists (
        select 1
        from public.user_roles actor
        where actor.user_id = auth.uid()
          and actor.company_id = public.documents.company_id
          and actor.account_status = 'active'
      )
    )
  )
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.documents.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.documents.company_id
      and actor.account_status = 'active'
  )
);
