alter table public.company_safety_submissions
add column if not exists created_by uuid null references auth.users(id) on delete set null,
add column if not exists last_modified timestamptz not null default now(),
add column if not exists version integer not null default 1,
add column if not exists hash text null;

update public.company_safety_submissions
set
  created_by = coalesce(created_by, submitted_by),
  last_modified = coalesce(last_modified, updated_at, created_at, now()),
  version = case when version is null or version < 1 then 1 else version end
where
  created_by is null
  or last_modified is null
  or version is null
  or version < 1;

create index if not exists company_safety_submissions_last_modified_idx
  on public.company_safety_submissions(company_id, last_modified desc);
