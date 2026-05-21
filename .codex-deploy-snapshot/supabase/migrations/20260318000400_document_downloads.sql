create table if not exists public.document_downloads (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  file_kind text not null,
  downloaded_at timestamptz not null default timezone('utc'::text, now()),
  ip_address text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.document_downloads enable row level security;
