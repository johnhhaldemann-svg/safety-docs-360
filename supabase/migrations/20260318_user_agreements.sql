create table if not exists public.user_agreements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accepted_terms boolean not null default true,
  accepted_at timestamptz not null default timezone('utc'::text, now()),
  ip_address text,
  terms_version text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.user_agreements enable row level security;

create policy if not exists "Users can read own agreement acceptance"
  on public.user_agreements
  for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert own agreement acceptance"
  on public.user_agreements
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update own agreement acceptance"
  on public.user_agreements
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
