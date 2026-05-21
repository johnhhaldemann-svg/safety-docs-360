-- Columns expected by GC-required program upload, document submit, admin approval, and library flows.
-- The normalized safety_ops documents table omitted several legacy fields; PostgREST rejects inserts
-- that reference missing columns (e.g. "Could not find the 'category' column of 'documents'").

alter table public.documents add column if not exists title text null;
alter table public.documents add column if not exists document_type text null;
alter table public.documents add column if not exists status text null;
alter table public.documents add column if not exists user_id uuid null;
alter table public.documents add column if not exists project_name text null;
alter table public.documents add column if not exists document_title text null;
alter table public.documents add column if not exists category text null;
alter table public.documents add column if not exists notes text null;
alter table public.documents add column if not exists file_name text null;
alter table public.documents add column if not exists file_path text null;
alter table public.documents add column if not exists file_size bigint null;
alter table public.documents add column if not exists uploaded_by text null;
alter table public.documents add column if not exists draft_file_path text null;
alter table public.documents add column if not exists final_file_path text null;
alter table public.documents add column if not exists reviewer_email text null;
alter table public.documents add column if not exists review_notes text null;
alter table public.documents add column if not exists approved_at timestamptz null;
alter table public.documents add column if not exists approved_by uuid null;
alter table public.documents add column if not exists approved_by_email text null;

-- Submission / review statuses (not only draft|active|archived).
alter table public.documents drop constraint if exists documents_status_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'title'
      and is_nullable = 'NO'
  ) then
    alter table public.documents alter column title drop not null;
  end if;
end $$;
