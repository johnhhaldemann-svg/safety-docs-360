create table if not exists public.user_onboarding_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_steps text[] not null default array[]::text[],
  dismissed_at timestamptz,
  last_seen_command_center_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_onboarding_state_updated_at on public.user_onboarding_state;
create trigger set_user_onboarding_state_updated_at
before update on public.user_onboarding_state
for each row
execute function public.set_updated_at();

alter table public.user_onboarding_state enable row level security;

grant select, insert, update, delete on public.user_onboarding_state to authenticated;

drop policy if exists "user_onboarding_state_select_self" on public.user_onboarding_state;
create policy "user_onboarding_state_select_self"
on public.user_onboarding_state
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists "user_onboarding_state_insert_self" on public.user_onboarding_state;
create policy "user_onboarding_state_insert_self"
on public.user_onboarding_state
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists "user_onboarding_state_update_self" on public.user_onboarding_state;
create policy "user_onboarding_state_update_self"
on public.user_onboarding_state
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists "user_onboarding_state_delete_self" on public.user_onboarding_state;
create policy "user_onboarding_state_delete_self"
on public.user_onboarding_state
for delete
to authenticated
using (
  auth.uid() = user_id
);
