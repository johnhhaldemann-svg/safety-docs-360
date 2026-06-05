create or replace function public.upsert_company_invite(
  invite_email text,
  invite_role text,
  invite_team text,
  invite_company_id uuid,
  invite_account_status text
)
returns table (
  id uuid,
  email text,
  role text,
  team text,
  company_id uuid,
  account_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_company_id uuid;
  invite_row public.company_invites%rowtype;
begin
  select ur.role, ur.company_id
  into actor_role, actor_company_id
  from public.user_roles ur
  where ur.user_id = auth.uid()
  limit 1;

  if not public.is_admin_role() then
    if actor_role <> 'company_admin' then
      raise exception 'You do not have permission to manage company invites.';
    end if;

    if actor_company_id is distinct from invite_company_id then
      if not exists (
        select 1
        from public.company_memberships cm
        where cm.user_id = auth.uid()
          and cm.company_id = invite_company_id
          and cm.role = 'company_admin'
      ) then
        raise exception 'You do not have permission to invite users for this company.';
      end if;
    end if;
  end if;

  select *
  into invite_row
  from public.company_invites ci
  where lower(ci.email) = lower(invite_email)
    and ci.company_id = invite_company_id
    and ci.consumed_at is null
  order by ci.created_at desc
  limit 1;

  if invite_row.id is not null then
    update public.company_invites
    set role = invite_role,
        team = invite_team,
        account_status = invite_account_status,
        updated_at = now(),
        updated_by = auth.uid()
    where public.company_invites.id = invite_row.id
    returning * into invite_row;
  else
    insert into public.company_invites (
      email,
      role,
      team,
      company_id,
      account_status,
      created_by,
      updated_by
    )
    values (
      lower(invite_email),
      invite_role,
      invite_team,
      invite_company_id,
      invite_account_status,
      auth.uid(),
      auth.uid()
    )
    returning * into invite_row;
  end if;

  return query
  select
    invite_row.id,
    invite_row.email,
    invite_row.role,
    invite_row.team,
    invite_row.company_id,
    invite_row.account_status;
end;
$$;

revoke all on function public.upsert_company_invite(text, text, text, uuid, text) from public;
grant execute on function public.upsert_company_invite(text, text, text, uuid, text) to authenticated;
