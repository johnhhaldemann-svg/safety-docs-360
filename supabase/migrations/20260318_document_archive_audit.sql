alter table public.documents
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archived_by_email text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid,
  add column if not exists restored_by_email text;
