alter table public.documents
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists approved_by_email text,
  add column if not exists marketplace_updated_at timestamptz,
  add column if not exists marketplace_updated_by uuid,
  add column if not exists marketplace_updated_by_email text;
