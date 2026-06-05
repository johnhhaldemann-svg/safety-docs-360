alter table public.company_signup_requests
add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create index if not exists company_signup_requests_owner_user_id_idx
  on public.company_signup_requests (owner_user_id);
