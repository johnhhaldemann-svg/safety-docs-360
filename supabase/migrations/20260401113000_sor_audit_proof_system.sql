create table if not exists public.company_sor_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  date date not null,
  project text not null,
  location text not null,
  trade text not null,
  category text not null,
  subcategory text null,
  description text not null,
  severity text not null default 'medium',
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  status text not null default 'draft',
  version_number integer not null default 1,
  previous_version_id uuid null references public.company_sor_records(id) on delete set null,
  record_hash text null,
  previous_hash text null,
  change_reason text null,
  is_deleted boolean not null default false,
  constraint company_sor_records_status_check check (status in ('draft', 'submitted', 'locked', 'superseded')),
  constraint company_sor_records_version_positive check (version_number >= 1)
);

create index if not exists company_sor_records_company_created_idx
  on public.company_sor_records(company_id, created_at desc);
create index if not exists company_sor_records_company_status_idx
  on public.company_sor_records(company_id, status, updated_at desc);
create index if not exists company_sor_records_previous_version_idx
  on public.company_sor_records(previous_version_id);

create table if not exists public.sor_audit_log (
  id uuid primary key default gen_random_uuid(),
  sor_id uuid not null references public.company_sor_records(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  action_type text not null,
  user_id uuid null references auth.users(id) on delete set null,
  timestamp timestamptz not null default now(),
  old_data jsonb null,
  new_data jsonb null,
  notes text null,
  constraint sor_audit_log_action_check check (
    action_type in ('create', 'submit', 'edit', 'supersede', 'soft_delete', 'restore', 'lock')
  )
);

create index if not exists sor_audit_log_sor_timestamp_idx
  on public.sor_audit_log(sor_id, timestamp desc);
create index if not exists sor_audit_log_company_timestamp_idx
  on public.sor_audit_log(company_id, timestamp desc);

create or replace function public.sor_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sor_prevent_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Hard delete is not allowed for SOR records. Use soft delete (is_deleted=true).';
end;
$$;

create or replace function public.sor_guard_locked_rows()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('submitted', 'locked', 'superseded') then
    if old.status = 'submitted'
       and new.status = 'superseded'
       and new.version_number = old.version_number
       and new.previous_version_id is not distinct from old.previous_version_id
       and new.record_hash is not distinct from old.record_hash
       and new.previous_hash is not distinct from old.previous_hash
       and new.change_reason is not distinct from old.change_reason
       and new.date is not distinct from old.date
       and new.project is not distinct from old.project
       and new.location is not distinct from old.location
       and new.trade is not distinct from old.trade
       and new.category is not distinct from old.category
       and new.subcategory is not distinct from old.subcategory
       and new.description is not distinct from old.description
       and new.severity is not distinct from old.severity
       and new.created_by is not distinct from old.created_by
       and new.created_at is not distinct from old.created_at
       and new.is_deleted = old.is_deleted
    then
      return new;
    end if;

    raise exception 'Submitted/locked/superseded SOR rows are immutable.';
  end if;

  return new;
end;
$$;

create or replace function public.sor_audit_log_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action text;
  actor uuid;
begin
  actor := coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by);

  if tg_op = 'INSERT' then
    action := 'create';
    insert into public.sor_audit_log (sor_id, company_id, action_type, user_id, old_data, new_data, notes)
    values (new.id, new.company_id, action, actor, null, to_jsonb(new), null);
    return new;
  end if;

  if old.is_deleted = false and new.is_deleted = true then
    action := 'soft_delete';
  elsif old.is_deleted = true and new.is_deleted = false then
    action := 'restore';
  elsif old.status is distinct from new.status and new.status = 'submitted' then
    action := 'submit';
  elsif old.status is distinct from new.status and new.status = 'locked' then
    action := 'lock';
  elsif old.status is distinct from new.status and new.status = 'superseded' then
    action := 'supersede';
  else
    action := 'edit';
  end if;

  insert into public.sor_audit_log (sor_id, company_id, action_type, user_id, old_data, new_data, notes)
  values (new.id, new.company_id, action, actor, to_jsonb(old), to_jsonb(new), new.change_reason);
  return new;
end;
$$;

drop trigger if exists trg_sor_set_updated_at on public.company_sor_records;
create trigger trg_sor_set_updated_at
before update on public.company_sor_records
for each row execute function public.sor_set_updated_at();

drop trigger if exists trg_sor_guard_locked_rows on public.company_sor_records;
create trigger trg_sor_guard_locked_rows
before update on public.company_sor_records
for each row execute function public.sor_guard_locked_rows();

drop trigger if exists trg_sor_prevent_hard_delete on public.company_sor_records;
create trigger trg_sor_prevent_hard_delete
before delete on public.company_sor_records
for each row execute function public.sor_prevent_hard_delete();

drop trigger if exists trg_sor_audit_log_write_insert on public.company_sor_records;
create trigger trg_sor_audit_log_write_insert
after insert on public.company_sor_records
for each row execute function public.sor_audit_log_write();

drop trigger if exists trg_sor_audit_log_write_update on public.company_sor_records;
create trigger trg_sor_audit_log_write_update
after update on public.company_sor_records
for each row execute function public.sor_audit_log_write();

alter table public.company_sor_records enable row level security;
alter table public.sor_audit_log enable row level security;

grant select, insert, update on public.company_sor_records to authenticated;
grant select on public.sor_audit_log to authenticated;

drop policy if exists "sor_select_company_scope" on public.company_sor_records;
create policy "sor_select_company_scope"
on public.company_sor_records
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_sor_records.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_sor_records.company_id
      and actor.account_status = 'active'
  )
);

drop policy if exists "sor_insert_company_scope" on public.company_sor_records;
create policy "sor_insert_company_scope"
on public.company_sor_records
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_admin_role()
    or exists (
      select 1 from public.company_memberships actor
      where actor.user_id = auth.uid()
        and actor.company_id = public.company_sor_records.company_id
    )
    or exists (
      select 1 from public.user_roles actor
      where actor.user_id = auth.uid()
        and actor.company_id = public.company_sor_records.company_id
        and actor.account_status = 'active'
    )
  )
);

drop policy if exists "sor_update_own_draft_only" on public.company_sor_records;
create policy "sor_update_own_draft_only"
on public.company_sor_records
for update
to authenticated
using (
  created_by = auth.uid()
  and status = 'draft'
)
with check (
  created_by = auth.uid()
  and status = 'draft'
);

drop policy if exists "sor_admin_supersede_locked" on public.company_sor_records;
create policy "sor_admin_supersede_locked"
on public.company_sor_records
for update
to authenticated
using (
  status in ('submitted', 'locked')
  and (
    public.is_admin_role()
    or exists (
      select 1 from public.user_roles actor
      where actor.user_id = auth.uid()
        and actor.company_id = public.company_sor_records.company_id
        and actor.role in ('company_admin', 'manager', 'admin', 'super_admin', 'platform_admin')
        and actor.account_status = 'active'
    )
  )
)
with check (
  status in ('submitted', 'locked', 'superseded')
);

drop policy if exists "sor_audit_log_select_company_scope" on public.sor_audit_log;
create policy "sor_audit_log_select_company_scope"
on public.sor_audit_log
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.sor_audit_log.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.sor_audit_log.company_id
      and actor.account_status = 'active'
  )
);
