-- SafetyDocs360 Supabase schema baseline.
-- Source project ref: mdqkfbnwxrasdmbsjcqv
-- Baseline migration: 20260522135305_gus_planning_sessions
-- Data handling: schema-only dump for public/private schemas; no production rows.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prevent_non_owner_compensation_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
begin
  if public.is_company_portal_owner() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.salary_min is not null or new.salary_max is not null then
      raise exception 'Only owners can set position compensation.';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.salary_min is distinct from old.salary_min
      or new.salary_max is distinct from old.salary_max
      or new.salary_period is distinct from old.salary_period then
      raise exception 'Only owners can change position compensation.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."prevent_non_owner_compensation_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."protect_employee_profile_time_card_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
begin
  if (select auth.uid()) is null or public.is_company_portal_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.time_card_role_id is not null then
    raise exception 'Only admins can assign a time-card role.';
  end if;
  if tg_op = 'UPDATE' and (new.time_card_role_id is distinct from old.time_card_role_id or new.profile_status is distinct from old.profile_status) then
    raise exception 'Only admins can update time-card role fields.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."protect_employee_profile_time_card_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."refresh_time_card_payroll"("target_card_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
declare
  card_row public.employee_time_cards%rowtype;
  rate numeric(10,2);
  total numeric(10,2);
begin
  select * into card_row from public.employee_time_cards where id = target_card_id;
  if not found then return; end if;
  select coalesce(sum(hours), 0)::numeric(10,2) into total from public.employee_time_entries where time_card_id = target_card_id;
  select coalesce((select hourly_rate from public.employee_time_card_payroll where time_card_id = target_card_id), (select hourly_rate from public.employee_pay_rates where user_id = card_row.employee_user_id), 75) into rate;
  insert into public.employee_time_card_payroll (time_card_id, hourly_rate, total_hours, paid_value)
  values (target_card_id, rate, total, (rate * total)::numeric(12,2))
  on conflict (time_card_id) do update set total_hours = excluded.total_hours, paid_value = (public.employee_time_card_payroll.hourly_rate * excluded.total_hours)::numeric(12,2), updated_at = now();
end;
$$;


ALTER FUNCTION "private"."refresh_time_card_payroll"("target_card_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."refresh_time_card_payroll_from_card"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
begin
  perform private.refresh_time_card_payroll(new.id);
  return new;
end;
$$;


ALTER FUNCTION "private"."refresh_time_card_payroll_from_card"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."refresh_time_card_payroll_from_entry"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
begin
  perform private.refresh_time_card_payroll(coalesce(new.time_card_id, old.time_card_id));
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "private"."refresh_time_card_payroll_from_entry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_time_card_review_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
begin
  if new.status = 'submitted' and coalesce(old.status, '') <> 'submitted' then
    new.submitted_at = coalesce(new.submitted_at, now());
  end if;
  if new.status in ('approved', 'rejected') and coalesce(old.status, '') <> new.status then
    new.reviewed_at = coalesce(new.reviewed_at, now());
    new.reviewed_by = coalesce(new.reviewed_by, (select auth.uid()));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."sync_time_card_review_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validate_time_card_entry"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'private'
    AS $$
declare
  card_row public.employee_time_cards%rowtype;
begin
  select * into card_row from public.employee_time_cards where id = new.time_card_id;
  if not found then raise exception 'Time card was not found.'; end if;
  if new.work_date < card_row.week_start or new.work_date > card_row.week_end then raise exception 'Entry date must fall inside the time card week.'; end if;
  if not exists (select 1 from public.time_card_tasks task where task.id = new.task_id and task.category_id = new.category_id) then raise exception 'Task does not belong to the selected category.'; end if;
  if (select auth.uid()) is null or public.is_company_portal_admin() then return new; end if;
  if card_row.employee_user_id is distinct from (select auth.uid()) then raise exception 'Employees can only enter time on their own time cards.'; end if;
  if not exists (
    select 1
    from public.employee_profiles profile
    join public.time_card_role_categories role_category on role_category.role_id = profile.time_card_role_id and role_category.category_id = new.category_id
    join public.time_card_role_tasks role_task on role_task.role_id = profile.time_card_role_id and role_task.task_id = new.task_id
    where profile.user_id = card_row.employee_user_id and profile.profile_status = 'active'
  ) then raise exception 'This task is not available for the employee time-card role.'; end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."validate_time_card_entry"() OWNER TO "postgres";








SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."si_ai_review_status" AS ENUM (
    'draft',
    'reviewed',
    'approved',
    'rejected'
);


ALTER TYPE "public"."si_ai_review_status" OWNER TO "postgres";


CREATE TYPE "public"."si_ai_review_type" AS ENUM (
    'document_generation',
    'risk_intelligence',
    'combined'
);


ALTER TYPE "public"."si_ai_review_type" OWNER TO "postgres";


CREATE TYPE "public"."si_bucket_run_status" AS ENUM (
    'pending',
    'bucketed',
    'rules_complete',
    'conflicts_complete',
    'ai_reviewed',
    'failed'
);


ALTER TYPE "public"."si_bucket_run_status" OWNER TO "postgres";


CREATE TYPE "public"."si_conflict_severity" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."si_conflict_severity" OWNER TO "postgres";


CREATE TYPE "public"."si_conflict_status" AS ENUM (
    'open',
    'accepted',
    'mitigated',
    'dismissed'
);


ALTER TYPE "public"."si_conflict_status" OWNER TO "postgres";


CREATE TYPE "public"."si_control_status" AS ENUM (
    'required',
    'recommended',
    'verified',
    'missing'
);


ALTER TYPE "public"."si_control_status" OWNER TO "postgres";


CREATE TYPE "public"."si_document_status" AS ENUM (
    'draft',
    'in_review',
    'approved',
    'published',
    'archived'
);


ALTER TYPE "public"."si_document_status" OWNER TO "postgres";


CREATE TYPE "public"."si_document_type" AS ENUM (
    'jsa',
    'csep',
    'peshep',
    'pshsep',
    'permit',
    'sop',
    'work_plan',
    'safety_narrative'
);


ALTER TYPE "public"."si_document_type" OWNER TO "postgres";


CREATE TYPE "public"."si_ingestion_insert_status" AS ENUM (
    'pending',
    'inserted',
    'skipped',
    'failed'
);


ALTER TYPE "public"."si_ingestion_insert_status" OWNER TO "postgres";


CREATE TYPE "public"."si_ingestion_source_type" AS ENUM (
    'sor',
    'jsa',
    'incident_report',
    'corrective_action',
    'permit',
    'observation',
    'other'
);


ALTER TYPE "public"."si_ingestion_source_type" OWNER TO "postgres";


CREATE TYPE "public"."si_ingestion_validation_status" AS ENUM (
    'accepted',
    'rejected'
);


ALTER TYPE "public"."si_ingestion_validation_status" OWNER TO "postgres";


CREATE TYPE "public"."si_risk_band" AS ENUM (
    'low',
    'moderate',
    'high',
    'critical'
);


ALTER TYPE "public"."si_risk_band" OWNER TO "postgres";


CREATE TYPE "public"."si_score_scope" AS ENUM (
    'company',
    'jobsite',
    'trade',
    'task',
    'work_area',
    'bucket_item'
);


ALTER TYPE "public"."si_score_scope" OWNER TO "postgres";


CREATE TYPE "public"."si_task_status" AS ENUM (
    'planned',
    'active',
    'completed',
    'cancelled',
    'archived'
);


ALTER TYPE "public"."si_task_status" OWNER TO "postgres";


CREATE TYPE "public"."si_weather_sensitivity" AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE "public"."si_weather_sensitivity" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_company_users"("target_company_id" "uuid") RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text", "team" "text", "status" "text", "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "email_confirmed_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select
    au.id,
    au.email::text,
    coalesce(
      nullif(au.raw_user_meta_data ->> 'full_name', ''),
      nullif(au.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(au.email, ''), '@', 1)
    )::text as name,
    coalesce(cm.role, ur.role, 'company_user')::text as role,
    coalesce(nullif(ur.team, ''), nullif(c.name, ''), 'General')::text as team,
    case
      when coalesce(cm.status, ur.account_status, 'active') = 'suspended' then 'Suspended'
      when coalesce(cm.status, ur.account_status, 'active') = 'pending' then 'Pending'
      when au.email_confirmed_at is null then 'Pending'
      when au.last_sign_in_at is null then 'Active'
      when au.last_sign_in_at < now() - interval '30 days' then 'Inactive'
      else 'Active'
    end::text as status,
    au.created_at,
    au.last_sign_in_at,
    au.email_confirmed_at
  from public.company_memberships cm
  join auth.users au
    on au.id = cm.user_id
  left join public.user_roles ur
    on ur.user_id = cm.user_id
  left join public.companies c
    on c.id = cm.company_id
  where cm.company_id = target_company_id
    and public.is_admin_role();
$$;


ALTER FUNCTION "public"."admin_list_company_users"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_workspace_users"() RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text", "team" "text", "status" "text", "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "email_confirmed_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select
    au.id,
    au.email::text,
    coalesce(
      nullif(au.raw_user_meta_data ->> 'full_name', ''),
      nullif(au.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(au.email, ''), '@', 1)
    )::text as name,
    ur.role::text,
    coalesce(nullif(ur.team, ''), 'General')::text as team,
    case
      when coalesce(ur.account_status, 'active') = 'suspended' then 'Suspended'
      when au.email_confirmed_at is null then 'Pending'
      when au.last_sign_in_at is null then 'Active'
      when au.last_sign_in_at < now() - interval '30 days' then 'Inactive'
      else 'Active'
    end::text as status,
    au.created_at,
    au.last_sign_in_at,
    au.email_confirmed_at
  from auth.users au
  left join public.user_roles ur
    on ur.user_id = au.id
  where public.is_admin_role();
$$;


ALTER FUNCTION "public"."admin_list_workspace_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  y int := (extract(year from (timezone('utc', now()))::date))::int;
  seq int;
begin
  insert into public.billing_invoice_counters as c (year, last_seq)
  values (y, 1)
  on conflict (year) do update
    set last_seq = c.last_seq + 1
  returning last_seq into seq;

  return format('INV-%s-%s', y, lpad(seq::text, 6, '0'));
end;
$$;


ALTER FUNCTION "public"."billing_generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_is_super_platform"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(ur.role, '') in ('super_admin', 'platform_admin')
    and coalesce(ur.account_status, 'active') = 'active'
  from public.user_roles ur
  where ur.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."billing_is_super_platform"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_staff_can_mutate_company"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.billing_is_super_platform()
    or (
      coalesce((select role from public.user_roles ur where ur.user_id = auth.uid()), '') = 'admin'
      and exists (
        select 1
        from public.billing_staff_company_assignments a
        where a.staff_user_id = auth.uid()
          and a.company_id = target_company_id
      )
    );
$$;


ALTER FUNCTION "public"."billing_staff_can_mutate_company"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."billing_user_can_access_company"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    public.billing_is_super_platform()
    or (
      coalesce((select ur.role from public.user_roles ur where ur.user_id = auth.uid()), '') = 'admin'
      and coalesce(
        (select ur.account_status from public.user_roles ur where ur.user_id = auth.uid()),
        'active'
      ) = 'active'
      and exists (
        select 1
        from public.billing_staff_company_assignments a
        where a.staff_user_id = auth.uid()
          and a.company_id = target_company_id
      )
    )
    or (
      coalesce(
        (select ur.account_status from public.user_roles ur where ur.user_id = auth.uid()),
        'active'
      ) = 'active'
      and (select ur.company_id from public.user_roles ur where ur.user_id = auth.uid()) = target_company_id
    )
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
        and coalesce(cm.status, 'active') = 'active'
    );
$$;


ALTER FUNCTION "public"."billing_user_can_access_company"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_approved_company_owner"("approved_email" "text", "approved_user_id" "uuid") RETURNS TABLE("company_id" "uuid", "company_name" "text", "linked_role" "text", "account_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  normalized_email text := lower(trim(coalesce(approved_email, '')));
  matched_company public.companies%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if approved_user_id is null or approved_user_id <> auth.uid() then
    raise exception 'User not allowed';
  end if;

  if normalized_email = '' then
    return;
  end if;

  select c.*
  into matched_company
  from public.companies c
  where lower(coalesce(c.primary_contact_email, '')) = normalized_email
    and lower(coalesce(c.status, 'active')) = 'active'
  order by c.created_at desc nulls last
  limit 1;

  if matched_company.id is null then
    return;
  end if;

  insert into public.user_roles (
    user_id,
    role,
    team,
    company_id,
    account_status,
    created_by,
    updated_by
  )
  values (
    approved_user_id,
    'company_admin',
    matched_company.name,
    matched_company.id,
    'active',
    approved_user_id,
    approved_user_id
  )
  on conflict (user_id) do update set
    role = 'company_admin',
    team = excluded.team,
    company_id = excluded.company_id,
    account_status = 'active',
    updated_by = approved_user_id,
    updated_at = now();

  insert into public.company_memberships (
    user_id,
    company_id,
    role,
    status,
    created_by,
    updated_by
  )
  values (
    approved_user_id,
    matched_company.id,
    'company_admin',
    'active',
    approved_user_id,
    approved_user_id
  )
  on conflict on constraint company_memberships_user_company_unique do update set
    role = 'company_admin',
    status = 'active',
    updated_by = approved_user_id,
    updated_at = now();

  update public.company_invites
  set
    consumed_at = coalesce(consumed_at, now()),
    consumed_by = approved_user_id,
    updated_at = now(),
    updated_by = approved_user_id
  where lower(coalesce(email, '')) = normalized_email
    and consumed_at is null;

  return query
  select
    matched_company.id,
    matched_company.name,
    'company_admin'::text,
    'active'::text;
end;
$$;


ALTER FUNCTION "public"."claim_approved_company_owner"("approved_email" "text", "approved_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_company_invite"("invite_email" "text", "invited_user_id" "uuid") RETURNS TABLE("id" "uuid", "email" "text", "role" "text", "team" "text", "company_id" "uuid", "account_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  invite_row public.company_invites%rowtype;
begin
  select *
  into invite_row
  from public.company_invites ci
  where lower(ci.email) = lower(invite_email)
    and ci.consumed_at is null
  order by ci.created_at desc
  limit 1;

  if invite_row.id is null then
    return;
  end if;

  update public.company_invites
  set consumed_at = now(),
      consumed_by = invited_user_id,
      updated_at = now(),
      updated_by = invited_user_id
  where public.company_invites.id = invite_row.id;

  insert into public.user_roles (
    user_id,
    role,
    team,
    company_id,
    account_status,
    created_by,
    updated_by
  )
  values (
    invited_user_id,
    invite_row.role,
    invite_row.team,
    invite_row.company_id,
    invite_row.account_status,
    coalesce(invite_row.created_by, invited_user_id),
    invited_user_id
  )
  on conflict (user_id) do update set
    role = excluded.role,
    team = excluded.team,
    company_id = excluded.company_id,
    account_status = excluded.account_status,
    updated_by = invited_user_id,
    updated_at = now();

  insert into public.company_memberships (
    user_id,
    company_id,
    role,
    status,
    created_by,
    updated_by
  )
  values (
    invited_user_id,
    invite_row.company_id,
    invite_row.role,
    case
      when invite_row.account_status = 'pending' then 'pending'
      when invite_row.account_status = 'suspended' then 'suspended'
      else 'active'
    end,
    coalesce(invite_row.created_by, invited_user_id),
    invited_user_id
  )
  on conflict on constraint company_memberships_user_company_unique do update set
    role = excluded.role,
    status = excluded.status,
    updated_by = invited_user_id,
    updated_at = now();

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


ALTER FUNCTION "public"."consume_company_invite"("invite_email" "text", "invited_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_company_workspace"("p_company_name" "text", "p_industry" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_website" "text" DEFAULT NULL::"text", "p_address_line_1" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_state_region" "text" DEFAULT NULL::"text", "p_postal_code" "text" DEFAULT NULL::"text", "p_country" "text" DEFAULT NULL::"text", "p_plan_name" "text" DEFAULT 'Pro'::"text") RETURNS TABLE("company_id" "uuid", "company_name" "text", "team_key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
declare
  actor_id uuid := auth.uid();
  actor_email text := '';
  actor_name text := '';
  existing_company_id uuid := null;
  base_key text := '';
  generated_team_key text := '';
  created_company public.companies%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if public.is_admin_role() then
    raise exception 'Internal admin accounts do not create customer companies from this setup flow.';
  end if;

  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required.';
  end if;

  select ur.company_id
  into existing_company_id
  from public.user_roles ur
  where ur.user_id = actor_id
  limit 1;

  if existing_company_id is not null then
    raise exception 'This account is already linked to a company workspace.';
  end if;

  select
    coalesce(au.email, ''),
    coalesce(
      nullif(au.raw_user_meta_data ->> 'full_name', ''),
      nullif(au.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(au.email, ''), '@', 1),
      'Company Admin'
    )
  into actor_email, actor_name
  from auth.users au
  where au.id = actor_id;

  base_key := regexp_replace(lower(trim(p_company_name)), '[^a-z0-9]+', '-', 'g');
  base_key := regexp_replace(base_key, '(^-+|-+$)', '', 'g');
  base_key := left(coalesce(nullif(base_key, ''), 'company'), 42);

  loop
    generated_team_key := base_key || '-' || substr(md5(clock_timestamp()::text || random()::text), 1, 8);
    exit when not exists (
      select 1
      from public.companies c
      where c.team_key = generated_team_key
    );
  end loop;

  insert into public.companies (
    name,
    team_key,
    status,
    industry,
    phone,
    website,
    address_line_1,
    city,
    state_region,
    postal_code,
    country,
    primary_contact_name,
    primary_contact_email,
    created_by,
    updated_by
  )
  values (
    trim(p_company_name),
    generated_team_key,
    'active',
    nullif(trim(coalesce(p_industry, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_address_line_1, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state_region, '')), ''),
    nullif(trim(coalesce(p_postal_code, '')), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    actor_name,
    nullif(actor_email, ''),
    actor_id,
    actor_id
  )
  returning *
  into created_company;

  insert into public.user_roles (
    user_id,
    role,
    team,
    company_id,
    account_status,
    created_by,
    updated_by
  )
  values (
    actor_id,
    'company_admin',
    created_company.name,
    created_company.id,
    'active',
    actor_id,
    actor_id
  )
  on conflict (user_id) do update set
    role = excluded.role,
    team = excluded.team,
    company_id = excluded.company_id,
    account_status = excluded.account_status,
    updated_by = actor_id,
    updated_at = now();

  insert into public.company_memberships (
    user_id,
    company_id,
    role,
    status,
    created_by,
    updated_by
  )
  values (
    actor_id,
    created_company.id,
    'company_admin',
    'active',
    actor_id,
    actor_id
  )
  on conflict on constraint company_memberships_user_company_unique do update set
    role = excluded.role,
    status = excluded.status,
    updated_by = actor_id,
    updated_at = now();

  insert into public.company_subscriptions (
    company_id,
    status,
    plan_name,
    created_by,
    updated_by
  )
  values (
    created_company.id,
    'active',
    nullif(trim(coalesce(p_plan_name, 'Pro')), ''),
    actor_id,
    actor_id
  )
  on conflict on constraint company_subscriptions_company_id_key do update set
    status = excluded.status,
    plan_name = excluded.plan_name,
    updated_by = actor_id,
    updated_at = now();

  return query
  select
    created_company.id,
    created_company.name,
    created_company.team_key;
end;
$_$;


ALTER FUNCTION "public"."create_company_workspace"("p_company_name" "text", "p_industry" "text", "p_phone" "text", "p_website" "text", "p_address_line_1" "text", "p_city" "text", "p_state_region" "text", "p_postal_code" "text", "p_country" "text", "p_plan_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_app_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'viewer'
  );
$$;


ALTER FUNCTION "public"."current_app_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_role"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_app_role() in ('super_admin', 'admin');
$$;


ALTER FUNCTION "public"."is_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_finance_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.company_finance_authorized_users finance_user
    join public.user_roles role
      on role.user_id = finance_user.user_id
    where finance_user.user_id = (select auth.uid())
      and role.account_status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_company_finance_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_portal_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and account_status = 'active'
      and role in (
        'platform_admin',
        'super_admin',
        'admin',
        'company_admin'
      )
  );
$$;


ALTER FUNCTION "public"."is_company_portal_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_portal_employee"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and account_status = 'active'
      and role in (
        'platform_admin',
        'super_admin',
        'admin',
        'company_admin',
        'employee',
        'internal_reviewer',
        'marketing'
      )
  );
$$;


ALTER FUNCTION "public"."is_company_portal_employee"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_portal_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and account_status = 'active'
      and role in ('platform_admin', 'super_admin')
  );
$$;


ALTER FUNCTION "public"."is_company_portal_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lookup_company_invite"("invite_email" "text") RETURNS TABLE("id" "uuid", "email" "text", "role" "text", "team" "text", "company_id" "uuid", "account_status" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    ci.id,
    ci.email,
    ci.role,
    ci.team,
    ci.company_id,
    ci.account_status
  from public.company_invites ci
  where lower(ci.email) = lower(invite_email)
    and ci.consumed_at is null
  order by ci.created_at desc
  limit 1;
$$;


ALTER FUNCTION "public"."lookup_company_invite"("invite_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lookup_my_company_signup_request"() RETURNS TABLE("id" "uuid", "company_name" "text", "primary_contact_email" "text", "owner_user_id" "uuid", "status" "text", "account_status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    csr.id,
    csr.company_name,
    csr.primary_contact_email,
    csr.owner_user_id,
    csr.status,
    csr.account_status,
    csr.created_at
  from public.company_signup_requests csr
  where (
    csr.owner_user_id = auth.uid()
    or lower(coalesce(csr.primary_contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
    and lower(coalesce(csr.status, '')) = 'pending'
  order by csr.created_at desc nulls last
  limit 1;
$$;


ALTER FUNCTION "public"."lookup_my_company_signup_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_company_memory_items"("p_company_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer DEFAULT 8) RETURNS TABLE("id" "uuid", "company_id" "uuid", "source" "text", "title" "text", "body" "text", "metadata" "jsonb", "created_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    c.id,
    c.company_id,
    c.source,
    c.title,
    c.body,
    c.metadata,
    c.created_by,
    c.created_at,
    c.updated_at,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.company_memory_items c
  where c.company_id = p_company_id
    and c.embedding is not null
    and public.security_is_company_member (p_company_id)
  order by c.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 8), 32);
$$;


ALTER FUNCTION "public"."match_company_memory_items"("p_company_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_legacy_rbac_role"("raw_role" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'superadmin' then 'super_admin'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'platformadmin' then 'platform_admin'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'internal_reviewer_employee' then 'internal_reviewer'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'operations_manager' then 'manager'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in ('safety_director', 'safety_director_safety_manager') then 'safety_manager'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in ('superintendent', 'superintendent_project_manager') then 'project_manager'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in ('field_user_observer', 'observer') then 'field_user'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) = 'read_only_client' then 'read_only'
    when lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g')) in (
      'platform_admin',
      'sales_demo',
      'internal_reviewer',
      'employee',
      'super_admin',
      'admin',
      'manager',
      'company_admin',
      'safety_manager',
      'project_manager',
      'field_supervisor',
      'foreman',
      'field_user',
      'read_only',
      'company_user',
      'editor',
      'viewer'
    ) then lower(regexp_replace(trim(coalesce(raw_role, '')), '\s+', '_', 'g'))
    else 'viewer'
  end;
$$;


ALTER FUNCTION "public"."normalize_legacy_rbac_role"("raw_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."platform_performance_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $_$
declare
  slow_queries jsonb := '[]'::jsonb;
  top_tables jsonb := '[]'::jsonb;
  duplicate_policy_count integer := 0;
  missing_fk_index_count integer := 0;
  rls_enabled_no_policy_count integer := 0;
begin
  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  into top_tables
  from (
    select
      relname as table_name,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      seq_scan,
      idx_scan,
      pg_total_relation_size(relid) as total_bytes
    from pg_stat_user_tables
    where schemaname = 'public'
    order by pg_total_relation_size(relid) desc
    limit 20
  ) row_data;

  select count(*)
  into duplicate_policy_count
  from (
    select schemaname, tablename, roles::text, cmd
    from pg_policies
    where schemaname = 'public'
    group by schemaname, tablename, roles::text, cmd
    having count(*) > 1
  ) duplicate_policies;

  select count(*)
  into missing_fk_index_count
  from pg_constraint c
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = c.conrelid
        and i.indisvalid
        and array(
          select key.attnum::smallint
          from unnest(i.indkey) with ordinality as key(attnum, ord)
          where key.ord <= cardinality(c.conkey)
          order by key.ord
        )::smallint[] = c.conkey
    );

  select count(*)
  into rls_enabled_no_policy_count
  from pg_class cls
  join pg_namespace ns on ns.oid = cls.relnamespace
  left join pg_policies pol
    on pol.schemaname = ns.nspname
   and pol.tablename = cls.relname
  where ns.nspname = 'public'
    and cls.relkind = 'r'
    and cls.relrowsecurity
    and pol.policyname is null;

  if exists (select 1 from pg_extension where extname = 'pg_stat_statements') then
    execute $slow$
      select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
      from (
        select
          calls,
          round(total_exec_time::numeric, 2) as total_exec_ms,
          round(mean_exec_time::numeric, 2) as mean_exec_ms,
          rows,
          left(regexp_replace(query, '\s+', ' ', 'g'), 220) as query_sample
        from pg_stat_statements
        where dbid = (select oid from pg_database where datname = current_database())
        order by total_exec_time desc
        limit 10
      ) row_data
    $slow$
    into slow_queries;
  end if;

  return jsonb_build_object(
    'topTables', top_tables,
    'slowQueries', slow_queries,
    'advisorSummary', jsonb_build_object(
      'duplicatePolicyGroups', duplicate_policy_count,
      'missingForeignKeyIndexes', missing_fk_index_count,
      'rlsEnabledNoPolicyTables', rls_enabled_no_policy_count
    ),
    'capturedAt', now()
  );
end;
$_$;


ALTER FUNCTION "public"."platform_performance_snapshot"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "document_id" "uuid",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_marketplace_purchase"("p_document_id" "uuid", "p_amount" integer, "p_description" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."credit_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  inserted_row public.credit_transactions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_document_id is null then
    raise exception 'Document id is required';
  end if;

  if p_amount >= 0 then
    raise exception 'Marketplace purchases must deduct credits';
  end if;

  insert into public.credit_transactions (
    user_id,
    amount,
    transaction_type,
    document_id,
    description,
    metadata
  )
  values (
    auth.uid(),
    p_amount,
    'purchase',
    p_document_id,
    p_description,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;


ALTER FUNCTION "public"."record_marketplace_purchase"("p_document_id" "uuid", "p_amount" integer, "p_description" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_can_manage_safety_intelligence"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.security_is_company_manager(target_company_id);
$$;


ALTER FUNCTION "public"."security_can_manage_safety_intelligence"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_can_mutate_company_memory"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.company_memberships m
      where m.company_id = target_company_id
        and m.user_id = auth.uid()
        and coalesce(m.status, '') = 'active'
        and coalesce(m.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'operations_manager',
          'safety_director',
          'safety_director_safety_manager'
        )
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and coalesce(ur.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'platform_admin',
          'super_admin',
          'admin'
        )
    );
$$;


ALTER FUNCTION "public"."security_can_mutate_company_memory"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_can_mutate_company_training_requirements"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.company_memberships m
      where m.company_id = target_company_id
        and m.user_id = auth.uid()
        and coalesce(m.status, '') = 'active'
        and coalesce(m.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'operations_manager',
          'safety_director',
          'safety_director_safety_manager'
        )
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and coalesce(ur.role, '') in (
          'company_admin',
          'manager',
          'safety_manager',
          'platform_admin',
          'super_admin',
          'admin'
        )
    );
$$;


ALTER FUNCTION "public"."security_can_mutate_company_training_requirements"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_can_submit_company_field_audit"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'company_admin',
          'manager',
          'safety_manager',
          'project_manager',
          'field_supervisor',
          'foreman',
          'field_user',
          'read_only',
          'company_user'
        )
    );
$$;


ALTER FUNCTION "public"."security_can_submit_company_field_audit"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_can_write_company_data"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'platform_admin',
          'super_admin',
          'admin',
          'company_admin',
          'manager',
          'safety_manager',
          'project_manager',
          'foreman',
          'field_user',
          'internal_reviewer',
          'employee',
          'company_user',
          'editor'
        )
    );
$$;


ALTER FUNCTION "public"."security_can_write_company_data"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_has_jobsite_access"("target_company_id" "uuid", "target_jobsite_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    target_jobsite_id is null
    or public.security_is_company_manager(target_company_id)
    or exists (
      select 1
      from public.company_jobsite_assignments cja
      where cja.user_id = auth.uid()
        and cja.company_id = target_company_id
        and cja.jobsite_id = target_jobsite_id
    );
$$;


ALTER FUNCTION "public"."security_has_jobsite_access"("target_company_id" "uuid", "target_jobsite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_is_company_manager"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'platform_admin',
          'super_admin',
          'admin',
          'company_admin',
          'manager',
          'safety_manager'
        )
    );
$$;


ALTER FUNCTION "public"."security_is_company_manager"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."security_is_company_member"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
    )
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
    );
$$;


ALTER FUNCTION "public"."security_is_company_member"("target_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."si_bump_generated_document_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    new.current_version := coalesce(new.current_version, 1);
    return new;
  end if;

  if
    new.status is distinct from old.status
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.html_preview is distinct from old.html_preview
    or new.draft_json is distinct from old.draft_json
    or new.risk_outputs is distinct from old.risk_outputs
    or new.provenance is distinct from old.provenance
  then
    new.current_version := old.current_version + 1;
  else
    new.current_version := old.current_version;
  end if;

  return new;
end
$$;


ALTER FUNCTION "public"."si_bump_generated_document_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."si_log_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
  after_state jsonb;
  entity_company_id uuid;
  entity_jobsite_id uuid;
  entity_id uuid;
begin
  before_state := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_state := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  entity_company_id := coalesce((to_jsonb(new)->>'company_id')::uuid, (to_jsonb(old)->>'company_id')::uuid);
  entity_jobsite_id := coalesce((to_jsonb(new)->>'jobsite_id')::uuid, (to_jsonb(old)->>'jobsite_id')::uuid);
  entity_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);

  insert into public.company_safety_intelligence_history (
    company_id,
    jobsite_id,
    entity_table,
    entity_id,
    change_type,
    before_state,
    after_state,
    changed_by
  )
  values (
    entity_company_id,
    entity_jobsite_id,
    tg_table_name,
    entity_id,
    lower(tg_op),
    before_state,
    after_state,
    auth.uid()
  );

  insert into public.company_safety_intelligence_audit_log (
    company_id,
    jobsite_id,
    entity_type,
    entity_id,
    action,
    actor_user_id,
    actor_role,
    event_payload
  )
  values (
    entity_company_id,
    entity_jobsite_id,
    tg_table_name,
    entity_id,
    lower(tg_op),
    auth.uid(),
    public.current_app_role(),
    coalesce(after_state, before_state, '{}'::jsonb)
  );

  return coalesce(new, old);
end
$$;


ALTER FUNCTION "public"."si_log_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."si_store_generated_document_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.company_generated_document_versions (
    company_id,
    jobsite_id,
    generated_document_id,
    version_number,
    ai_review_id,
    template_id,
    status,
    storage_bucket,
    storage_path,
    html_preview,
    draft_json,
    risk_outputs,
    provenance,
    created_by
  )
  values (
    new.company_id,
    new.jobsite_id,
    new.id,
    new.current_version,
    new.ai_review_id,
    new.template_id,
    new.status,
    new.storage_bucket,
    new.storage_path,
    new.html_preview,
    new.draft_json,
    new.risk_outputs,
    new.provenance,
    coalesce(new.updated_by, new.created_by, auth.uid())
  )
  on conflict (generated_document_id, version_number) do update
  set
    status = excluded.status,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    html_preview = excluded.html_preview,
    draft_json = excluded.draft_json,
    risk_outputs = excluded.risk_outputs,
    provenance = excluded.provenance;

  return new;
end
$$;


ALTER FUNCTION "public"."si_store_generated_document_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sor_audit_log_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."sor_audit_log_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sor_guard_locked_rows"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if old.status in ('submitted', 'locked', 'superseded') then
    if old.status = new.status
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
       and new.hazard_category_code is not distinct from old.hazard_category_code
       and new.subcategory is not distinct from old.subcategory
       and new.description is not distinct from old.description
       and new.severity is not distinct from old.severity
       and new.created_by is not distinct from old.created_by
       and new.created_at is not distinct from old.created_at
       and new.is_deleted = old.is_deleted
    then
      return new;
    end if;

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
       and new.hazard_category_code is not distinct from old.hazard_category_code
       and new.subcategory is not distinct from old.subcategory
       and new.description is not distinct from old.description
       and new.severity is not distinct from old.severity
       and new.created_by is not distinct from old.created_by
       and new.created_at is not distinct from old.created_at
       and new.is_deleted = old.is_deleted
    then
      return new;
    end if;

    raise exception 'Submitted/locked/superseded SOR rows are immutable except prediction-review metadata.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sor_guard_locked_rows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sor_prevent_hard_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  raise exception 'Hard delete is not allowed for SOR records. Use soft delete (is_deleted=true).';
end;
$$;


ALTER FUNCTION "public"."sor_prevent_hard_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sor_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."sor_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_company_invite"("invite_email" "text", "invite_role" "text", "invite_team" "text", "invite_company_id" "uuid", "invite_account_status" "text") RETURNS TABLE("id" "uuid", "email" "text", "role" "text", "team" "text", "company_id" "uuid", "account_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."upsert_company_invite"("invite_email" "text", "invite_role" "text", "invite_team" "text", "invite_company_id" "uuid", "invite_account_status" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_call_log" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surface" "text" NOT NULL,
    "model" "text",
    "prompt_hash" "text",
    "latency_ms" integer NOT NULL,
    "status" "text" NOT NULL,
    "http_status" integer,
    "attempts" integer DEFAULT 1 NOT NULL,
    "fallback_used" boolean DEFAULT false NOT NULL,
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "total_tokens" integer,
    "error_message" "text",
    "provider" "text",
    "fallback_reason" "text",
    "trace_id" "uuid",
    "prompt_version" "text",
    "output_schema_version" "text",
    "error_type" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "cache_hit" boolean DEFAULT false NOT NULL,
    "tool_calls_used" integer DEFAULT 0 NOT NULL,
    "eval_fixture_id" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    CONSTRAINT "ai_call_log_attempts_check" CHECK (("attempts" >= 1)),
    CONSTRAINT "ai_call_log_retry_count_check" CHECK (("retry_count" >= 0)),
    CONSTRAINT "ai_call_log_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'fallback'::"text", 'http_error'::"text", 'exception'::"text"]))),
    CONSTRAINT "ai_call_log_tool_calls_used_check" CHECK (("tool_calls_used" >= 0))
);


ALTER TABLE "public"."ai_call_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ai_call_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ai_call_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ai_call_log_id_seq" OWNED BY "public"."ai_call_log"."id";



CREATE TABLE IF NOT EXISTS "public"."ai_engine_recommendation_snapshots" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "surface" "text" NOT NULL,
    "window_days" integer NOT NULL,
    "aggregate_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recommendations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "summary" "text" NOT NULL,
    "summary_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_by" "uuid",
    CONSTRAINT "ai_engine_recommendation_snapshots_window_days_check" CHECK ((("window_days" >= 1) AND ("window_days" <= 30)))
);


ALTER TABLE "public"."ai_engine_recommendation_snapshots" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ai_engine_recommendation_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ai_engine_recommendation_snapshots_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ai_engine_recommendation_snapshots_id_seq" OWNED BY "public"."ai_engine_recommendation_snapshots"."id";



CREATE TABLE IF NOT EXISTS "public"."ai_output_feedback" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surface" "text" NOT NULL,
    "source_id" "text",
    "ai_review_id" "text",
    "rating" integer,
    "outcome" "text" NOT NULL,
    "edited_text" "text",
    "reason" "text",
    "created_by" "uuid",
    "signal_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "ai_output_feedback_outcome_check" CHECK (("outcome" = ANY (ARRAY['accepted'::"text", 'edited'::"text", 'rejected'::"text", 'regenerated'::"text", 'field-used'::"text"]))),
    CONSTRAINT "ai_output_feedback_rating_check" CHECK ((("rating" IS NULL) OR (("rating" >= 1) AND ("rating" <= 5))))
);


ALTER TABLE "public"."ai_output_feedback" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ai_output_feedback_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ai_output_feedback_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ai_output_feedback_id_seq" OWNED BY "public"."ai_output_feedback"."id";



CREATE TABLE IF NOT EXISTS "public"."ai_visual_generation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "site_map_id" "uuid",
    "blueprint_id" "uuid",
    "render_id" "uuid",
    "surface" "text" DEFAULT 'jobsite.site-visual.render.generate'::"text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "stage" "text" DEFAULT 'queued'::"text" NOT NULL,
    "prompt_hash" "text",
    "context_hash" "text",
    "token_budget" integer DEFAULT 12000 NOT NULL,
    "input_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_type" "text",
    "error_message" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "ai_visual_generation_jobs_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "ai_visual_generation_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'ready'::"text", 'failed'::"text", 'fallback_ready'::"text"]))),
    CONSTRAINT "ai_visual_generation_jobs_token_budget_check" CHECK (("token_budget" > 0))
);


ALTER TABLE "public"."ai_visual_generation_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."behavior_risk_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "trade" "text",
    "crew_id" "uuid",
    "supervisor_id" "uuid",
    "work_area" "text",
    "task_name" "text",
    "source_type" "text" NOT NULL,
    "source_id" "uuid",
    "risk_driver" "text" NOT NULL,
    "risk_points" integer NOT NULL,
    "severity" "text",
    "recommended_action" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "behavior_risk_events_points_check" CHECK ((("risk_points" >= 0) AND ("risk_points" <= 100))),
    CONSTRAINT "behavior_risk_events_risk_driver_check" CHECK (("risk_driver" = ANY (ARRAY['weak_jsa_language'::"text", 'missing_critical_control'::"text", 'permit_mismatch'::"text", 'training_gap'::"text", 'repeat_observation'::"text", 'open_corrective_action'::"text", 'missing_supervisor_verification'::"text", 'trade_overlap'::"text", 'schedule_pressure'::"text", 'control_dependency'::"text", 'prior_incident_pattern'::"text"]))),
    CONSTRAINT "behavior_risk_events_source_type_check" CHECK (("source_type" = ANY (ARRAY['jsa'::"text", 'permit'::"text", 'training'::"text", 'sor'::"text", 'corrective_action'::"text", 'incident'::"text", 'inspection'::"text", 'schedule'::"text", 'manual_review'::"text"]))),
    CONSTRAINT "behavior_risk_events_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."behavior_risk_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "billing_contact_name" "text",
    "billing_email" "text" NOT NULL,
    "billing_address_1" "text",
    "billing_address_2" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "country" "text" DEFAULT 'US'::"text",
    "phone" "text",
    "tax_id" "text",
    "stripe_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_events_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'updated'::"text", 'sent'::"text", 'payment_link_created'::"text", 'viewed'::"text", 'reminder_sent'::"text", 'payment_received'::"text", 'marked_paid'::"text", 'receipt_sent'::"text", 'voided'::"text", 'cancelled'::"text", 'payment_failed'::"text"])))
);


ALTER TABLE "public"."billing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_invoice_counters" (
    "year" integer NOT NULL,
    "last_seq" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."billing_invoice_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_invoice_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "item_type" "text" DEFAULT 'custom'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(12,4) DEFAULT 1 NOT NULL,
    "unit_price_cents" bigint NOT NULL,
    "line_total_cents" bigint NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_line_items_line_nonneg" CHECK (("line_total_cents" >= 0)),
    CONSTRAINT "billing_line_items_qty_positive" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "billing_line_items_type_check" CHECK (("item_type" = ANY (ARRAY['subscription'::"text", 'document_review'::"text", 'credit_pack'::"text", 'consulting'::"text", 'custom'::"text"]))),
    CONSTRAINT "billing_line_items_unit_nonneg" CHECK (("unit_price_cents" >= 0))
);


ALTER TABLE "public"."billing_invoice_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_invoice_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "payment_date" "date" DEFAULT ("timezone"('utc'::"text", "now"()))::"date" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "payment_method" "text" DEFAULT 'manual'::"text" NOT NULL,
    "external_payment_id" "text",
    "notes" "text",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_payments_amount_positive" CHECK (("amount_cents" > 0)),
    CONSTRAINT "billing_payments_method_check" CHECK (("payment_method" = ANY (ARRAY['stripe'::"text", 'ach'::"text", 'check'::"text", 'cash'::"text", 'manual'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."billing_invoice_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "issue_date" "date" DEFAULT ("timezone"('utc'::"text", "now"()))::"date" NOT NULL,
    "due_date" "date" NOT NULL,
    "subtotal_cents" bigint DEFAULT 0 NOT NULL,
    "tax_cents" bigint DEFAULT 0 NOT NULL,
    "discount_cents" bigint DEFAULT 0 NOT NULL,
    "total_cents" bigint DEFAULT 0 NOT NULL,
    "amount_paid_cents" bigint DEFAULT 0 NOT NULL,
    "balance_due_cents" bigint DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "notes" "text",
    "terms" "text",
    "created_by_user_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "voided_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "payment_provider" "text",
    "payment_link" "text",
    "pdf_path" "text",
    "stripe_customer_id" "text",
    "stripe_invoice_id" "text",
    "stripe_checkout_session_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "billing_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "billing_period_key" "text",
    "billing_period_start" "date",
    "billing_period_end" "date",
    CONSTRAINT "billing_invoices_billing_source_check" CHECK (("billing_source" = ANY (ARRAY['manual'::"text", 'company_pricing'::"text", 'recurring_company_pricing'::"text", 'marketplace_credit_pack'::"text", 'marketplace_document_purchase'::"text"]))),
    CONSTRAINT "billing_invoices_due_after_issue" CHECK (("due_date" >= "issue_date")),
    CONSTRAINT "billing_invoices_money_nonneg" CHECK ((("subtotal_cents" >= 0) AND ("tax_cents" >= 0) AND ("discount_cents" >= 0) AND ("total_cents" >= 0) AND ("amount_paid_cents" >= 0) AND ("balance_due_cents" >= 0))),
    CONSTRAINT "billing_invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'viewed'::"text", 'partial'::"text", 'paid'::"text", 'overdue'::"text", 'void'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."billing_invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."billing_invoices"."billing_source" IS 'Origin of the invoice: manual, company_pricing, or recurring_company_pricing.';



COMMENT ON COLUMN "public"."billing_invoices"."billing_period_key" IS 'UTC billing period key (YYYY-MM) for recurring company invoices.';



COMMENT ON COLUMN "public"."billing_invoices"."billing_period_start" IS 'UTC date for the beginning of the recurring billing period.';



COMMENT ON COLUMN "public"."billing_invoices"."billing_period_end" IS 'UTC date for the end of the recurring billing period.';



CREATE TABLE IF NOT EXISTS "public"."billing_staff_company_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."billing_staff_company_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_onboarding_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "section" "text" NOT NULL,
    "lifecycle_stage" "text" NOT NULL,
    "status" "text" DEFAULT 'Not Started'::"text" NOT NULL,
    "owner" "text",
    "due_date" "date",
    "completed" boolean DEFAULT false,
    "linked_document_id" "uuid",
    "notes" "text",
    "sort_order" integer DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_onboarding_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "team_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "industry" "text",
    "phone" "text",
    "website" "text",
    "address_line_1" "text",
    "city" "text",
    "state_region" "text",
    "postal_code" "text",
    "country" "text",
    "primary_contact_name" "text",
    "primary_contact_email" "text",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "archived_by_email" "text",
    "restored_at" timestamp with time zone,
    "restored_by" "uuid",
    "restored_by_email" "text",
    "industry_code" "text",
    "industry_injury_rate" double precision,
    "trade_injury_rate" double precision,
    "hours_worked" double precision,
    "permission_overrides" "jsonb" DEFAULT '{"deny": [], "allow": []}'::"jsonb" NOT NULL,
    "pilot_trial_ends_at" timestamp with time zone,
    "pilot_converted_at" timestamp with time zone,
    "predictability_settings" "jsonb" DEFAULT "jsonb_build_object"('predictabilityDataMode', 'company_then_platform_then_osha', 'allowCompanyData', true, 'allowPlatformAggregateFallback', true, 'allowOshaFallback', true, 'visibleBenchmarkSources', "jsonb_build_array"('company', 'platform_aggregate', 'osha')) NOT NULL,
    "demo_company" boolean DEFAULT false NOT NULL,
    "demo_seed_version" "text",
    "demo_seeded_at" timestamp with time zone,
    "demo_previous_company_id" "uuid",
    "logo_data_url" "text",
    "logo_file_name" "text",
    CONSTRAINT "companies_hours_worked_check" CHECK ((("hours_worked" IS NULL) OR (("hours_worked" >= (0)::double precision) AND ("hours_worked" <= ('1000000000000000'::numeric)::double precision)))),
    CONSTRAINT "companies_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'suspended'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."industry_code" IS 'NAICS industry code (2–6 digits) for industry benchmarking.';



COMMENT ON COLUMN "public"."companies"."industry_injury_rate" IS 'Reference injury rate for the NAICS sector (e.g. per 100 FTE/year); use same unit as company computed rate.';



COMMENT ON COLUMN "public"."companies"."trade_injury_rate" IS 'Reference injury rate for primary trade / craft; use same unit as company computed rate.';



COMMENT ON COLUMN "public"."companies"."hours_worked" IS 'Total hours worked for the same period as injury counts used in incident rate (typically annual); denominator for (incidents × 200,000) / hours_worked.';



COMMENT ON COLUMN "public"."companies"."permission_overrides" IS 'Workspace-wide function access overrides for company-scoped users.';



COMMENT ON COLUMN "public"."companies"."pilot_trial_ends_at" IS 'When set and pilot_converted_at is null, workspace is in pilot trial until this instant.';



COMMENT ON COLUMN "public"."companies"."pilot_converted_at" IS 'Set when the company admin completes the full company profile (exits pilot placeholder mode).';



COMMENT ON COLUMN "public"."companies"."predictability_settings" IS 'Company-level Predictability Engine source settings. Company-specific predictions remain scoped by company_id; platform fallback uses aggregate benchmark data only.';



COMMENT ON COLUMN "public"."companies"."demo_company" IS 'True for isolated seeded demo workspaces. Production cleanup must never target rows unless this is true.';



COMMENT ON COLUMN "public"."companies"."demo_previous_company_id" IS 'Previous active company for the user who loaded this demo workspace, used by demo reset/restore flows.';



CREATE TABLE IF NOT EXISTS "public"."company_ai_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "bucket_run_id" "uuid" NOT NULL,
    "review_type" "public"."si_ai_review_type" NOT NULL,
    "status" "public"."si_ai_review_status" DEFAULT 'draft'::"public"."si_ai_review_status" NOT NULL,
    "input_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rules_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "conflicts_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "prompt_hash" "text",
    "model" "text",
    "reviewed_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "input_snapshot_storage_path" "text",
    "ai_summary_storage_path" "text",
    CONSTRAINT "company_ai_reviews_approval_time_check" CHECK ((("approved_at" IS NULL) OR ("reviewed_at" IS NOT NULL)))
);


ALTER TABLE "public"."company_ai_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_analytics_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "snapshot_date" "date" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_analytics_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_audit_customer_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "audit_customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "project_number" "text",
    "location" "text",
    "report_email" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "project_manager" "text",
    "safety_lead" "text",
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_audit_customer_locations_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "company_audit_customer_locations_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_audit_customer_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_audit_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "report_email" "text",
    "contact_name" "text",
    "phone" "text",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state_region" "text",
    "postal_code" "text",
    "country" "text",
    CONSTRAINT "company_audit_customers_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "company_audit_customers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_audit_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_auditflow_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "template_version_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "assigned_user_id" "uuid",
    "scheduled_date" "date",
    "due_at" timestamp with time zone,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "manager_notes" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_auditflow_assignments_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'in_progress'::"text", 'submitted'::"text", 'approved'::"text", 'returned'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."company_auditflow_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_auditflow_corrective_action_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "action_id" "uuid" NOT NULL,
    "item_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_auditflow_corrective_action_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_auditflow_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "template_version_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "submitted_by" "uuid",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "score_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "signature_text" "text" NOT NULL,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "reviewed_at" timestamp with time zone,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_auditflow_submissions_signature_nonempty" CHECK (("length"(TRIM(BOTH FROM "signature_text")) > 0)),
    CONSTRAINT "company_auditflow_submissions_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'approved'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."company_auditflow_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_auditflow_template_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "schema" "jsonb" DEFAULT '{"sections": []}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_auditflow_template_versions_positive" CHECK (("version" > 0))
);


ALTER TABLE "public"."company_auditflow_template_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_auditflow_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "current_version_id" "uuid",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_auditflow_templates_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_auditflow_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_bucket_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "bucket_run_id" "uuid" NOT NULL,
    "company_task_id" "uuid",
    "work_area_id" "uuid",
    "source_module" "text" NOT NULL,
    "source_id" "uuid",
    "bucket_key" "text" NOT NULL,
    "bucket_type" "text" NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "weather_condition_id" "uuid",
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "bucket_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rule_results" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "conflict_results" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_ready" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_bucket_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_bucket_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "source_module" "text" NOT NULL,
    "source_id" "uuid",
    "run_status" "public"."si_bucket_run_status" DEFAULT 'pending'::"public"."si_bucket_run_status" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "intake_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "bucket_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rules_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "conflict_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_bucket_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text",
    "status" "text" DEFAULT 'Not Started'::"text",
    "owner" "text",
    "due_date" "date",
    "estimated_cost" "text",
    "notes" "text",
    "completed" boolean DEFAULT false,
    "linked_document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "company_type" "text",
    "lifecycle_stage" "text" DEFAULT 'Lead'::"text" NOT NULL,
    "status" "text" DEFAULT 'Active'::"text" NOT NULL,
    "owner" "text",
    "source" "text" DEFAULT 'Manual'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_conflict_pairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "bucket_run_id" "uuid",
    "left_operation_id" "uuid",
    "right_operation_id" "uuid",
    "conflict_code" "text" NOT NULL,
    "conflict_type" "text" NOT NULL,
    "severity" "public"."si_conflict_severity" DEFAULT 'medium'::"public"."si_conflict_severity" NOT NULL,
    "status" "public"."si_conflict_status" DEFAULT 'open'::"public"."si_conflict_status" NOT NULL,
    "overlap_scope" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rationale" "text" NOT NULL,
    "recommended_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "weather_condition" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_conflict_pairs_distinct_operations_check" CHECK (("left_operation_id" IS DISTINCT FROM "right_operation_id"))
);


ALTER TABLE "public"."company_conflict_pairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_conflict_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "platform_rule_id" "uuid",
    "conflict_code" "text" NOT NULL,
    "conflict_type" "text" NOT NULL,
    "left_trade_code" "text",
    "left_task_code" "text",
    "left_hazard_family" "text",
    "right_trade_code" "text",
    "right_task_code" "text",
    "right_hazard_family" "text",
    "requires_same_area" boolean DEFAULT false NOT NULL,
    "requires_time_overlap" boolean DEFAULT false NOT NULL,
    "weather_condition" "text",
    "severity" "public"."si_conflict_severity" DEFAULT 'medium'::"public"."si_conflict_severity" NOT NULL,
    "rationale" "text" NOT NULL,
    "recommended_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_conflict_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_contractor_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "contractor_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "expires_on" "date",
    "file_path" "text",
    "verification_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_contractor_documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['coi'::"text", 'wcb'::"text", 'license'::"text", 'emr'::"text", 'safety_manual'::"text", 'other'::"text"]))),
    CONSTRAINT "company_contractor_documents_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0)),
    CONSTRAINT "company_contractor_documents_verification_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."company_contractor_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_contractor_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "contractor_id" "uuid" NOT NULL,
    "score" numeric DEFAULT 0 NOT NULL,
    "blocking_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "evaluated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "evaluator_id" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."company_contractor_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_contractors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_contractors_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."company_contractors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_controls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "control_type" "text" DEFAULT 'administrative'::"text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_corrective_action_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "detail" "text",
    "event_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_corrective_action_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_corrective_action_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_corrective_action_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_corrective_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_user_id" "uuid",
    "due_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "manager_override_close" boolean DEFAULT false NOT NULL,
    "manager_override_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "source_submission_id" "uuid",
    "category" "text" DEFAULT 'corrective_action'::"text" NOT NULL,
    "dap_id" "uuid",
    "dap_activity_id" "uuid",
    "workflow_status" "text",
    "observation_type" "text" DEFAULT 'negative'::"text" NOT NULL,
    "sif_potential" boolean,
    "sif_category" "text",
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "immediate_action_required" boolean DEFAULT false NOT NULL,
    "closure_note" "text",
    "validation_reviewed_by" "uuid",
    "validation_reviewed_at" timestamp with time zone,
    "time_to_close_hours" numeric,
    "source_type" "text" DEFAULT 'field_issue'::"text" NOT NULL,
    "source_sor_id" "uuid",
    "proof_status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "proof_version_number" integer DEFAULT 1 NOT NULL,
    "proof_previous_version_id" "uuid",
    "proof_record_hash" "text",
    "proof_previous_hash" "text",
    "proof_change_reason" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "proof_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "prediction_validation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "prediction_review_rating" integer,
    "prediction_review_notes" "text",
    "prediction_review_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "prediction_reviewed_by" "uuid",
    "prediction_reviewed_at" timestamp with time zone,
    CONSTRAINT "company_corrective_actions_category_check" CHECK (("category" = ANY (ARRAY['hazard'::"text", 'near_miss'::"text", 'incident'::"text", 'good_catch'::"text", 'ppe_violation'::"text", 'housekeeping'::"text", 'equipment_issue'::"text", 'fall_hazard'::"text", 'electrical_hazard'::"text", 'excavation_trench_concern'::"text", 'fire_hot_work_concern'::"text", 'corrective_action'::"text"]))),
    CONSTRAINT "company_corrective_actions_negative_requires_sif_eval_check" CHECK ((("observation_type" <> 'negative'::"text") OR ("sif_potential" IS NOT NULL))),
    CONSTRAINT "company_corrective_actions_observation_type_check" CHECK (("observation_type" = ANY (ARRAY['positive'::"text", 'negative'::"text", 'near_miss'::"text"]))),
    CONSTRAINT "company_corrective_actions_prediction_approved_rating_check" CHECK ((("prediction_validation_status" <> 'approved'::"text") OR ("prediction_review_rating" IS NOT NULL))),
    CONSTRAINT "company_corrective_actions_prediction_review_rating_check" CHECK ((("prediction_review_rating" IS NULL) OR (("prediction_review_rating" >= 1) AND ("prediction_review_rating" <= 5)))),
    CONSTRAINT "company_corrective_actions_prediction_validation_status_check" CHECK (("prediction_validation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "company_corrective_actions_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_corrective_actions_proof_status_check" CHECK (("proof_status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'locked'::"text", 'superseded'::"text"]))),
    CONSTRAINT "company_corrective_actions_proof_version_positive" CHECK (("proof_version_number" >= 1)),
    CONSTRAINT "company_corrective_actions_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_corrective_actions_sif_category_check" CHECK ((("sif_category" IS NULL) OR ("sif_category" = ANY (ARRAY['fall_from_height'::"text", 'struck_by'::"text", 'caught_between'::"text", 'electrical'::"text", 'excavation_collapse'::"text", 'confined_space'::"text", 'hazardous_energy'::"text", 'crane_rigging'::"text", 'line_of_fire'::"text"])))),
    CONSTRAINT "company_corrective_actions_source_type_check" CHECK (("source_type" = ANY (ARRAY['field_issue'::"text", 'sor_compat'::"text", 'legacy_sor'::"text", 'safety_submission'::"text", 'field_audit'::"text"]))),
    CONSTRAINT "company_corrective_actions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'assigned'::"text", 'in_progress'::"text", 'corrected'::"text", 'verified_closed'::"text", 'escalated'::"text", 'stop_work'::"text"]))),
    CONSTRAINT "company_corrective_actions_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_corrective_actions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_corrective_actions"."source_sor_id" IS 'Legacy company_sor_records id when this unified Field Issue was migrated from or created through SOR compatibility APIs.';



COMMENT ON COLUMN "public"."company_corrective_actions"."proof_context" IS 'Structured proof context for fields not native to Field Issues, including legacy SOR project/location/trade/subcategory.';



CREATE TABLE IF NOT EXISTS "public"."company_credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "document_id" "uuid",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_crews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "name" "text" NOT NULL,
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_crews_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."company_crews" OWNER TO "postgres";


COMMENT ON TABLE "public"."company_crews" IS 'Named crews for a company; optional jobsite_id scopes a crew to one jobsite.';



CREATE TABLE IF NOT EXISTS "public"."company_jsa_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jsa_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "work_date" "date",
    "trade" "text",
    "activity_name" "text" NOT NULL,
    "area" "text",
    "crew_size" integer,
    "hazard_category" "text",
    "hazard_description" "text",
    "mitigation" "text",
    "permit_required" boolean DEFAULT false NOT NULL,
    "permit_type" "text",
    "planned_risk_level" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "ppe_requirements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ppe_acknowledged" boolean DEFAULT false NOT NULL,
    "ppe_trigger_sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "company_jsa_activities_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'monitored'::"text", 'not_started'::"text", 'active'::"text", 'paused'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."company_jsa_activities" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."company_dap_activities" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "jsa_id" AS "dap_id",
    "jobsite_id",
    "work_date",
    "trade",
    "activity_name",
    "area",
    "crew_size",
    "hazard_category",
    "hazard_description",
    "mitigation",
    "permit_required",
    "permit_type",
    "planned_risk_level",
    "status",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "ppe_requirements",
    "ppe_acknowledged",
    "ppe_trigger_sources"
   FROM "public"."company_jsa_activities";


ALTER VIEW "public"."company_dap_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jsas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "category" "text" DEFAULT 'corrective_action'::"text" NOT NULL,
    "owner_user_id" "uuid",
    "due_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_jsas_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_jsas_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_jsas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."company_daps" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "jobsite_id",
    "title",
    "description",
    "status",
    "severity",
    "category",
    "owner_user_id",
    "due_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
   FROM "public"."company_jsas";


ALTER VIEW "public"."company_daps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_data_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "request_scope" "text" NOT NULL,
    "subject_user_id" "uuid",
    "subject_email" "text",
    "jobsite_id" "uuid",
    "document_id" "uuid",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "requested_by" "uuid",
    "reviewed_by" "uuid",
    "completed_by" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "reviewer_notes" "text",
    "completion_evidence" "text",
    "evidence_storage_path" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "due_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_data_requests_request_scope_check" CHECK (("request_scope" = ANY (ARRAY['company'::"text", 'jobsite'::"text", 'user'::"text", 'document'::"text", 'other'::"text"]))),
    CONSTRAINT "company_data_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['export'::"text", 'deletion'::"text", 'correction'::"text", 'privacy_review'::"text"]))),
    CONSTRAINT "company_data_requests_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'reviewing'::"text", 'waiting_on_customer'::"text", 'completed'::"text", 'denied'::"text", 'canceled'::"text"]))),
    CONSTRAINT "company_data_requests_title_not_blank" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_data_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_document_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "lifecycle_stage" "text" NOT NULL,
    "required_for_active" boolean DEFAULT false,
    "description" "text",
    "sort_order" integer DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_document_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "document_type" "public"."si_document_type" NOT NULL,
    "title" "text" NOT NULL,
    "template_key" "text" NOT NULL,
    "schema_version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "sections" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "template_body" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_document_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "checklist_item_id" "uuid",
    "file_path" "text",
    "file_name" "text",
    "file_type" "text",
    "status" "text" DEFAULT 'Uploaded'::"text",
    "owner" "text",
    "revision" "text",
    "notes" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "requirement_id" "uuid",
    "client_id" "uuid",
    "record_type" "text" DEFAULT 'Company Record'::"text",
    "lifecycle_stage" "text",
    "effective_date" "date",
    "executed_date" "date",
    "expiration_date" "date",
    "renewal_date" "date",
    "legal_hold" boolean DEFAULT false
);


ALTER TABLE "public"."company_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_employee_jobsite_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_employee_jobsite_assignments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_employee_jobsite_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_employee_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "external_employee_id" "text",
    "full_name" "text" NOT NULL,
    "email" "text",
    "email_normalized" "text",
    "phone" "text",
    "phone_normalized" "text",
    "job_title" "text",
    "trade_specialty" "text",
    "readiness_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "years_experience" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "certifications" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "certification_expirations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "worker_type" "text" DEFAULT 'External Worker'::"text" NOT NULL,
    "company_name" "text",
    "department_name" "text",
    "manager_id" "uuid",
    "supervisor_id" "uuid",
    "responsible_sponsor_id" "uuid",
    "access_status" "text" DEFAULT 'restricted'::"text" NOT NULL,
    "access_start_date" "date",
    "access_end_date" "date",
    "restrictions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "company_employee_profiles_access_status_check" CHECK (("access_status" = ANY (ARRAY['active'::"text", 'pending_review'::"text", 'restricted'::"text", 'blocked'::"text", 'inactive'::"text"]))),
    CONSTRAINT "company_employee_profiles_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "full_name")) > 0)),
    CONSTRAINT "company_employee_profiles_readiness_check" CHECK (("readiness_status" = ANY (ARRAY['ready'::"text", 'travel_ready'::"text", 'limited'::"text", 'needs_training'::"text", 'onboarding'::"text"]))),
    CONSTRAINT "company_employee_profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'archived'::"text"]))),
    CONSTRAINT "company_employee_profiles_worker_type_check" CHECK (("worker_type" = ANY (ARRAY['Employee'::"text", 'Contractor'::"text", 'Agency Worker'::"text", 'Supplier'::"text", 'Visitor'::"text", 'Temporary Worker'::"text", 'External Worker'::"text"]))),
    CONSTRAINT "company_employee_profiles_years_check" CHECK ((("years_experience" IS NULL) OR ("years_experience" >= 0)))
);


ALTER TABLE "public"."company_employee_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_employee_profiles"."worker_type" IS 'Stage 1 workforce directory display type for no-portal tracked workers.';



COMMENT ON COLUMN "public"."company_employee_profiles"."access_status" IS 'Stage 1 no-login site access status: active, pending_review, restricted, blocked, inactive.';



CREATE TABLE IF NOT EXISTS "public"."company_employee_training_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "requirement_id" "uuid",
    "title" "text" NOT NULL,
    "completed_on" "date",
    "expires_on" "date",
    "provider" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_employee_training_records_date_order" CHECK ((("expires_on" IS NULL) OR ("completed_on" IS NULL) OR ("expires_on" >= "completed_on"))),
    CONSTRAINT "company_employee_training_records_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_employee_training_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_finance_authorized_users" (
    "user_id" "uuid" NOT NULL,
    "access_label" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_finance_authorized_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_finance_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "budget_type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "period" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "period_start" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "owner" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "company_finance_budgets_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "company_finance_budgets_period_check" CHECK (("period" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "company_finance_budgets_type_check" CHECK (("budget_type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."company_finance_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_finance_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_finance_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_finance_recurring_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "category" "text" NOT NULL,
    "cadence" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "next_due_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "vendor_customer" "text",
    "payment_method" "text",
    "owner" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "company_finance_recurring_items_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "company_finance_recurring_items_cadence_check" CHECK (("cadence" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "company_finance_recurring_items_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'ended'::"text"]))),
    CONSTRAINT "company_finance_recurring_items_type_check" CHECK (("item_type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."company_finance_recurring_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_finance_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "transaction_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" NOT NULL,
    "vendor_customer" "text",
    "payment_method" "text",
    "owner" "text",
    "notes" "text",
    "related_client_id" "uuid",
    "related_document_id" "uuid",
    "created_by" "uuid",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_status" "text" DEFAULT 'unreviewed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "company_finance_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "company_finance_transactions_review_status_check" CHECK (("review_status" = ANY (ARRAY['unreviewed'::"text", 'reviewed'::"text", 'needs_follow_up'::"text"]))),
    CONSTRAINT "company_finance_transactions_status_check" CHECK (((("transaction_type" = 'income'::"text") AND ("status" = ANY (ARRAY['expected'::"text", 'invoiced'::"text", 'received'::"text", 'cancelled'::"text"]))) OR (("transaction_type" = 'expense'::"text") AND ("status" = ANY (ARRAY['planned'::"text", 'due'::"text", 'paid'::"text", 'cancelled'::"text"]))))),
    CONSTRAINT "company_finance_transactions_type_check" CHECK (("transaction_type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."company_finance_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_generated_document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "generated_document_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "ai_review_id" "uuid",
    "template_id" "uuid",
    "status" "public"."si_document_status" NOT NULL,
    "storage_bucket" "text",
    "storage_path" "text",
    "html_preview" "text",
    "draft_json" "jsonb" DEFAULT '{}'::"jsonb",
    "risk_outputs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "provenance" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "html_preview_storage_path" "text",
    "draft_json_storage_path" "text",
    "payload_hot_until" timestamp with time zone,
    CONSTRAINT "company_generated_document_versions_version_check" CHECK (("version_number" >= 1))
);


ALTER TABLE "public"."company_generated_document_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_generated_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "bucket_run_id" "uuid",
    "ai_review_id" "uuid",
    "template_id" "uuid",
    "source_document_id" "uuid",
    "document_type" "public"."si_document_type" NOT NULL,
    "title" "text" NOT NULL,
    "current_version" integer DEFAULT 1 NOT NULL,
    "status" "public"."si_document_status" DEFAULT 'draft'::"public"."si_document_status" NOT NULL,
    "storage_bucket" "text",
    "storage_path" "text",
    "html_preview" "text",
    "draft_json" "jsonb" DEFAULT '{}'::"jsonb",
    "risk_outputs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "provenance" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "html_preview_storage_path" "text",
    "draft_json_storage_path" "text",
    "payload_hot_until" timestamp with time zone,
    CONSTRAINT "company_generated_documents_current_version_check" CHECK (("current_version" >= 1))
);


ALTER TABLE "public"."company_generated_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_hazards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "family" "text" NOT NULL,
    "severity_hint" "public"."si_conflict_severity" DEFAULT 'medium'::"public"."si_conflict_severity" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_hazards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_hris_roster_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'api'::"text" NOT NULL,
    "row_count" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_hris_roster_imports_row_count_nonneg" CHECK (("row_count" >= 0))
);


ALTER TABLE "public"."company_hris_roster_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "category" "text" DEFAULT 'incident'::"text" NOT NULL,
    "owner_user_id" "uuid",
    "due_at" timestamp with time zone,
    "occurred_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "sif_flag" boolean DEFAULT false NOT NULL,
    "escalation_level" "text" DEFAULT 'none'::"text" NOT NULL,
    "escalation_reason" "text",
    "stop_work_status" "text" DEFAULT 'normal'::"text" NOT NULL,
    "stop_work_reason" "text",
    "escalated_at" timestamp with time zone,
    "stop_work_at" timestamp with time zone,
    "converted_from_submission_id" "uuid",
    "observation_id" "uuid",
    "dap_activity_id" "uuid",
    "closed_at" timestamp with time zone,
    "injury_type" "text",
    "exposure_event_type" "text",
    "days_away_from_work" integer DEFAULT 0 NOT NULL,
    "days_restricted" integer DEFAULT 0 NOT NULL,
    "job_transfer" boolean DEFAULT false NOT NULL,
    "body_part" "text",
    "injury_source" "text",
    "recordable" boolean DEFAULT false NOT NULL,
    "lost_time" boolean DEFAULT false NOT NULL,
    "fatality" boolean DEFAULT false NOT NULL,
    "injury_month" smallint,
    "injury_season" "text",
    "injury_day_of_week" "text",
    "injury_time_of_day" "text",
    "prediction_validation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "prediction_review_rating" integer,
    "prediction_review_notes" "text",
    "prediction_review_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "prediction_reviewed_by" "uuid",
    "prediction_reviewed_at" timestamp with time zone,
    "idlh_flag" boolean DEFAULT false NOT NULL,
    CONSTRAINT "company_incidents_body_part_check" CHECK ((("body_part" IS NULL) OR ("body_part" = ANY (ARRAY['back'::"text", 'hand'::"text", 'fingers'::"text", 'knee'::"text", 'shoulder'::"text", 'eye'::"text", 'foot'::"text", 'other'::"text"])))),
    CONSTRAINT "company_incidents_days_away_from_work_check" CHECK (("days_away_from_work" >= 0)),
    CONSTRAINT "company_incidents_days_restricted_check" CHECK (("days_restricted" >= 0)),
    CONSTRAINT "company_incidents_escalation_level_check" CHECK (("escalation_level" = ANY (ARRAY['none'::"text", 'monitor'::"text", 'urgent'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_incidents_exposure_event_type_check" CHECK ((("exposure_event_type" IS NULL) OR ("exposure_event_type" = ANY (ARRAY['caught_in_between'::"text", 'caught_on_object'::"text", 'confined_space'::"text", 'contact_with_equipment'::"text", 'drowning'::"text", 'electrical'::"text", 'excavation_collapse'::"text", 'explosion'::"text", 'exposure_harmful_substance'::"text", 'fall_same_level'::"text", 'fall_to_lower_level'::"text", 'fire'::"text", 'motor_vehicle'::"text", 'noise_exposure'::"text", 'overexertion'::"text", 'repetitive_motion'::"text", 'slip_trip_without_fall'::"text", 'struck_against_object'::"text", 'struck_by_object'::"text", 'struck_by_vehicle'::"text", 'structure_collapse'::"text", 'temperature_extreme'::"text", 'workplace_violence'::"text", 'other'::"text"])))),
    CONSTRAINT "company_incidents_injury_day_of_week_check" CHECK ((("injury_day_of_week" IS NULL) OR ("injury_day_of_week" = ANY (ARRAY['sunday'::"text", 'monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text"])))),
    CONSTRAINT "company_incidents_injury_month_check" CHECK ((("injury_month" IS NULL) OR (("injury_month" >= 1) AND ("injury_month" <= 12)))),
    CONSTRAINT "company_incidents_injury_season_check" CHECK ((("injury_season" IS NULL) OR ("injury_season" = ANY (ARRAY['winter'::"text", 'spring'::"text", 'summer'::"text", 'fall'::"text"])))),
    CONSTRAINT "company_incidents_injury_source_check" CHECK ((("injury_source" IS NULL) OR ("injury_source" = ANY (ARRAY['ladder'::"text", 'scaffold'::"text", 'hand_tools'::"text", 'heavy_equipment'::"text", 'material_handling'::"text", 'electrical_system'::"text", 'other'::"text"])))),
    CONSTRAINT "company_incidents_injury_time_of_day_check" CHECK ((("injury_time_of_day" IS NULL) OR ("injury_time_of_day" = ANY (ARRAY['night'::"text", 'early_morning'::"text", 'morning'::"text", 'afternoon'::"text", 'evening'::"text"])))),
    CONSTRAINT "company_incidents_injury_type_check" CHECK ((("injury_type" IS NULL) OR ("injury_type" = ANY (ARRAY['abrasion'::"text", 'amputation'::"text", 'burn'::"text", 'chemical_burn'::"text", 'cold_injury'::"text", 'concussion'::"text", 'contusion'::"text", 'crush_injury'::"text", 'dislocation'::"text", 'foreign_body'::"text", 'fracture'::"text", 'heat_illness'::"text", 'hearing_loss'::"text", 'insect_animal'::"text", 'internal_injury'::"text", 'laceration'::"text", 'multiple_injuries'::"text", 'poisoning'::"text", 'puncture'::"text", 'respiratory'::"text", 'sprain'::"text", 'strain'::"text", 'vision_loss'::"text", 'other'::"text"])))),
    CONSTRAINT "company_incidents_prediction_approved_rating_check" CHECK ((("prediction_validation_status" <> 'approved'::"text") OR ("prediction_review_rating" IS NOT NULL))),
    CONSTRAINT "company_incidents_prediction_review_rating_check" CHECK ((("prediction_review_rating" IS NULL) OR (("prediction_review_rating" >= 1) AND ("prediction_review_rating" <= 5)))),
    CONSTRAINT "company_incidents_prediction_validation_status_check" CHECK (("prediction_validation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "company_incidents_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_incidents_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'closed'::"text"]))),
    CONSTRAINT "company_incidents_stop_work_status_check" CHECK (("stop_work_status" = ANY (ARRAY['normal'::"text", 'stop_work_requested'::"text", 'stop_work_active'::"text", 'cleared'::"text"])))
);


ALTER TABLE "public"."company_incidents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_incidents"."closed_at" IS 'Timestamp when the incident was closed; null while open or in progress.';



COMMENT ON COLUMN "public"."company_incidents"."injury_type" IS 'Nature of injury (strain, fracture, etc.) for analytics and loss modeling. Null for near misses, hazards, or legacy rows.';



COMMENT ON COLUMN "public"."company_incidents"."exposure_event_type" IS 'Structured event/exposure mechanism (falls, struck-by, etc.) for regulatory and loss modeling.';



COMMENT ON COLUMN "public"."company_incidents"."days_away_from_work" IS 'Calendar days away from work attributable to the case (DART / severity proxy).';



COMMENT ON COLUMN "public"."company_incidents"."days_restricted" IS 'Days on restricted / light duty attributable to the case.';



COMMENT ON COLUMN "public"."company_incidents"."job_transfer" IS 'Whether the worker was transferred to another job due to the case (DART transfer).';



COMMENT ON COLUMN "public"."company_incidents"."body_part" IS 'Primary body region for predictive / trade analytics. Null for non-injury categories or legacy rows.';



COMMENT ON COLUMN "public"."company_incidents"."injury_source" IS 'Equipment or object category involved (ladder, scaffold, etc.). API: JSON field `source`.';



COMMENT ON COLUMN "public"."company_incidents"."recordable" IS 'OSHA-recordable case (medical treatment beyond first aid, etc.), independent of severity label.';



COMMENT ON COLUMN "public"."company_incidents"."lost_time" IS 'Lost-time case (days away or restricted beyond day of injury), DART-relevant.';



COMMENT ON COLUMN "public"."company_incidents"."fatality" IS 'Work-related fatality.';



COMMENT ON COLUMN "public"."company_incidents"."injury_month" IS 'Calendar month (1–12) from occurred_at UTC.';



COMMENT ON COLUMN "public"."company_incidents"."injury_season" IS 'Meteorological season from occurred_at UTC (northern hemisphere).';



COMMENT ON COLUMN "public"."company_incidents"."injury_day_of_week" IS 'Day of week from occurred_at UTC.';



COMMENT ON COLUMN "public"."company_incidents"."injury_time_of_day" IS 'UTC hour band from occurred_at.';



CREATE TABLE IF NOT EXISTS "public"."company_induction_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "user_id" "uuid",
    "visitor_display_name" "text",
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "evidence_path" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_by" "uuid",
    CONSTRAINT "company_induction_completions_subject_check" CHECK ((("user_id" IS NOT NULL) OR (("visitor_display_name" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "visitor_display_name")) > 0))))
);


ALTER TABLE "public"."company_induction_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_induction_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "audience" "text" DEFAULT 'worker'::"text" NOT NULL,
    "required_docs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_induction_programs_audience_check" CHECK (("audience" = ANY (ARRAY['worker'::"text", 'visitor'::"text", 'subcontractor'::"text"]))),
    CONSTRAINT "company_induction_programs_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."company_induction_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_induction_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_induction_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_inspection_calendar_signoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "audit_customer_id" "uuid",
    "audit_customer_location_id" "uuid",
    "jobsite_id" "uuid",
    "scope_key" "text" DEFAULT 'company'::"text" NOT NULL,
    "calendar_year" integer NOT NULL,
    "due_date" "date" NOT NULL,
    "template_key" "text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "owner" "text",
    "notes" "text",
    "initials" "text",
    "completed_at" timestamp with time zone,
    "completion_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "evidence_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "corrective_action_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_inspection_calendar_signoffs_scope_key_nonempty" CHECK (("length"(TRIM(BOTH FROM "scope_key")) > 0)),
    CONSTRAINT "company_inspection_calendar_signoffs_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'complete'::"text", 'missed'::"text", 'waived'::"text"]))),
    CONSTRAINT "company_inspection_calendar_signoffs_template_key_nonempty" CHECK (("length"(TRIM(BOTH FROM "template_key")) > 0)),
    CONSTRAINT "company_inspection_calendar_signoffs_year_check" CHECK ((("calendar_year" >= 2020) AND ("calendar_year" <= 2100)))
);


ALTER TABLE "public"."company_inspection_calendar_signoffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_integration_webhook_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "webhook_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "response_status" integer,
    "delivered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_integration_webhook_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_integration_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target_url" "text" NOT NULL,
    "secret" "text" NOT NULL,
    "event_types" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_integration_webhooks_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "company_integration_webhooks_url_nonempty" CHECK (("length"(TRIM(BOTH FROM "target_url")) > 0))
);


ALTER TABLE "public"."company_integration_webhooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'company_user'::"text" NOT NULL,
    "team" "text" DEFAULT 'General'::"text" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "account_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "consumed_at" timestamp with time zone,
    "consumed_by" "uuid",
    CONSTRAINT "company_invites_role_check" CHECK (("role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text", 'project_manager'::"text", 'field_supervisor'::"text", 'foreman'::"text", 'field_user'::"text", 'read_only'::"text", 'company_user'::"text"]))),
    CONSTRAINT "company_invites_status_check" CHECK (("account_status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."company_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'field_user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_jobsite_assignments_role_check" CHECK (("role" = ANY (ARRAY['project_manager'::"text", 'field_supervisor'::"text", 'foreman'::"text", 'field_user'::"text", 'read_only'::"text", 'company_user'::"text"])))
);


ALTER TABLE "public"."company_jobsite_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_audit_observation_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "audit_id" "uuid" NOT NULL,
    "observation_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_jobsite_audit_observation_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_audit_observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "audit_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "source_key" "text" NOT NULL,
    "template_source" "text" NOT NULL,
    "trade_code" "text",
    "sub_trade_code" "text",
    "task_code" "text",
    "category_code" "text",
    "category_label" "text",
    "item_label" "text" NOT NULL,
    "status" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "notes" "text",
    "photo_count" integer DEFAULT 0 NOT NULL,
    "evidence_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "corrective_action_id" "uuid",
    "ai_bucket_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_jobsite_audit_observations_item_label_nonempty" CHECK (("length"(TRIM(BOTH FROM "item_label")) > 0)),
    CONSTRAINT "company_jobsite_audit_observations_photo_count_check" CHECK (("photo_count" >= 0)),
    CONSTRAINT "company_jobsite_audit_observations_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_jobsite_audit_observations_status_check" CHECK (("status" = ANY (ARRAY['pass'::"text", 'fail'::"text", 'na'::"text"])))
);


ALTER TABLE "public"."company_jobsite_audit_observations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_audit_report_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "audit_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    CONSTRAINT "company_jobsite_audit_report_deliveries_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'skipped'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."company_jobsite_audit_report_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_audit_signoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "audit_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "signed_by" "uuid",
    "signature_text" "text" NOT NULL,
    "signature_image_path" "text",
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_jobsite_audit_signoffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "audit_date" "date",
    "auditors" "text",
    "selected_trade" "text" DEFAULT 'general_contractor'::"text" NOT NULL,
    "template_source" "text" DEFAULT 'built_in'::"text" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "score_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_by" "uuid",
    "ai_review_id" "uuid",
    "ai_review_status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "ai_review_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "audit_customer_id" "uuid",
    "audit_customer_location_id" "uuid",
    CONSTRAINT "company_jobsite_audits_ai_review_status_check" CHECK (("ai_review_status" = ANY (ARRAY['not_started'::"text", 'reviewed'::"text", 'fallback_reviewed'::"text", 'failed'::"text"]))),
    CONSTRAINT "company_jobsite_audits_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'submitted'::"text", 'archived'::"text", 'returned'::"text"]))),
    CONSTRAINT "company_jobsite_audits_template_source_check" CHECK (("template_source" = ANY (ARRAY['field'::"text", 'hs'::"text", 'env'::"text", 'mixed'::"text", 'built_in'::"text"])))
);


ALTER TABLE "public"."company_jobsite_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_chemicals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "chemical_name" "text" NOT NULL,
    "manufacturer" "text",
    "sds_file_path" "text",
    "sds_effective_date" "date",
    "next_review_date" "date",
    "quantity_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_jobsite_chemicals_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "chemical_name")) > 0))
);


ALTER TABLE "public"."company_jobsite_chemicals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_daily_todos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "work_date" "date" NOT NULL,
    "source_key" "text" NOT NULL,
    "role" "text" NOT NULL,
    "title" "text" NOT NULL,
    "detail" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "target_tab" "text" NOT NULL,
    "target_href" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_jobsite_daily_todos_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_jobsite_daily_todos_role_check" CHECK (("role" = ANY (ARRAY['pm'::"text", 'sl'::"text"]))),
    CONSTRAINT "company_jobsite_daily_todos_source_key_nonempty" CHECK (("length"(TRIM(BOTH FROM "source_key")) > 0)),
    CONSTRAINT "company_jobsite_daily_todos_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewed'::"text", 'completed'::"text", 'closed_out'::"text"]))),
    CONSTRAINT "company_jobsite_daily_todos_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_jobsite_daily_todos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_schedule_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "work_start_date" "date" NOT NULL,
    "work_end_date" "date",
    "trade" "text",
    "work_area" "text",
    "crew_or_contractor" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "risk_level" "text" DEFAULT 'medium'::"text" NOT NULL,
    "is_high_risk" boolean DEFAULT false NOT NULL,
    "hazard_categories" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "permit_triggers" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "required_controls" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "crew_size" integer,
    "supervisor_name" "text",
    "shift_start_time" time without time zone,
    "shift_end_time" time without time zone,
    "source_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "company_jobsite_schedule_items_crew_size_check" CHECK ((("crew_size" IS NULL) OR ("crew_size" >= 0))),
    CONSTRAINT "company_jobsite_schedule_items_date_order" CHECK ((("work_end_date" IS NULL) OR ("work_end_date" >= "work_start_date"))),
    CONSTRAINT "company_jobsite_schedule_items_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_jobsite_schedule_items_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'blocked'::"text", 'completed'::"text", 'archived'::"text"]))),
    CONSTRAINT "company_jobsite_schedule_items_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_jobsite_schedule_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_site_blueprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "source_file_path" "text" NOT NULL,
    "preview_image_path" "text",
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint DEFAULT 0 NOT NULL,
    "page_number" integer DEFAULT 1 NOT NULL,
    "processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "image_width" integer,
    "image_height" integer,
    "transform_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "processing_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "archived_at" timestamp with time zone,
    CONSTRAINT "company_jobsite_site_blueprints_file_name_check" CHECK (("length"(TRIM(BOTH FROM "file_name")) > 0)),
    CONSTRAINT "company_jobsite_site_blueprints_mime_check" CHECK (("mime_type" = ANY (ARRAY['application/pdf'::"text", 'image/png'::"text", 'image/jpeg'::"text", 'image/jpg'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "company_jobsite_site_blueprints_page_check" CHECK ((("page_number" >= 1) AND ("page_number" <= 200))),
    CONSTRAINT "company_jobsite_site_blueprints_size_check" CHECK ((("file_size" >= 0) AND ("file_size" <= 26214400))),
    CONSTRAINT "company_jobsite_site_blueprints_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'uploaded'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_jobsite_site_blueprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_site_maps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "generation_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "prompt_hash" "text",
    "ai_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scene_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "archived_at" timestamp with time zone,
    "blueprint_id" "uuid",
    CONSTRAINT "company_jobsite_site_maps_status_check" CHECK (("generation_status" = ANY (ARRAY['ready'::"text", 'fallback'::"text", 'failed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_jobsite_site_maps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_site_renders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "site_map_id" "uuid",
    "blueprint_id" "uuid",
    "render_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "prompt_hash" "text",
    "image_path" "text",
    "thumbnail_path" "text",
    "image_width" integer,
    "image_height" integer,
    "overlay_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "archived_at" timestamp with time zone,
    CONSTRAINT "company_jobsite_site_renders_image_height_check" CHECK ((("image_height" IS NULL) OR ("image_height" > 0))),
    CONSTRAINT "company_jobsite_site_renders_image_width_check" CHECK ((("image_width" IS NULL) OR ("image_width" > 0))),
    CONSTRAINT "company_jobsite_site_renders_status_check" CHECK (("render_status" = ANY (ARRAY['ready'::"text", 'failed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_jobsite_site_renders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsite_visual_zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "site_map_id" "uuid" NOT NULL,
    "schedule_item_id" "uuid",
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_id" "text",
    "label" "text" NOT NULL,
    "trade" "text",
    "work_area" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "risk_level" "text" DEFAULT 'medium'::"text" NOT NULL,
    "controls" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "color" "text" DEFAULT '#2563eb'::"text" NOT NULL,
    "position_x" numeric DEFAULT 0 NOT NULL,
    "position_y" numeric DEFAULT 0.5 NOT NULL,
    "position_z" numeric DEFAULT 0 NOT NULL,
    "size_x" numeric DEFAULT 4 NOT NULL,
    "size_y" numeric DEFAULT 1 NOT NULL,
    "size_z" numeric DEFAULT 4 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_jobsite_visual_zones_label_nonempty" CHECK (("length"(TRIM(BOTH FROM "label")) > 0)),
    CONSTRAINT "company_jobsite_visual_zones_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_jobsite_visual_zones_size_positive" CHECK ((("size_x" > (0)::numeric) AND ("size_y" > (0)::numeric) AND ("size_z" > (0)::numeric))),
    CONSTRAINT "company_jobsite_visual_zones_source_type_check" CHECK (("source_type" = ANY (ARRAY['schedule'::"text", 'jsa_activity'::"text", 'permit'::"text", 'observation'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."company_jobsite_visual_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jobsites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "project_number" "text",
    "location" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "project_manager" "text",
    "safety_lead" "text",
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "customer_report_email" "text",
    "customer_company_name" "text",
    "audit_customer_id" "uuid",
    "jobsite_number" "text" NOT NULL,
    "zip_code" "text",
    "weather_address_line_1" "text",
    "weather_address_line_2" "text",
    "weather_city" "text",
    "weather_state" "text",
    "weather_country" "text" DEFAULT 'US'::"text",
    "weather_latitude" numeric(9,6),
    "weather_longitude" numeric(9,6),
    "weather_location_source" "text",
    "weather_location_confidence" "text",
    "nws_grid_id" "text",
    "nws_grid_x" integer,
    "nws_grid_y" integer,
    "nws_forecast_url" "text",
    "nws_forecast_hourly_url" "text",
    "weather_enabled" boolean DEFAULT false NOT NULL,
    "weather_last_checked_at" timestamp with time zone,
    CONSTRAINT "company_jobsites_jobsite_number_nonempty" CHECK (("length"(TRIM(BOTH FROM "jobsite_number")) > 0)),
    CONSTRAINT "company_jobsites_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'completed'::"text", 'archived'::"text"]))),
    CONSTRAINT "company_jobsites_weather_latitude_range" CHECK ((("weather_latitude" IS NULL) OR (("weather_latitude" >= ('-90'::integer)::numeric) AND ("weather_latitude" <= (90)::numeric)))),
    CONSTRAINT "company_jobsites_weather_location_confidence_check" CHECK ((("weather_location_confidence" IS NULL) OR ("weather_location_confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))),
    CONSTRAINT "company_jobsites_weather_location_source_check" CHECK ((("weather_location_source" IS NULL) OR ("weather_location_source" = ANY (ARRAY['address'::"text", 'zip_centroid'::"text", 'manual'::"text"])))),
    CONSTRAINT "company_jobsites_weather_longitude_range" CHECK ((("weather_longitude" IS NULL) OR (("weather_longitude" >= ('-180'::integer)::numeric) AND ("weather_longitude" <= (180)::numeric))))
);


ALTER TABLE "public"."company_jobsites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_jsa_signoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jsa_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "signed_by" "uuid",
    "crew_acknowledged" boolean DEFAULT false NOT NULL,
    "supervisor_reviewed" boolean DEFAULT false NOT NULL,
    "signature_text" "text",
    "signature_image_path" "text",
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_jsa_signoffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_leadership_safety_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "score" integer NOT NULL,
    "grade" "text" NOT NULL,
    "trend" integer DEFAULT 0 NOT NULL,
    "last_scored_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "positive_signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "negative_signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "evidence_refs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_leadership_safety_scores_grade_check" CHECK (("grade" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text", 'F'::"text"]))),
    CONSTRAINT "company_leadership_safety_scores_score_check" CHECK ((("score" >= 0) AND ("score" <= 100))),
    CONSTRAINT "company_leadership_safety_scores_window_check" CHECK (("window_end" > "window_start"))
);


ALTER TABLE "public"."company_leadership_safety_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."company_leadership_safety_scores" IS 'Automatic, evidence-backed safety commitment ratings for leadership roles. Intended for coaching and risk reduction, not discipline.';



CREATE TABLE IF NOT EXISTS "public"."company_legal_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "severity" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'Open'::"text" NOT NULL,
    "owner" "text",
    "due_date" "date",
    "client_id" "uuid",
    "linked_document_id" "uuid",
    "description" "text",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_legal_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'company_user'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_memberships_role_check" CHECK (("role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text", 'project_manager'::"text", 'field_supervisor'::"text", 'foreman'::"text", 'field_user'::"text", 'read_only'::"text", 'company_user'::"text"])))
);


ALTER TABLE "public"."company_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_memory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_memory_items_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'document_excerpt'::"text", 'incident_summary'::"text", 'other'::"text", 'document_upload'::"text"])))
);


ALTER TABLE "public"."company_memory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_mobile_feature_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "feature" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_mobile_feature_entitlements_feature_check" CHECK (("feature" = ANY (ARRAY['mobile_dashboard'::"text", 'mobile_jobsites'::"text", 'mobile_jsa'::"text", 'mobile_field_issues'::"text", 'mobile_field_audits'::"text", 'mobile_permits'::"text", 'mobile_incidents'::"text", 'mobile_toolbox'::"text", 'mobile_training'::"text", 'mobile_documents'::"text", 'mobile_safety_intelligence'::"text", 'mobile_reports'::"text", 'mobile_photos'::"text", 'mobile_signatures'::"text"])))
);


ALTER TABLE "public"."company_mobile_feature_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "in_app_enabled" boolean DEFAULT true NOT NULL,
    "email_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_notification_preferences_event_nonempty" CHECK (("length"(TRIM(BOTH FROM "event_type")) > 0))
);


ALTER TABLE "public"."company_notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "href" "text",
    "source_table" "text",
    "source_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_notifications_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_notifications_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_onboarding_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "import_type" "text" NOT NULL,
    "source" "text" DEFAULT 'manual_upload'::"text" NOT NULL,
    "entity_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "accepted_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_onboarding_imports_counts_check" CHECK ((("accepted_count" >= 0) AND ("skipped_count" >= 0))),
    CONSTRAINT "company_onboarding_imports_type_check" CHECK (("import_type" = ANY (ARRAY['employees'::"text", 'jobsites'::"text", 'training_records'::"text", 'mixed'::"text"])))
);


ALTER TABLE "public"."company_onboarding_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_operations_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" DEFAULT 'Operations'::"text" NOT NULL,
    "record_type" "text" DEFAULT 'General'::"text" NOT NULL,
    "status" "text" DEFAULT 'Open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "owner" "text",
    "due_date" "date",
    "description" "text",
    "notes" "text",
    "related_client_id" "uuid",
    "related_document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_operations_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_permit_trigger_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "platform_rule_id" "uuid",
    "permit_code" "text" NOT NULL,
    "trade_code" "text",
    "task_code" "text",
    "hazard_family" "text",
    "work_condition" "text",
    "weather_condition" "text",
    "rationale" "text" NOT NULL,
    "required_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_permit_trigger_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_permits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "permit_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "category" "text" DEFAULT 'corrective_action'::"text" NOT NULL,
    "owner_user_id" "uuid",
    "due_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "sif_flag" boolean DEFAULT false NOT NULL,
    "escalation_level" "text" DEFAULT 'none'::"text" NOT NULL,
    "escalation_reason" "text",
    "stop_work_status" "text" DEFAULT 'normal'::"text" NOT NULL,
    "stop_work_reason" "text",
    "escalated_at" timestamp with time zone,
    "stop_work_at" timestamp with time zone,
    "dap_activity_id" "uuid",
    "observation_id" "uuid",
    "schedule_item_id" "uuid",
    "source_module" "text",
    "source_id" "uuid",
    "auto_assigned" boolean DEFAULT false NOT NULL,
    "auto_assignment_scope" "text",
    "assignment_rationale" "text",
    "source_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "company_permits_auto_assignment_scope_check" CHECK ((("auto_assignment_scope" IS NULL) OR ("auto_assignment_scope" = ANY (ARRAY['daily'::"text", 'weekly'::"text"])))),
    CONSTRAINT "company_permits_escalation_level_check" CHECK (("escalation_level" = ANY (ARRAY['none'::"text", 'monitor'::"text", 'urgent'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_permits_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_permits_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text", 'expired'::"text"]))),
    CONSTRAINT "company_permits_stop_work_status_check" CHECK (("stop_work_status" = ANY (ARRAY['normal'::"text", 'stop_work_requested'::"text", 'stop_work_active'::"text", 'cleared'::"text"])))
);


ALTER TABLE "public"."company_permits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_permits_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_permits_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "department" "text" DEFAULT 'Leadership'::"text" NOT NULL,
    "parent_position_id" "uuid",
    "status" "text" DEFAULT 'Needed'::"text" NOT NULL,
    "employee_name" "text",
    "employee_email" "text",
    "employee_phone" "text",
    "portal_user_id" "uuid",
    "job_description" "text",
    "salary_min" numeric(12,2),
    "salary_max" numeric(12,2),
    "salary_period" "text" DEFAULT 'Annual'::"text",
    "employment_type" "text" DEFAULT 'Full-time'::"text",
    "location" "text",
    "hiring_priority" "text" DEFAULT 'Medium'::"text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "company_positions_status_check" CHECK (("status" = ANY (ARRAY['Filled'::"text", 'Open'::"text", 'Needed'::"text", 'On Hold'::"text"])))
);


ALTER TABLE "public"."company_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_report_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "report_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_report_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "title" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "source_module" "text" DEFAULT 'operations'::"text" NOT NULL,
    "file_path" "text",
    "generated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_reports_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."company_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_risk_ai_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "kind" "text" DEFAULT 'insight'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "confidence" numeric DEFAULT 0.5 NOT NULL,
    "context_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dismissed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "owner_user_id" "uuid",
    "due_at" timestamp with time zone,
    "target_module" "text",
    "target_href" "text",
    "evidence_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "accepted_at" timestamp with time zone,
    "field_used_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "action_type" "text" DEFAULT 'assign'::"text" NOT NULL,
    "linked_module" "text",
    "linked_record_id" "uuid",
    "verification_required" boolean DEFAULT true NOT NULL,
    "mitigation_state" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "risk_reduction_points" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "company_risk_ai_recommendations_action_type_check" CHECK (("action_type" = ANY (ARRAY['assign'::"text", 'request_documentation'::"text", 'request_inspection'::"text", 'create_corrective_action'::"text", 'request_permit'::"text", 'accountability_review'::"text", 'stop_work_review'::"text"]))),
    CONSTRAINT "company_risk_ai_recommendations_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "company_risk_ai_recommendations_linked_module_check" CHECK ((("linked_module" IS NULL) OR ("linked_module" = ANY (ARRAY['risk_recommendation'::"text", 'corrective_action'::"text", 'permit'::"text", 'auditflow_assignment'::"text", 'documentation_request'::"text", 'accountability_review'::"text", 'stop_work_review'::"text"])))),
    CONSTRAINT "company_risk_ai_recommendations_mitigation_state_check" CHECK (("mitigation_state" = ANY (ARRAY['unverified'::"text", 'assigned'::"text", 'documentation_requested'::"text", 'inspection_requested'::"text", 'linked_action_created'::"text", 'evidence_uploaded'::"text", 'field_verified'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "company_risk_ai_recommendations_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_risk_ai_recommendations_risk_reduction_points_check" CHECK ((("risk_reduction_points" >= 0) AND ("risk_reduction_points" <= 25))),
    CONSTRAINT "company_risk_ai_recommendations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'accepted'::"text", 'assigned'::"text", 'field_used'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "company_risk_ai_recommendations_target_module_check" CHECK ((("target_module" IS NULL) OR ("target_module" = ANY (ARRAY['predictive_risk'::"text", 'field_issue'::"text", 'corrective_action'::"text", 'incident'::"text", 'permit'::"text", 'jsa'::"text", 'training'::"text", 'jobsite'::"text", 'risk_memory'::"text", 'command_center'::"text"])))),
    CONSTRAINT "company_risk_ai_recommendations_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_risk_ai_recommendations" OWNER TO "postgres";


COMMENT ON TABLE "public"."company_risk_ai_recommendations" IS 'Rule-based or future LLM-generated risk recommendations for the workspace.';



COMMENT ON COLUMN "public"."company_risk_ai_recommendations"."status" IS 'AI Risk Action Loop workflow state for supervisor triage and follow-through.';



COMMENT ON COLUMN "public"."company_risk_ai_recommendations"."evidence_summary" IS 'Bounded evidence references and source coverage used to justify the recommendation.';



COMMENT ON COLUMN "public"."company_risk_ai_recommendations"."action_type" IS 'Suggested supervisor follow-up action generated by deterministic rules or AI.';



COMMENT ON COLUMN "public"."company_risk_ai_recommendations"."mitigation_state" IS 'Conservative follow-through state used to decide whether risk reduction credit can be shown.';



COMMENT ON COLUMN "public"."company_risk_ai_recommendations"."risk_reduction_points" IS 'Deterministic mitigation credit. Generated or assigned actions remain 0 until field use or resolution is verified.';



CREATE TABLE IF NOT EXISTS "public"."company_risk_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "module_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "detail" "text",
    "event_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_risk_events_module_check" CHECK (("module_name" = ANY (ARRAY['permits'::"text", 'incidents'::"text", 'corrective_actions'::"text", 'jsa_activity'::"text", 'sor_record'::"text", 'risk_memory'::"text", 'inductions'::"text", 'toolbox'::"text", 'contractor_prequal'::"text", 'sds'::"text", 'safety_forms'::"text", 'integrations'::"text"])))
);


ALTER TABLE "public"."company_risk_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_risk_memory_facets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "source_module" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "scope_of_work_code" "text",
    "trade_code" "text",
    "primary_hazard_code" "text",
    "secondary_hazard_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "root_cause_level1" "text",
    "root_cause_level2" "text",
    "failed_control_code" "text",
    "weather_condition_code" "text",
    "potential_severity_code" "text",
    "actual_outcome_severity_code" "text",
    "contractor_label" "text",
    "location_area" "text",
    "time_of_day_band" "text",
    "permit_status_summary" "text",
    "ppe_status_summary" "text",
    "corrective_action_status" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contractor_id" "uuid",
    "behavior_category" "text",
    "training_status" "text",
    "supervision_status" "text",
    "equipment_type" "text",
    "cost_impact_band" "text",
    "forecast_confidence" numeric,
    "location_grid" "text",
    "crew_id" "uuid",
    "sub_trade_code" "text",
    "task_code" "text",
    CONSTRAINT "company_risk_memory_facets_cost_impact_check" CHECK ((("cost_impact_band" IS NULL) OR ("cost_impact_band" = ANY (ARRAY['none'::"text", 'low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))),
    CONSTRAINT "company_risk_memory_facets_forecast_confidence_check" CHECK ((("forecast_confidence" IS NULL) OR (("forecast_confidence" >= (0)::numeric) AND ("forecast_confidence" <= (1)::numeric)))),
    CONSTRAINT "company_risk_memory_facets_source_module_check" CHECK (("source_module" = ANY (ARRAY['incident'::"text", 'corrective_action'::"text", 'jsa_activity'::"text", 'permit'::"text", 'sor_record'::"text"])))
);


ALTER TABLE "public"."company_risk_memory_facets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_risk_memory_facets"."behavior_category" IS 'Phase 2: human performance / learning dimension; use carefully for culture not blame.';



COMMENT ON COLUMN "public"."company_risk_memory_facets"."crew_id" IS 'Optional FK to company_crews; validated against company and jobsite compatibility.';



COMMENT ON COLUMN "public"."company_risk_memory_facets"."sub_trade_code" IS 'Optional shared taxonomy sub-trade code scoped under trade_code.';



COMMENT ON COLUMN "public"."company_risk_memory_facets"."task_code" IS 'Optional shared taxonomy task code scoped under trade_code and sub_trade_code.';



CREATE TABLE IF NOT EXISTS "public"."company_risk_memory_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "snapshot_date" "date" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_risk_memory_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_risk_recommendation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "recommendation_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "actor_user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_risk_recommendation_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'accepted'::"text", 'assigned'::"text", 'field_used'::"text", 'resolved'::"text", 'dismissed'::"text", 'feedback'::"text", 'documentation_requested'::"text", 'inspection_requested'::"text", 'corrective_action_created'::"text", 'permit_requested'::"text", 'accountability_review_requested'::"text", 'stop_work_review_requested'::"text"])))
);


ALTER TABLE "public"."company_risk_recommendation_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."company_risk_recommendation_events" IS 'Append-only audit and learning events for AI risk recommendations.';



CREATE TABLE IF NOT EXISTS "public"."company_risk_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "bucket_run_id" "uuid",
    "bucket_item_id" "uuid",
    "score_scope" "public"."si_score_scope" DEFAULT 'task'::"public"."si_score_scope" NOT NULL,
    "score" numeric(6,2) NOT NULL,
    "band" "public"."si_risk_band" NOT NULL,
    "score_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "score_window_days" integer DEFAULT 30 NOT NULL,
    "trade_code" "text",
    "task_code" "text",
    "work_area_id" "uuid",
    "components" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trend_hints" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_risk_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_rule_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "precedence" integer DEFAULT 200 NOT NULL,
    "version" "text" DEFAULT '2026-04-14'::"text" NOT NULL,
    "merge_behavior" "text" DEFAULT 'extend'::"text" NOT NULL,
    "selectors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "outputs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_rule_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_safety_form_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_safety_form_definitions_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_safety_form_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_safety_form_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_by" "uuid",
    CONSTRAINT "company_safety_form_submissions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."company_safety_form_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_safety_form_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "definition_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "schema" "jsonb" DEFAULT '{"fields": []}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_safety_form_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_safety_intelligence_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text",
    "event_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload_storage_path" "text"
);


ALTER TABLE "public"."company_safety_intelligence_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_safety_intelligence_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "entity_table" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "change_type" "text" NOT NULL,
    "before_state" "jsonb",
    "after_state" "jsonb",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "uuid",
    "old_record_storage_path" "text",
    "new_record_storage_path" "text"
);


ALTER TABLE "public"."company_safety_intelligence_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_safety_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "photo_path" "text",
    "submitted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text" DEFAULT 'hazard'::"text" NOT NULL,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "linked_action_id" "uuid",
    "created_by" "uuid",
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "hash" "text",
    "fatality" boolean DEFAULT false NOT NULL,
    "idlh_flag" boolean DEFAULT false NOT NULL,
    "sif_flag" boolean DEFAULT false NOT NULL,
    "stop_work_status" "text" DEFAULT 'normal'::"text" NOT NULL,
    CONSTRAINT "company_safety_submissions_category_check" CHECK (("category" = ANY (ARRAY['hazard'::"text", 'near_miss'::"text", 'incident'::"text", 'good_catch'::"text", 'ppe_violation'::"text", 'housekeeping'::"text", 'equipment_issue'::"text", 'fall_hazard'::"text", 'electrical_hazard'::"text", 'excavation_trench_concern'::"text", 'fire_hot_work_concern'::"text", 'corrective_action'::"text"]))),
    CONSTRAINT "company_safety_submissions_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "company_safety_submissions_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "company_safety_submissions_stop_work_status_check" CHECK (("stop_work_status" = ANY (ARRAY['normal'::"text", 'stop_work_requested'::"text", 'stop_work_active'::"text", 'cleared'::"text"]))),
    CONSTRAINT "company_safety_submissions_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_safety_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_sales_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "activity_type" "text" DEFAULT 'Note'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "activity_date" "date",
    "owner" "text",
    "outcome" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_sales_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_schedule_prediction_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "input_fingerprint" "text" NOT NULL,
    "prediction_date" "date" NOT NULL,
    "status" "text" DEFAULT 'ok'::"text" NOT NULL,
    "ai_payload" "jsonb",
    "ai_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_schedule_prediction_cache_fingerprint_nonempty" CHECK (("length"(TRIM(BOTH FROM "input_fingerprint")) > 0)),
    CONSTRAINT "company_schedule_prediction_cache_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'fallback'::"text"])))
);


ALTER TABLE "public"."company_schedule_prediction_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "actor_user_id" "uuid",
    "actor_role" "text",
    "event_type" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text",
    "title" "text" NOT NULL,
    "detail" "text",
    "ip_address" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_security_events_event_type_not_blank" CHECK (("length"(TRIM(BOTH FROM "event_type")) > 0)),
    CONSTRAINT "company_security_events_resource_type_not_blank" CHECK (("length"(TRIM(BOTH FROM "resource_type")) > 0)),
    CONSTRAINT "company_security_events_title_not_blank" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."company_security_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_signup_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "industry" "text",
    "phone" "text",
    "website" "text",
    "address_line_1" "text",
    "city" "text",
    "state_region" "text",
    "postal_code" "text",
    "country" "text",
    "primary_contact_name" "text" NOT NULL,
    "primary_contact_email" "text" NOT NULL,
    "requested_role" "text" DEFAULT 'company_admin'::"text" NOT NULL,
    "account_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "notes" "text",
    "owner_user_id" "uuid",
    CONSTRAINT "company_signup_requests_account_status_check" CHECK (("account_status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text"]))),
    CONSTRAINT "company_signup_requests_role_check" CHECK (("requested_role" = ANY (ARRAY['company_owner'::"text", 'company_admin'::"text"]))),
    CONSTRAINT "company_signup_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."company_signup_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_simultaneous_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "company_task_id" "uuid",
    "bucket_item_id" "uuid",
    "work_area_id" "uuid",
    "operation_label" "text" NOT NULL,
    "trade_code" "text",
    "sub_trade_code" "text",
    "task_code" "text",
    "task_title" "text" NOT NULL,
    "hazard_families" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "permit_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "weather_sensitive" boolean DEFAULT false NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_simultaneous_operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_sor_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "project" "text" NOT NULL,
    "location" "text" NOT NULL,
    "trade" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text",
    "description" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "previous_version_id" "uuid",
    "record_hash" "text",
    "previous_hash" "text",
    "change_reason" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "hazard_category_code" "text",
    "prediction_validation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "prediction_review_rating" integer,
    "prediction_review_notes" "text",
    "prediction_review_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "prediction_reviewed_by" "uuid",
    "prediction_reviewed_at" timestamp with time zone,
    CONSTRAINT "company_sor_records_hazard_category_code_check" CHECK ((("hazard_category_code" IS NULL) OR ("hazard_category_code" = ANY (ARRAY['falls_same_level'::"text", 'falls_elevation'::"text", 'struck_by'::"text", 'caught_in_between'::"text", 'overexertion'::"text", 'contact_equipment'::"text", 'hazardous_substance'::"text", 'electrical'::"text", 'material_handling'::"text", 'ppe_behavioral'::"text", 'environmental'::"text", 'other'::"text"])))),
    CONSTRAINT "company_sor_records_prediction_approved_rating_check" CHECK ((("prediction_validation_status" <> 'approved'::"text") OR ("prediction_review_rating" IS NOT NULL))),
    CONSTRAINT "company_sor_records_prediction_review_rating_check" CHECK ((("prediction_review_rating" IS NULL) OR (("prediction_review_rating" >= 1) AND ("prediction_review_rating" <= 5)))),
    CONSTRAINT "company_sor_records_prediction_validation_status_check" CHECK (("prediction_validation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "company_sor_records_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'locked'::"text", 'superseded'::"text"]))),
    CONSTRAINT "company_sor_records_version_positive" CHECK (("version_number" >= 1))
);


ALTER TABLE "public"."company_sor_records" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_sor_records"."hazard_category_code" IS 'Normalized hazard class for SOR; correlates to incident exposure_event_type for prediction analytics.';



CREATE TABLE IF NOT EXISTS "public"."company_sub_trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_trade_id" "uuid" NOT NULL,
    "platform_sub_trade_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_sub_trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "plan_name" "text",
    "credit_balance" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "max_user_seats" integer,
    "subscription_price_cents" integer,
    "seat_price_cents" integer,
    "plan_tier_key" "text",
    "annual_platform_price_cents" integer,
    "included_jobsite_limit" integer,
    "included_user_limit" integer,
    "included_page_credits" integer,
    "onboarding_fee_cents" integer,
    "enabled_feature_keys" "jsonb",
    "selected_addons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "commercial_notes" "text",
    CONSTRAINT "company_subscriptions_annual_platform_price_cents_check" CHECK ((("annual_platform_price_cents" IS NULL) OR ("annual_platform_price_cents" >= 0))),
    CONSTRAINT "company_subscriptions_enabled_feature_keys_array_check" CHECK ((("enabled_feature_keys" IS NULL) OR ("jsonb_typeof"("enabled_feature_keys") = 'array'::"text"))),
    CONSTRAINT "company_subscriptions_included_jobsite_limit_check" CHECK ((("included_jobsite_limit" IS NULL) OR ("included_jobsite_limit" >= 0))),
    CONSTRAINT "company_subscriptions_included_page_credits_check" CHECK ((("included_page_credits" IS NULL) OR ("included_page_credits" >= 0))),
    CONSTRAINT "company_subscriptions_included_user_limit_check" CHECK ((("included_user_limit" IS NULL) OR ("included_user_limit" >= 0))),
    CONSTRAINT "company_subscriptions_max_user_seats_check" CHECK ((("max_user_seats" IS NULL) OR ("max_user_seats" >= 1))),
    CONSTRAINT "company_subscriptions_onboarding_fee_cents_check" CHECK ((("onboarding_fee_cents" IS NULL) OR ("onboarding_fee_cents" >= 0))),
    CONSTRAINT "company_subscriptions_seat_price_cents_check" CHECK ((("seat_price_cents" IS NULL) OR ("seat_price_cents" >= 0))),
    CONSTRAINT "company_subscriptions_selected_addons_array_check" CHECK (("jsonb_typeof"("selected_addons") = 'array'::"text")),
    CONSTRAINT "company_subscriptions_subscription_price_cents_check" CHECK ((("subscription_price_cents" IS NULL) OR ("subscription_price_cents" >= 0)))
);


ALTER TABLE "public"."company_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_subscriptions"."max_user_seats" IS 'Maximum company users + pending invites; null means no cap.';



COMMENT ON COLUMN "public"."company_subscriptions"."subscription_price_cents" IS 'Optional override for the recurring subscription price in cents. Null uses the default plan price.';



COMMENT ON COLUMN "public"."company_subscriptions"."seat_price_cents" IS 'Optional override for per-user seat/license pricing in cents. Null uses the default plan price.';



COMMENT ON COLUMN "public"."company_subscriptions"."plan_tier_key" IS 'Internal enterprise tier label assigned by platform admins.';



COMMENT ON COLUMN "public"."company_subscriptions"."annual_platform_price_cents" IS 'Annual platform contract price in integer cents used for admin draft invoices.';



COMMENT ON COLUMN "public"."company_subscriptions"."included_jobsite_limit" IS 'Number of active jobsites included in the company contract.';



COMMENT ON COLUMN "public"."company_subscriptions"."included_user_limit" IS 'Number of active or pending users/invites included in the company contract.';



COMMENT ON COLUMN "public"."company_subscriptions"."included_page_credits" IS 'Annual document page credits included in the company contract.';



COMMENT ON COLUMN "public"."company_subscriptions"."enabled_feature_keys" IS 'Manual company feature entitlement keys selected by platform admins. Null means legacy/unconfigured.';



CREATE TABLE IF NOT EXISTS "public"."company_task_controls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_task_id" "uuid" NOT NULL,
    "company_control_id" "uuid",
    "control_code" "text" NOT NULL,
    "requirement_source" "text" DEFAULT 'task'::"text" NOT NULL,
    "status" "public"."si_control_status" DEFAULT 'required'::"public"."si_control_status" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_task_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_task_hazards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_task_id" "uuid" NOT NULL,
    "company_hazard_id" "uuid",
    "hazard_code" "text" NOT NULL,
    "hazard_family" "text" NOT NULL,
    "source" "text" DEFAULT 'task'::"text" NOT NULL,
    "severity_hint" "text" DEFAULT 'medium'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_task_hazards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_task_permit_triggers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_task_id" "uuid" NOT NULL,
    "company_permits_catalog_id" "uuid",
    "permit_code" "text" NOT NULL,
    "trigger_source" "text" DEFAULT 'task'::"text" NOT NULL,
    "trigger_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_task_permit_triggers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_task_training_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_task_id" "uuid" NOT NULL,
    "company_training_matrix_requirement_id" "uuid",
    "requirement_code" "text" NOT NULL,
    "requirement_source" "text" DEFAULT 'task'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_task_training_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "company_trade_id" "uuid",
    "company_sub_trade_id" "uuid",
    "platform_task_template_id" "uuid",
    "source_module" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_id" "uuid",
    "code" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "equipment_used" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "work_conditions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hazard_families" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "required_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "permit_triggers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "training_requirements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "weather_sensitivity" "public"."si_weather_sensitivity" DEFAULT 'medium'::"public"."si_weather_sensitivity" NOT NULL,
    "crew_size" integer,
    "work_area_label" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "status" "public"."si_task_status" DEFAULT 'planned'::"public"."si_task_status" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_tasks_time_window_check" CHECK ((("ends_at" IS NULL) OR ("starts_at" IS NULL) OR ("ends_at" >= "starts_at")))
);


ALTER TABLE "public"."company_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_toolbox_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "guest_name" "text",
    "signed_at" timestamp with time zone,
    "signature_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_toolbox_attendees_subject_check" CHECK ((("user_id" IS NOT NULL) OR (("guest_name" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "guest_name")) > 0))))
);


ALTER TABLE "public"."company_toolbox_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_toolbox_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "conducted_by" "uuid",
    "conducted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "linked_corrective_action_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_toolbox_sessions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."company_toolbox_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_toolbox_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "topics" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "trade_tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "company_toolbox_templates_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."company_toolbox_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "platform_trade_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "hazard_families" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "required_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "permit_triggers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "training_requirements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_training_matrix_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "requirement_code" "text" NOT NULL,
    "trade_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "task_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "position_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "match_keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_training_matrix_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_training_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "match_keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "match_fields" "text"[] DEFAULT ARRAY['certifications'::"text"] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "apply_trades" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "apply_positions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "renewal_months" integer,
    "apply_sub_trades" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "apply_task_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_generated" boolean DEFAULT false NOT NULL,
    "generated_source_type" "text",
    "generated_source_document_id" "uuid",
    "generated_source_operation_key" "text",
    "category" "text",
    "description" "text",
    "renewal_period_days" integer,
    "owner_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "version" "text" DEFAULT 'Current'::"text" NOT NULL,
    "requires_evidence" boolean DEFAULT true NOT NULL,
    "required_because" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "company_training_requirements_renewal_period_days_check" CHECK ((("renewal_period_days" IS NULL) OR ("renewal_period_days" > 0)))
);


ALTER TABLE "public"."company_training_requirements" OWNER TO "postgres";


COMMENT ON COLUMN "public"."company_training_requirements"."apply_trades" IS 'Empty = applies to all trades; otherwise profile trade_specialty must match one value (case-insensitive).';



COMMENT ON COLUMN "public"."company_training_requirements"."apply_positions" IS 'Empty = applies to all positions; otherwise profile job_title must match one value (case-insensitive).';



COMMENT ON COLUMN "public"."company_training_requirements"."renewal_months" IS 'Optional typical renewal period in months (company policy hint). Null if not set. Valid range enforced in application (1–600).';



COMMENT ON COLUMN "public"."company_training_requirements"."required_because" IS 'Optional explicit Stage 1 reasons; app still derives reasons from role, trade, site/task, and permit context when empty.';



CREATE TABLE IF NOT EXISTS "public"."company_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "display_name" "text",
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "company_users_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."company_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_weather_conditions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "observation_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "condition_code" "text" DEFAULT 'clear'::"text" NOT NULL,
    "temperature_c" numeric(5,2),
    "wind_kph" numeric(5,2),
    "lightning_risk" "text",
    "precipitation_mm" numeric(7,2),
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."company_weather_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_work_areas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "area_type" "text" DEFAULT 'work_zone'::"text" NOT NULL,
    "location_grid" "text",
    "parent_area_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."company_work_areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."corrective_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "observation_id" "uuid",
    "source_dap_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_company_user_id" "uuid",
    "due_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "verified_by_company_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "corrective_actions_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "corrective_actions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'assigned'::"text", 'in_progress'::"text", 'corrected'::"text", 'verified_closed'::"text", 'escalated'::"text", 'stop_work'::"text"])))
);


ALTER TABLE "public"."corrective_actions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_corrective_actions" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "jobsite_id",
    "observation_id",
    "title",
    "description",
    "category",
    "severity",
    "status",
    "due_at",
    "closed_at",
    "created_at",
    "updated_at"
   FROM "public"."corrective_actions" "ca";


ALTER VIEW "public"."compat_company_corrective_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "created_by_company_user_id" "uuid",
    "owner_company_user_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_date" "date",
    "created_by" "uuid",
    "supervisor_name" "text",
    "weather_summary" "text",
    "overall_risk_level" "text",
    "signed_by" "uuid",
    "signed_at" timestamp with time zone,
    CONSTRAINT "daps_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "daps_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."daps" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_daps" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    NULL::"uuid" AS "jobsite_id",
    "title",
    "description",
    "status",
    "severity",
    "due_at",
    "created_at",
    "updated_at"
   FROM "public"."daps" "d";


ALTER VIEW "public"."compat_company_daps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "project_name" "text" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "form_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "draft_file_path" "text",
    "final_file_path" "text",
    "review_notes" "text",
    "reviewer_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "approved_by_email" "text",
    "marketplace_updated_at" timestamp with time zone,
    "marketplace_updated_by" "uuid",
    "marketplace_updated_by_email" "text",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "archived_by_email" "text",
    "restored_at" timestamp with time zone,
    "restored_by" "uuid",
    "restored_by_email" "text",
    "notes" "text",
    "file_path" "text",
    "company_id" "uuid",
    "title" "text",
    "document_title" "text",
    "category" "text",
    "file_name" "text",
    "file_size" bigint,
    "uploaded_by" "text",
    "generated_document_id" "uuid"
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_documents" WITH ("security_invoker"='true') AS
 SELECT "id",
    NULL::"uuid" AS "company_id",
    NULL::"uuid" AS "jobsite_id",
    NULL::"text" AS "title",
    NULL::"text" AS "document_type",
    NULL::"text" AS "status",
    NULL::integer AS "current_version",
    "created_at",
    "updated_at"
   FROM "public"."documents" "d";


ALTER VIEW "public"."compat_company_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'incident'::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "occurred_at" timestamp with time zone,
    "reported_by_company_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "observation_id" "uuid",
    "incident_type" "text",
    "root_cause" "text",
    "reported_by" "uuid",
    "reported_at" timestamp with time zone,
    CONSTRAINT "incidents_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "incidents_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."incidents" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_incidents" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "jobsite_id",
    "title",
    "description",
    "category",
    "severity",
    "status",
    "occurred_at",
    "created_at",
    "updated_at"
   FROM "public"."incidents" "i";


ALTER VIEW "public"."compat_company_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobsites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "project_number" "text",
    "location" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "address" "text",
    CONSTRAINT "jobsites_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."jobsites" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_jobsites" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "name",
    "project_number",
    "location",
    "status",
    "start_date",
    "end_date",
    "notes",
    "created_at",
    "updated_at"
   FROM "public"."jobsites" "j";


ALTER VIEW "public"."compat_company_jobsites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "observer_company_user_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "category" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "occurred_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dap_activity_id" "uuid",
    "observed_at" timestamp with time zone,
    "observer_id" "uuid",
    "trade" "text",
    "area" "text",
    "activity_name" "text",
    "hazard_category" "text",
    "observation_type" "text",
    "risk_level" "text",
    "sif_potential" boolean DEFAULT false NOT NULL,
    "sif_category" "text",
    "responsible_party" "text",
    "corrective_action" "text",
    "identified_at" timestamp with time zone,
    "corrected_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    CONSTRAINT "observations_observation_type_check" CHECK ((("observation_type" IS NULL) OR ("observation_type" = ANY (ARRAY['positive'::"text", 'negative'::"text", 'near_miss'::"text"])))),
    CONSTRAINT "observations_risk_level_check" CHECK ((("risk_level" IS NULL) OR ("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))),
    CONSTRAINT "observations_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "observations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'assigned'::"text", 'in_progress'::"text", 'corrected'::"text", 'verified_closed'::"text", 'escalated'::"text", 'stop_work'::"text"])))
);


ALTER TABLE "public"."observations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_observations" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "jobsite_id",
    "title",
    "description",
    "severity",
    "category",
    "status",
    "created_at",
    "updated_at"
   FROM "public"."observations" "o";


ALTER VIEW "public"."compat_company_observations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "permit_type_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "requested_by_company_user_id" "uuid",
    "approved_by_company_user_id" "uuid",
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dap_activity_id" "uuid",
    "permit_type" "text",
    "issued_to" "text",
    "issued_by" "uuid",
    "issued_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    CONSTRAINT "permits_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "permits_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."permits" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_permits" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "jobsite_id",
    "permit_type_id",
    "title",
    "status",
    "severity",
    "valid_from",
    "valid_to",
    "created_at",
    "updated_at"
   FROM "public"."permits" "p";


ALTER VIEW "public"."compat_company_permits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "report_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by_company_user_id" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_reports_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."daily_reports" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_reports" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "jobsite_id",
    "title",
    "status",
    "report_date",
    "published_at",
    "created_at",
    "updated_at"
   FROM "public"."daily_reports" "dr";


ALTER VIEW "public"."compat_company_reports" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."compat_company_users" WITH ("security_invoker"='true') AS
 SELECT "id",
    "company_id",
    "user_id",
    "role",
    "status" AS "account_status",
    "display_name",
    "title",
    "created_at",
    "updated_at"
   FROM "public"."company_users" "cu";


ALTER VIEW "public"."compat_company_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_employee_intake_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token_hash" "text" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "contractor_employee_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."contractor_employee_intake_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_employee_jobsite_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "contractor_id" "uuid",
    "contractor_employee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "contractor_employee_jobsite_assignments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."contractor_employee_jobsite_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_employee_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "email_normalized" "text",
    "phone" "text",
    "phone_normalized" "text",
    "contractor_company_name" "text",
    "trade_specialty" "text",
    "job_title" "text",
    "readiness_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "years_experience" integer,
    "certifications" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "certification_expirations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "contractor_employee_profiles_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "full_name")) > 0)),
    CONSTRAINT "contractor_employee_profiles_readiness_check" CHECK (("readiness_status" = ANY (ARRAY['ready'::"text", 'travel_ready'::"text", 'limited'::"text", 'needs_training'::"text", 'onboarding'::"text"]))),
    CONSTRAINT "contractor_employee_profiles_years_check" CHECK ((("years_experience" IS NULL) OR ("years_experience" >= 0)))
);


ALTER TABLE "public"."contractor_employee_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_employee_training_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contractor_employee_id" "uuid" NOT NULL,
    "requirement_id" "uuid",
    "title" "text" NOT NULL,
    "completed_on" "date",
    "expires_on" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "contractor_employee_training_records_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."contractor_employee_training_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dap_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dap_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "detail" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by_company_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trade" "text",
    "activity_name" "text",
    "area" "text",
    "crew_size" integer,
    "hazard_category" "text",
    "hazard_description" "text",
    "mitigation" "text",
    "permit_required" boolean,
    "permit_type" "text",
    "planned_risk_level" "text"
);


ALTER TABLE "public"."dap_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "company" "text",
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "text",
    "company_type" "text",
    "interested_products" "text"[],
    "message" "text",
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."demo_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_downloads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "owner_user_id" "uuid",
    "file_kind" "text" NOT NULL,
    "downloaded_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ip_address" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "document_downloads_file_kind_check" CHECK (("file_kind" = ANY (ARRAY['draft'::"text", 'final'::"text"])))
);


ALTER TABLE "public"."document_downloads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "storage_bucket" "text" DEFAULT 'documents'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "checksum" "text",
    "change_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_company_user_id" "uuid"
);


ALTER TABLE "public"."document_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_document_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "due_date" "date",
    "assigned_by" "uuid",
    "signed_at" timestamp with time zone,
    "waived_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_document_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_document_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "template_version" integer NOT NULL,
    "document_title" "text" NOT NULL,
    "document_body" "text" NOT NULL,
    "source_document_id" "uuid",
    "source_file_path" "text",
    "typed_legal_name" "text" NOT NULL,
    "consented" boolean DEFAULT false NOT NULL,
    "signer_email" "text",
    "signer_ip" "text",
    "signer_user_agent" "text",
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_document_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_pay_rates" (
    "user_id" "uuid" NOT NULL,
    "hourly_rate" numeric(10,2) DEFAULT 75 NOT NULL,
    "effective_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_pay_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_profiles" (
    "user_id" "uuid" NOT NULL,
    "legal_name" "text",
    "phone" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "emergency_contact_relationship" "text",
    "onboarding_status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "onboarding_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "display_name" "text",
    "email" "text",
    "profile_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "time_card_role_id" "uuid"
);


ALTER TABLE "public"."employee_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_time_card_payroll" (
    "time_card_id" "uuid" NOT NULL,
    "hourly_rate" numeric(10,2) DEFAULT 75 NOT NULL,
    "total_hours" numeric(10,2) DEFAULT 0 NOT NULL,
    "paid_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_time_card_payroll" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_time_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_user_id" "uuid",
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "source" "text" DEFAULT 'portal'::"text" NOT NULL,
    "import_key" "text",
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_time_cards_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "employee_time_cards_week_check" CHECK (("week_end" = ("week_start" + 6)))
);


ALTER TABLE "public"."employee_time_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_card_id" "uuid" NOT NULL,
    "work_date" "date" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "hours" numeric(5,2) NOT NULL,
    "notes" "text",
    "source_status" "text",
    "import_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_time_entries_hours_check" CHECK ((("hours" > (0)::numeric) AND ("hours" <= (24)::numeric)))
);


ALTER TABLE "public"."employee_time_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gus_generated_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "jobsite_id" "uuid",
    "plan_type" "text" NOT NULL,
    "plan_title" "text" NOT NULL,
    "plan_content" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft_incomplete'::"text" NOT NULL,
    "human_review_required" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gus_generated_plans_jobsite_requires_company" CHECK ((("jobsite_id" IS NULL) OR ("company_id" IS NOT NULL))),
    CONSTRAINT "gus_generated_plans_plan_content_object" CHECK (("jsonb_typeof"("plan_content") = 'object'::"text")),
    CONSTRAINT "gus_generated_plans_plan_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "plan_title")) > 0)),
    CONSTRAINT "gus_generated_plans_plan_type_nonempty" CHECK (("length"(TRIM(BOTH FROM "plan_type")) > 0)),
    CONSTRAINT "gus_generated_plans_status_check" CHECK (("status" = ANY (ARRAY['draft_incomplete'::"text", 'draft_ready_for_review'::"text", 'needs_supervisor_review'::"text", 'needs_competent_person_review'::"text", 'needs_qualified_person_review'::"text", 'blocked_missing_critical_info'::"text"])))
);


ALTER TABLE "public"."gus_generated_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gus_planning_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gus_planning_messages_message_nonempty" CHECK (("length"(TRIM(BOTH FROM "message")) > 0)),
    CONSTRAINT "gus_planning_messages_metadata_object" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "gus_planning_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'gus'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."gus_planning_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gus_planning_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "jobsite_id" "uuid",
    "user_id" "uuid",
    "work_type" "text" NOT NULL,
    "detected_modules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "task_description" "text",
    "status" "text" DEFAULT 'draft_incomplete'::"text" NOT NULL,
    "plan_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "missing_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "risk_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "human_review_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gus_planning_sessions_detected_modules_array" CHECK (("jsonb_typeof"("detected_modules") = 'array'::"text")),
    CONSTRAINT "gus_planning_sessions_has_owner_scope" CHECK ((("company_id" IS NOT NULL) OR ("user_id" IS NOT NULL))),
    CONSTRAINT "gus_planning_sessions_jobsite_requires_company" CHECK ((("jobsite_id" IS NULL) OR ("company_id" IS NOT NULL))),
    CONSTRAINT "gus_planning_sessions_missing_items_array" CHECK (("jsonb_typeof"("missing_items") = 'array'::"text")),
    CONSTRAINT "gus_planning_sessions_plan_data_object" CHECK (("jsonb_typeof"("plan_data") = 'object'::"text")),
    CONSTRAINT "gus_planning_sessions_risk_flags_array" CHECK (("jsonb_typeof"("risk_flags") = 'array'::"text")),
    CONSTRAINT "gus_planning_sessions_status_check" CHECK (("status" = ANY (ARRAY['draft_incomplete'::"text", 'draft_ready_for_review'::"text", 'needs_supervisor_review'::"text", 'needs_competent_person_review'::"text", 'needs_qualified_person_review'::"text", 'blocked_missing_critical_info'::"text"]))),
    CONSTRAINT "gus_planning_sessions_work_type_nonempty" CHECK (("length"(TRIM(BOTH FROM "work_type")) > 0))
);


ALTER TABLE "public"."gus_planning_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hazard_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hazard_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hr_document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" DEFAULT 'People / HR'::"text" NOT NULL,
    "body_text" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "source_document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hr_document_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incident_notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "source_table" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "recipient_email" "text",
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "dedupe_key" "text" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "incident_notification_deliveries_channel_check" CHECK (("channel" = ANY (ARRAY['in_app'::"text", 'email'::"text"]))),
    CONSTRAINT "incident_notification_deliveries_source_check" CHECK (("source_table" = ANY (ARRAY['company_incidents'::"text", 'company_safety_submissions'::"text"]))),
    CONSTRAINT "incident_notification_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'skipped'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."incident_notification_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incident_root_causes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "cause_category" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_company_user_id" "uuid"
);


ALTER TABLE "public"."incident_root_causes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingestion_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "source_type" "public"."si_ingestion_source_type" NOT NULL,
    "source_record_id" "text",
    "validation_status" "public"."si_ingestion_validation_status" NOT NULL,
    "insert_status" "public"."si_ingestion_insert_status" DEFAULT 'pending'::"public"."si_ingestion_insert_status" NOT NULL,
    "validation_errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "raw_payload_hash" "text" NOT NULL,
    "sanitized_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "removed_company_tokens" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "bucket_id" "uuid",
    "insert_error" "text",
    "actor_user_id" "uuid",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ingestion_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injury_forecast_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "jobsite_id" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "forecast_month" "text" NOT NULL,
    "model_version" "text" NOT NULL,
    "risk_level" "text" NOT NULL,
    "confidence_score" numeric NOT NULL,
    "included_record_count" integer DEFAULT 0 NOT NULL,
    "excluded_record_count" integer DEFAULT 0 NOT NULL,
    "source_mix" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trust_mix" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "exclusion_reasons" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "forecast_integrity" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recommended_controls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reviewed_by" "uuid",
    "final_human_decision" "text",
    "post_review_changes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."injury_forecast_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injury_weather_backtest_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lookback_months" integer NOT NULL,
    "pearson_structural_vs_incidents" double precision,
    "spearman_structural_vs_incidents" double precision,
    "pearson_likelihood_vs_incidents" double precision,
    "spearman_likelihood_vs_incidents" double precision,
    "pearson_cases_vs_incidents" double precision,
    "spearman_cases_vs_incidents" double precision,
    "row_count" integer DEFAULT 0 NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."injury_weather_backtest_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injury_weather_daily_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."injury_weather_daily_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_jobsite_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "created_by_email" "text",
    "jobsite_name" "text",
    "audit_date" "date",
    "auditors" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."internal_jobsite_audits" OWNER TO "postgres";


COMMENT ON TABLE "public"."internal_jobsite_audits" IS 'Jobsite audit drafts submitted from /admin/jobsite-audits (internal admins only).';



CREATE TABLE IF NOT EXISTS "public"."jobsite_contractor_training_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "apply_trades" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "apply_positions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "jobsite_contractor_training_requirements_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."jobsite_contractor_training_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobsite_rule_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "precedence" integer DEFAULT 300 NOT NULL,
    "version" "text" DEFAULT '2026-04-14'::"text" NOT NULL,
    "merge_behavior" "text" DEFAULT 'extend'::"text" NOT NULL,
    "selectors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "outputs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."jobsite_rule_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobsite_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "company_user_id" "uuid" NOT NULL,
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."jobsite_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobsite_weather_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "channels" "text"[] DEFAULT ARRAY['in_app'::"text"] NOT NULL,
    "min_severity" "text" DEFAULT 'watch'::"text" NOT NULL,
    "event_allowlist" "jsonb",
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "jobsite_weather_subscriptions_channels_check" CHECK ((("channels" <@ ARRAY['in_app'::"text", 'email'::"text", 'sms'::"text", 'push'::"text"]) AND ("cardinality"("channels") > 0))),
    CONSTRAINT "jobsite_weather_subscriptions_min_severity_check" CHECK (("min_severity" = ANY (ARRAY['advisory'::"text", 'watch'::"text", 'warning'::"text"])))
);


ALTER TABLE "public"."jobsite_weather_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "team" "text" DEFAULT 'General'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "account_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "company_id" "uuid",
    "permission_overrides" "jsonb" DEFAULT '{"deny": [], "allow": []}'::"jsonb" NOT NULL,
    CONSTRAINT "user_roles_account_status_check" CHECK (("account_status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text"]))),
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['platform_admin'::"text", 'sales_demo'::"text", 'marketing'::"text", 'internal_reviewer'::"text", 'employee'::"text", 'super_admin'::"text", 'admin'::"text", 'manager'::"text", 'company_admin'::"text", 'safety_manager'::"text", 'project_manager'::"text", 'field_supervisor'::"text", 'foreman'::"text", 'field_user'::"text", 'read_only'::"text", 'company_user'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_roles"."permission_overrides" IS 'User-specific function access overrides layered on top of the role and company defaults.';



CREATE OR REPLACE VIEW "public"."legacy_rbac_cutover_audit" AS
 WITH "legacy_auth" AS (
         SELECT "au"."id" AS "user_id",
            "au"."email",
            COALESCE(NULLIF(("au"."raw_app_meta_data" ->> 'role'::"text"), ''::"text"), NULLIF(("au"."raw_user_meta_data" ->> 'role'::"text"), ''::"text")) AS "raw_role",
            COALESCE(NULLIF(("au"."raw_app_meta_data" ->> 'company_id'::"text"), ''::"text"), NULLIF(("au"."raw_user_meta_data" ->> 'company_id'::"text"), ''::"text")) AS "raw_company_id",
            COALESCE(NULLIF(("au"."raw_app_meta_data" ->> 'account_status'::"text"), ''::"text"), NULLIF(("au"."raw_user_meta_data" ->> 'account_status'::"text"), ''::"text")) AS "raw_account_status"
           FROM "auth"."users" "au"
        ), "normalized" AS (
         SELECT "la"."user_id",
            "la"."email",
            "la"."raw_role",
            "la"."raw_company_id",
            "la"."raw_account_status",
            "public"."normalize_legacy_rbac_role"("la"."raw_role") AS "metadata_role",
                CASE
                    WHEN ("lower"(TRIM(BOTH FROM COALESCE("la"."raw_account_status", ''::"text"))) = 'pending'::"text") THEN 'pending'::"text"
                    WHEN ("lower"(TRIM(BOTH FROM COALESCE("la"."raw_account_status", ''::"text"))) = 'suspended'::"text") THEN 'suspended'::"text"
                    ELSE 'active'::"text"
                END AS "metadata_account_status"
           FROM "legacy_auth" "la"
        )
 SELECT "n"."user_id",
    "n"."email",
    "n"."raw_role",
    "n"."metadata_role",
    "ur"."role" AS "canonical_role",
    "n"."raw_company_id",
    "ur"."company_id" AS "canonical_company_id",
    "cm"."company_id" AS "membership_company_id",
    "n"."metadata_account_status",
    "ur"."account_status" AS "canonical_account_status",
        CASE
            WHEN (("ur"."user_id" IS NULL) AND (("n"."raw_role" IS NOT NULL) OR ("n"."raw_company_id" IS NOT NULL))) THEN 'missing_user_roles'::"text"
            WHEN (("n"."raw_company_id" IS NOT NULL) AND ("c"."id" IS NULL)) THEN 'metadata_company_not_found'::"text"
            WHEN (("ur"."company_id" IS NOT NULL) AND ("cm"."company_id" IS NULL) AND ("ur"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text", 'project_manager'::"text", 'field_supervisor'::"text", 'foreman'::"text", 'field_user'::"text", 'read_only'::"text", 'company_user'::"text"]))) THEN 'missing_company_membership'::"text"
            WHEN (("n"."raw_role" IS NOT NULL) AND ("public"."normalize_legacy_rbac_role"("n"."raw_role") <> "ur"."role")) THEN 'metadata_role_differs_from_canonical'::"text"
            WHEN (("n"."raw_account_status" IS NOT NULL) AND ("n"."metadata_account_status" <> "ur"."account_status")) THEN 'metadata_status_differs_from_canonical'::"text"
            ELSE 'ok'::"text"
        END AS "audit_status"
   FROM ((("normalized" "n"
     LEFT JOIN "public"."user_roles" "ur" ON (("ur"."user_id" = "n"."user_id")))
     LEFT JOIN "public"."companies" "c" ON ((("c"."id")::"text" = "n"."raw_company_id")))
     LEFT JOIN "public"."company_memberships" "cm" ON ((("cm"."user_id" = "n"."user_id") AND ("cm"."company_id" = "ur"."company_id"))));


ALTER VIEW "public"."legacy_rbac_cutover_audit" OWNER TO "postgres";


COMMENT ON VIEW "public"."legacy_rbac_cutover_audit" IS 'Locked-down verification view for the legacy RBAC metadata cutover. Query with the service role before removing legacy compatibility objects.';



CREATE TABLE IF NOT EXISTS "public"."library_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."library_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."library_document_tags" (
    "document_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."library_document_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."library_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid",
    "description" "text"
);


ALTER TABLE "public"."library_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."library_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."library_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_document_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "purchased_by_user_id" "uuid",
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_document_purchases_amount_nonneg" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "marketplace_document_purchases_currency_check" CHECK (("currency" = 'usd'::"text"))
);


ALTER TABLE "public"."marketplace_document_purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_document_purchases" IS 'Company-level paid entitlements for global marketplace documents.';



COMMENT ON COLUMN "public"."marketplace_document_purchases"."amount_cents" IS 'Amount paid for the document entitlement, in integer cents.';



CREATE TABLE IF NOT EXISTS "public"."observation_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "observation_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'safety-assets'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text",
    "content_type" "text",
    "uploaded_by_company_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_type" "text",
    "uploaded_by" "uuid"
);


ALTER TABLE "public"."observation_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."osha_predictability_baselines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "industry" "text" DEFAULT 'construction'::"text" NOT NULL,
    "incident_type" "text",
    "job_type" "text",
    "period_label" "text",
    "baseline_rate" double precision,
    "source_url" "text",
    "source_note" "text" DEFAULT 'Public OSHA/BLS baseline reference.'::"text" NOT NULL,
    "baseline_payload" "jsonb" DEFAULT "jsonb_build_object"() NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."osha_predictability_baselines" OWNER TO "postgres";


COMMENT ON TABLE "public"."osha_predictability_baselines" IS 'Public OSHA/BLS baseline values used when company and privacy-safe platform aggregate data are insufficient.';



CREATE TABLE IF NOT EXISTS "public"."permit_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permit_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."peshep_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_name" "text",
    "project_number" "text",
    "project_address" "text",
    "owner_client" "text",
    "gc_cm" "text",
    "contractor_company" "text",
    "plan_author" "text",
    "approval_name" "text",
    "revision" "text",
    "scope_of_work" "text",
    "raw_form" "jsonb" NOT NULL
);


ALTER TABLE "public"."peshep_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_conflict_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conflict_code" "text" NOT NULL,
    "conflict_type" "text" NOT NULL,
    "left_trade_code" "text",
    "left_task_code" "text",
    "left_hazard_family" "text",
    "right_trade_code" "text",
    "right_task_code" "text",
    "right_hazard_family" "text",
    "requires_same_area" boolean DEFAULT false NOT NULL,
    "requires_time_overlap" boolean DEFAULT false NOT NULL,
    "weather_condition" "text",
    "severity" "public"."si_conflict_severity" DEFAULT 'medium'::"public"."si_conflict_severity" NOT NULL,
    "rationale" "text" NOT NULL,
    "recommended_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_conflict_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_job_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "processed_count" integer,
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_job_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'succeeded'::"text", 'failed'::"text", 'partial'::"text"])))
);


ALTER TABLE "public"."platform_job_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_jurisdiction_standard_mappings" (
    "id" "text" NOT NULL,
    "standard_id" "text" NOT NULL,
    "mapping_type" "text" NOT NULL,
    "mapping_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "platform_jurisdiction_standard_mappings_mapping_type_check" CHECK (("mapping_type" = ANY (ARRAY['program_item'::"text", 'pshsep_catalog'::"text", 'section_key'::"text", 'checklist_field'::"text"])))
);


ALTER TABLE "public"."platform_jurisdiction_standard_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_jurisdiction_standard_overrides" (
    "standard_id" "text" NOT NULL,
    "title" "text",
    "summary" "text",
    "applicability" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "effective_date" "date",
    "last_reviewed_date" "date",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."platform_jurisdiction_standard_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_jurisdiction_standards" (
    "id" "text" NOT NULL,
    "jurisdiction_code" "text" NOT NULL,
    "surface_scope" "text" NOT NULL,
    "standard_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "applicability" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_url" "text" NOT NULL,
    "source_title" "text" NOT NULL,
    "source_authority" "text" NOT NULL,
    "effective_date" "date",
    "last_reviewed_date" "date" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "platform_jurisdiction_standards_standard_type_check" CHECK (("standard_type" = ANY (ARRAY['osha_ref'::"text", 'program_requirement'::"text", 'permit_requirement'::"text", 'training_requirement'::"text", 'builder_prompt_delta'::"text", 'admin_review_note'::"text"]))),
    CONSTRAINT "platform_jurisdiction_standards_surface_scope_check" CHECK (("surface_scope" = ANY (ARRAY['csep'::"text", 'peshep'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."platform_jurisdiction_standards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_jurisdictions" (
    "code" "text" NOT NULL,
    "state_code" "text",
    "display_name" "text" NOT NULL,
    "plan_type" "text" NOT NULL,
    "covers_private_sector" boolean DEFAULT true NOT NULL,
    "source_url" "text" NOT NULL,
    "source_title" "text" NOT NULL,
    "source_authority" "text" NOT NULL,
    "effective_date" "date",
    "last_reviewed_date" "date" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "platform_jurisdictions_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['federal_osha'::"text", 'state_plan'::"text"])))
);


ALTER TABLE "public"."platform_jurisdictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_major_construction_fatality_incident_controls" (
    "incident_id" "text" NOT NULL,
    "control_number" integer NOT NULL,
    "preventive_control" "text" NOT NULL,
    "related_permit_plan" "text",
    "severity_trigger" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_major_construction_fatality_incident_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_major_construction_fatality_incidents" (
    "incident_id" "text" NOT NULL,
    "incident_name" "text" NOT NULL,
    "occurred_on" "date" NOT NULL,
    "incident_year" integer NOT NULL,
    "location" "text" NOT NULL,
    "state" "text" NOT NULL,
    "fatalities" integer DEFAULT 0 NOT NULL,
    "injuries" "text",
    "work_type" "text",
    "incident_type" "text",
    "osha_focus_four_exposures" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "work_activity" "text",
    "immediate_cause" "text",
    "contributing_factors" "text",
    "missed_stop_work_trigger" "text",
    "preventive_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "platform_rule_trigger" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "source_level" "text",
    "confidence" "text",
    "source_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "source_workbook" "text" DEFAULT 'major_construction_fatality_incidents_2021_2026.xlsx'::"text" NOT NULL,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_major_construction_fatality_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_permit_trigger_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "permit_code" "text" NOT NULL,
    "trade_code" "text",
    "task_template_code" "text",
    "hazard_family" "text",
    "work_condition" "text",
    "weather_condition" "text",
    "rationale" "text" NOT NULL,
    "required_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_permit_trigger_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_predictability_aggregates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "industry" "text",
    "company_size_bucket" "text",
    "region" "text",
    "incident_type" "text",
    "job_type" "text",
    "time_period" "date",
    "record_count" integer DEFAULT 0 NOT NULL,
    "company_count" integer DEFAULT 0 NOT NULL,
    "observation_days" integer DEFAULT 0 NOT NULL,
    "risk_score" double precision,
    "aggregate_payload" "jsonb" DEFAULT "jsonb_build_object"() NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_predictability_aggregates_no_company_identifiers" CHECK (((NOT ("aggregate_payload" ? 'company_id'::"text")) AND (NOT ("aggregate_payload" ? 'company_ids'::"text")) AND (NOT ("aggregate_payload" ? 'company_name'::"text")) AND (NOT ("aggregate_payload" ? 'company_names'::"text")))),
    CONSTRAINT "platform_predictability_aggregates_nonnegative_counts" CHECK ((("record_count" >= 0) AND ("company_count" >= 0) AND ("observation_days" >= 0)))
);


ALTER TABLE "public"."platform_predictability_aggregates" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_predictability_aggregates" IS 'Pre-aggregated, anonymized Predictability Engine benchmark buckets. Do not store raw company records, company IDs, or company names.';



COMMENT ON COLUMN "public"."platform_predictability_aggregates"."company_count" IS 'Number of companies represented in this aggregate bucket; resolver requires a minimum group size before use.';



CREATE TABLE IF NOT EXISTS "public"."platform_rule_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "precedence" integer DEFAULT 100 NOT NULL,
    "version" "text" DEFAULT '2026-04-14'::"text" NOT NULL,
    "merge_behavior" "text" DEFAULT 'extend'::"text" NOT NULL,
    "selectors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "outputs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_rule_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_sub_trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trade_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_sub_trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_task_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trade_id" "uuid",
    "sub_trade_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "common_task" boolean DEFAULT true NOT NULL,
    "equipment_used" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "work_conditions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hazard_families" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "required_controls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "permit_triggers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "training_requirements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "weather_sensitivity" "public"."si_weather_sensitivity" DEFAULT 'medium'::"public"."si_weather_sensitivity" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_task_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pshsep_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pshsep_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pshsep_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Untitled PSHSEP'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pshsep_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pshsep_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "reviewer_notes" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "project_name" "text",
    "form_data" "jsonb",
    "compiled_content" "jsonb",
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "draft_file_path" "text"
);


ALTER TABLE "public"."pshsep_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "daily_report_id" "uuid",
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "snapshot_date" "date" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_company_user_id" "uuid"
);


ALTER TABLE "public"."report_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_baseline_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope_code" "text" NOT NULL,
    "hazard_code" "text" NOT NULL,
    "trade_code" "text" DEFAULT ''::"text" NOT NULL,
    "signals" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."risk_baseline_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."risk_baseline_profiles" IS 'Industry-style fallback patterns when company-specific history is thin (scoped by scope/hazard/trade keys).';



CREATE TABLE IF NOT EXISTS "public"."safety_data_bucket" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "ingestion_audit_log_id" "uuid" NOT NULL,
    "source_type" "public"."si_ingestion_source_type" NOT NULL,
    "source_record_id" "text",
    "title" "text" NOT NULL,
    "summary" "text",
    "description" "text",
    "severity" "public"."si_conflict_severity" DEFAULT 'medium'::"public"."si_conflict_severity" NOT NULL,
    "trade_code" "text",
    "category_code" "text",
    "source_created_at" timestamp with time zone NOT NULL,
    "event_at" timestamp with time zone,
    "reported_at" timestamp with time zone,
    "due_at" timestamp with time zone,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "raw_payload_hash" "text" NOT NULL,
    "removed_company_tokens" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sanitized_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "normalized_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_ready" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "safety_data_bucket_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0)),
    CONSTRAINT "safety_data_bucket_validity_window_check" CHECK ((("valid_to" IS NULL) OR ("valid_from" IS NULL) OR ("valid_to" >= "valid_from")))
);


ALTER TABLE "public"."safety_data_bucket" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."safety_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "score_date" "date" NOT NULL,
    "score" numeric(6,2) NOT NULL,
    "score_components" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_company_user_id" "uuid"
);


ALTER TABLE "public"."safety_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sif_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "incident_id" "uuid",
    "corrective_action_id" "uuid",
    "reviewer_company_user_id" "uuid",
    "rating" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sif_reviews_rating_check" CHECK (("rating" = ANY (ARRAY['pending'::"text", 'low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."sif_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sor_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sor_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "user_id" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "notes" "text",
    CONSTRAINT "sor_audit_log_action_check" CHECK (("action_type" = ANY (ARRAY['create'::"text", 'submit'::"text", 'edit'::"text", 'supersede'::"text", 'soft_delete'::"text", 'restore'::"text", 'lock'::"text"])))
);


ALTER TABLE "public"."sor_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "service_type" "text" DEFAULT 'document_review'::"text" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "customer_notes" "text",
    "internal_notes" "text",
    "assigned_to" "uuid",
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_card_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_card_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_card_role_categories" (
    "role_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_card_role_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_card_role_tasks" (
    "role_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_card_role_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_card_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_card_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_card_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_review_task" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_card_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_expiration_notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "recipient_context" "text" NOT NULL,
    "recipient_user_id" "uuid",
    "recipient_email" "text",
    "subject_type" "text" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "subject_user_id" "uuid",
    "training_title" "text" NOT NULL,
    "expires_on" "date" NOT NULL,
    "reminder_stage" "text" NOT NULL,
    "source_table" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "dedupe_key" "text" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "training_expiration_deliveries_attempt_check" CHECK (("attempt_count" > 0)),
    CONSTRAINT "training_expiration_deliveries_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'in_app'::"text"]))),
    CONSTRAINT "training_expiration_deliveries_context_check" CHECK (("recipient_context" = ANY (ARRAY['worker'::"text", 'safety_manager'::"text"]))),
    CONSTRAINT "training_expiration_deliveries_stage_check" CHECK (("reminder_stage" = ANY (ARRAY['30d'::"text", '14d'::"text", '7d'::"text", 'expired'::"text"]))),
    CONSTRAINT "training_expiration_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'skipped'::"text", 'failed'::"text"]))),
    CONSTRAINT "training_expiration_deliveries_subject_check" CHECK (("subject_type" = ANY (ARRAY['app_user'::"text", 'tracked_employee'::"text", 'contractor_employee'::"text"]))),
    CONSTRAINT "training_expiration_deliveries_title_nonempty" CHECK (("length"(TRIM(BOTH FROM "training_title")) > 0))
);


ALTER TABLE "public"."training_expiration_notification_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_agreements" (
    "user_id" "uuid" NOT NULL,
    "accepted_terms" boolean DEFAULT true NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ip_address" "text",
    "terms_version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_dashboard_layouts" (
    "user_id" "uuid" NOT NULL,
    "layout" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_dashboard_layouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_onboarding_state" (
    "user_id" "uuid" NOT NULL,
    "completed_steps" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "dismissed_at" timestamp with time zone,
    "last_seen_command_center_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_onboarding_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "preferred_name" "text",
    "job_title" "text",
    "trade_specialty" "text",
    "years_experience" integer,
    "phone" "text",
    "city" "text",
    "state_region" "text",
    "readiness_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "certifications" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "specialties" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "equipment" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "bio" "text",
    "photo_url" "text",
    "photo_path" "text",
    "profile_complete" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "certification_expirations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "user_profiles_readiness_status_check" CHECK (("readiness_status" = ANY (ARRAY['ready'::"text", 'travel_ready'::"text", 'limited'::"text"]))),
    CONSTRAINT "user_profiles_years_experience_check" CHECK ((("years_experience" IS NULL) OR ("years_experience" >= 0)))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."certification_expirations" IS 'Map of certification label -> YYYY-MM-DD expiry. Omitted keys mean no expiry recorded (treated as current for compliance checks).';



CREATE TABLE IF NOT EXISTS "public"."user_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weather_alert_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "nws_alert_id" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "severity" "text",
    "urgency" "text",
    "certainty" "text",
    "headline" "text",
    "description" "text",
    "instruction" "text",
    "effective_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "status" "text",
    "raw_payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."weather_alert_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weather_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid",
    "logged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "temperature_c" numeric(5,2),
    "wind_kph" numeric(5,2),
    "precipitation_mm" numeric(7,2),
    "conditions" "text",
    "created_by_company_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."weather_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weather_notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "weather_alert_event_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "jobsite_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "dedupe_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recipient_employee_id" "uuid",
    CONSTRAINT "weather_notification_deliveries_channel_check" CHECK (("channel" = ANY (ARRAY['in_app'::"text", 'email'::"text", 'sms'::"text", 'push'::"text"]))),
    CONSTRAINT "weather_notification_deliveries_recipient_check" CHECK ((("user_id" IS NOT NULL) OR ("recipient_employee_id" IS NOT NULL))),
    CONSTRAINT "weather_notification_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'skipped'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."weather_notification_deliveries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_call_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ai_call_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_engine_recommendation_snapshots" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ai_engine_recommendation_snapshots_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_output_feedback" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ai_output_feedback_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_call_log"
    ADD CONSTRAINT "ai_call_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_engine_recommendation_snapshots"
    ADD CONSTRAINT "ai_engine_recommendation_snap_surface_window_days_snapshot__key" UNIQUE ("surface", "window_days", "snapshot_date");



ALTER TABLE ONLY "public"."ai_engine_recommendation_snapshots"
    ADD CONSTRAINT "ai_engine_recommendation_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_output_feedback"
    ADD CONSTRAINT "ai_output_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."behavior_risk_events"
    ADD CONSTRAINT "behavior_risk_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_events"
    ADD CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_invoice_counters"
    ADD CONSTRAINT "billing_invoice_counters_pkey" PRIMARY KEY ("year");



ALTER TABLE ONLY "public"."billing_invoice_line_items"
    ADD CONSTRAINT "billing_invoice_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_invoice_payments"
    ADD CONSTRAINT "billing_invoice_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_staff_company_assignments"
    ADD CONSTRAINT "billing_staff_company_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_staff_company_assignments"
    ADD CONSTRAINT "billing_staff_company_assignments_staff_user_id_company_id_key" UNIQUE ("staff_user_id", "company_id");



ALTER TABLE ONLY "public"."client_onboarding_items"
    ADD CONSTRAINT "client_onboarding_items_client_id_title_key" UNIQUE ("client_id", "title");



ALTER TABLE ONLY "public"."client_onboarding_items"
    ADD CONSTRAINT "client_onboarding_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_team_key_key" UNIQUE ("team_key");



ALTER TABLE ONLY "public"."company_ai_reviews"
    ADD CONSTRAINT "company_ai_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_analytics_snapshots"
    ADD CONSTRAINT "company_analytics_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_audit_customer_locations"
    ADD CONSTRAINT "company_audit_customer_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_audit_customers"
    ADD CONSTRAINT "company_audit_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_auditflow_corrective_action_links"
    ADD CONSTRAINT "company_auditflow_corrective_action_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_auditflow_corrective_action_links"
    ADD CONSTRAINT "company_auditflow_corrective_action_links_unique" UNIQUE ("submission_id", "item_key");



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_auditflow_template_versions"
    ADD CONSTRAINT "company_auditflow_template_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_auditflow_template_versions"
    ADD CONSTRAINT "company_auditflow_template_versions_unique" UNIQUE ("template_id", "version");



ALTER TABLE ONLY "public"."company_auditflow_templates"
    ADD CONSTRAINT "company_auditflow_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_bucket_runs"
    ADD CONSTRAINT "company_bucket_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_checklist_items"
    ADD CONSTRAINT "company_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_clients"
    ADD CONSTRAINT "company_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_conflict_rules"
    ADD CONSTRAINT "company_conflict_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_conflict_rules"
    ADD CONSTRAINT "company_conflict_rules_uidx" UNIQUE ("company_id", "conflict_code");



ALTER TABLE ONLY "public"."company_contractor_documents"
    ADD CONSTRAINT "company_contractor_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_contractor_evaluations"
    ADD CONSTRAINT "company_contractor_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_contractors"
    ADD CONSTRAINT "company_contractors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_controls"
    ADD CONSTRAINT "company_controls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_controls"
    ADD CONSTRAINT "company_controls_uidx" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."company_corrective_action_events"
    ADD CONSTRAINT "company_corrective_action_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_corrective_action_evidence"
    ADD CONSTRAINT "company_corrective_action_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_credit_transactions"
    ADD CONSTRAINT "company_credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_crews"
    ADD CONSTRAINT "company_crews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jsa_activities"
    ADD CONSTRAINT "company_dap_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jsas"
    ADD CONSTRAINT "company_daps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_document_requirements"
    ADD CONSTRAINT "company_document_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_document_requirements"
    ADD CONSTRAINT "company_document_requirements_title_category_lifecycle_stag_key" UNIQUE ("title", "category", "lifecycle_stage");



ALTER TABLE ONLY "public"."company_document_templates"
    ADD CONSTRAINT "company_document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_document_templates"
    ADD CONSTRAINT "company_document_templates_uidx" UNIQUE ("company_id", "template_key");



ALTER TABLE ONLY "public"."company_documents"
    ADD CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_employee_jobsite_assignments"
    ADD CONSTRAINT "company_employee_jobsite_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_employee_training_records"
    ADD CONSTRAINT "company_employee_training_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_finance_authorized_users"
    ADD CONSTRAINT "company_finance_authorized_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."company_finance_budgets"
    ADD CONSTRAINT "company_finance_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_finance_receipts"
    ADD CONSTRAINT "company_finance_receipts_file_path_key" UNIQUE ("file_path");



ALTER TABLE ONLY "public"."company_finance_receipts"
    ADD CONSTRAINT "company_finance_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_finance_recurring_items"
    ADD CONSTRAINT "company_finance_recurring_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_finance_transactions"
    ADD CONSTRAINT "company_finance_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_uidx" UNIQUE ("generated_document_id", "version_number");



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_hazards"
    ADD CONSTRAINT "company_hazards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_hazards"
    ADD CONSTRAINT "company_hazards_uidx" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."company_hris_roster_imports"
    ADD CONSTRAINT "company_hris_roster_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_induction_completions"
    ADD CONSTRAINT "company_induction_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_induction_programs"
    ADD CONSTRAINT "company_induction_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_induction_requirements"
    ADD CONSTRAINT "company_induction_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_signoffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_integration_webhook_deliveries"
    ADD CONSTRAINT "company_integration_webhook_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_integration_webhooks"
    ADD CONSTRAINT "company_integration_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_invites"
    ADD CONSTRAINT "company_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_assignments"
    ADD CONSTRAINT "company_jobsite_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_assignments"
    ADD CONSTRAINT "company_jobsite_assignments_unique" UNIQUE ("company_id", "jobsite_id", "user_id");



ALTER TABLE ONLY "public"."company_jobsite_audit_observation_evidence"
    ADD CONSTRAINT "company_jobsite_audit_observation_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_source_unique" UNIQUE ("audit_id", "source_key");



ALTER TABLE ONLY "public"."company_jobsite_audit_report_deliveries"
    ADD CONSTRAINT "company_jobsite_audit_report_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_audit_signoffs"
    ADD CONSTRAINT "company_jobsite_audit_signoffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_audit_signoffs"
    ADD CONSTRAINT "company_jobsite_audit_signoffs_unique" UNIQUE ("company_id", "audit_id", "signed_by");



ALTER TABLE ONLY "public"."company_jobsite_audits"
    ADD CONSTRAINT "company_jobsite_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_chemicals"
    ADD CONSTRAINT "company_jobsite_chemicals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_daily_todos"
    ADD CONSTRAINT "company_jobsite_daily_todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_daily_todos"
    ADD CONSTRAINT "company_jobsite_daily_todos_unique_source" UNIQUE ("company_id", "jobsite_id", "work_date", "source_key");



ALTER TABLE ONLY "public"."company_jobsite_schedule_items"
    ADD CONSTRAINT "company_jobsite_schedule_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_site_blueprints"
    ADD CONSTRAINT "company_jobsite_site_blueprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_site_maps"
    ADD CONSTRAINT "company_jobsite_site_maps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_site_renders"
    ADD CONSTRAINT "company_jobsite_site_renders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsite_visual_zones"
    ADD CONSTRAINT "company_jobsite_visual_zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jobsites"
    ADD CONSTRAINT "company_jobsites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jsa_signoffs"
    ADD CONSTRAINT "company_jsa_signoffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_jsa_signoffs"
    ADD CONSTRAINT "company_jsa_signoffs_unique" UNIQUE ("company_id", "jsa_id", "signed_by");



ALTER TABLE ONLY "public"."company_leadership_safety_scores"
    ADD CONSTRAINT "company_leadership_safety_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_leadership_safety_scores"
    ADD CONSTRAINT "company_leadership_safety_scores_unique" UNIQUE ("company_id", "user_id", "role", "window_start", "window_end");



ALTER TABLE ONLY "public"."company_legal_issues"
    ADD CONSTRAINT "company_legal_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_user_company_unique" UNIQUE ("user_id", "company_id");



ALTER TABLE ONLY "public"."company_memory_items"
    ADD CONSTRAINT "company_memory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_mobile_feature_entitlements"
    ADD CONSTRAINT "company_mobile_feature_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_mobile_feature_entitlements"
    ADD CONSTRAINT "company_mobile_feature_entitlements_unique" UNIQUE ("company_id", "user_id", "feature");



ALTER TABLE ONLY "public"."company_notification_preferences"
    ADD CONSTRAINT "company_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_notification_preferences"
    ADD CONSTRAINT "company_notification_preferences_unique" UNIQUE ("company_id", "user_id", "event_type");



ALTER TABLE ONLY "public"."company_notifications"
    ADD CONSTRAINT "company_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_onboarding_imports"
    ADD CONSTRAINT "company_onboarding_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_operations_records"
    ADD CONSTRAINT "company_operations_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_permit_trigger_rules"
    ADD CONSTRAINT "company_permit_trigger_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_permits_catalog"
    ADD CONSTRAINT "company_permits_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_permits_catalog"
    ADD CONSTRAINT "company_permits_catalog_uidx" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_positions"
    ADD CONSTRAINT "company_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_report_attachments"
    ADD CONSTRAINT "company_report_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_reports"
    ADD CONSTRAINT "company_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_risk_ai_recommendations"
    ADD CONSTRAINT "company_risk_ai_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_risk_events"
    ADD CONSTRAINT "company_risk_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_risk_memory_facets"
    ADD CONSTRAINT "company_risk_memory_facets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_risk_memory_snapshots"
    ADD CONSTRAINT "company_risk_memory_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_risk_recommendation_events"
    ADD CONSTRAINT "company_risk_recommendation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_risk_scores"
    ADD CONSTRAINT "company_risk_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_rule_overrides"
    ADD CONSTRAINT "company_rule_overrides_company_code_uidx" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."company_rule_overrides"
    ADD CONSTRAINT "company_rule_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_safety_form_definitions"
    ADD CONSTRAINT "company_safety_form_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_safety_form_submissions"
    ADD CONSTRAINT "company_safety_form_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_safety_form_versions"
    ADD CONSTRAINT "company_safety_form_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_safety_form_versions"
    ADD CONSTRAINT "company_safety_form_versions_unique" UNIQUE ("definition_id", "version");



ALTER TABLE ONLY "public"."company_safety_intelligence_audit_log"
    ADD CONSTRAINT "company_safety_intelligence_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_safety_intelligence_history"
    ADD CONSTRAINT "company_safety_intelligence_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_safety_submissions"
    ADD CONSTRAINT "company_safety_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_sales_activities"
    ADD CONSTRAINT "company_sales_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_schedule_prediction_cache"
    ADD CONSTRAINT "company_schedule_prediction_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_security_events"
    ADD CONSTRAINT "company_security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_signup_requests"
    ADD CONSTRAINT "company_signup_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_sor_records"
    ADD CONSTRAINT "company_sor_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_sub_trades"
    ADD CONSTRAINT "company_sub_trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_sub_trades"
    ADD CONSTRAINT "company_sub_trades_uidx" UNIQUE ("company_id", "company_trade_id", "code");



ALTER TABLE ONLY "public"."company_subscriptions"
    ADD CONSTRAINT "company_subscriptions_company_id_key" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."company_subscriptions"
    ADD CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_task_controls"
    ADD CONSTRAINT "company_task_controls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_task_hazards"
    ADD CONSTRAINT "company_task_hazards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_task_permit_triggers"
    ADD CONSTRAINT "company_task_permit_triggers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_task_training_requirements"
    ADD CONSTRAINT "company_task_training_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_toolbox_attendees"
    ADD CONSTRAINT "company_toolbox_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_toolbox_sessions"
    ADD CONSTRAINT "company_toolbox_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_toolbox_templates"
    ADD CONSTRAINT "company_toolbox_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_trades"
    ADD CONSTRAINT "company_trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_trades"
    ADD CONSTRAINT "company_trades_uidx" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."company_training_matrix_requirements"
    ADD CONSTRAINT "company_training_matrix_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_training_matrix_requirements"
    ADD CONSTRAINT "company_training_matrix_requirements_uidx" UNIQUE ("company_id", "requirement_code");



ALTER TABLE ONLY "public"."company_training_requirements"
    ADD CONSTRAINT "company_training_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_unique_user_per_company" UNIQUE ("company_id", "user_id");



ALTER TABLE ONLY "public"."company_weather_conditions"
    ADD CONSTRAINT "company_weather_conditions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_work_areas"
    ADD CONSTRAINT "company_work_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_work_areas"
    ADD CONSTRAINT "company_work_areas_uidx" UNIQUE ("company_id", "jobsite_id", "code");



ALTER TABLE ONLY "public"."contractor_employee_intake_tokens"
    ADD CONSTRAINT "contractor_employee_intake_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contractor_employee_intake_tokens"
    ADD CONSTRAINT "contractor_employee_intake_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_unique" UNIQUE ("company_id", "jobsite_id", "contractor_employee_id");



ALTER TABLE ONLY "public"."contractor_employee_profiles"
    ADD CONSTRAINT "contractor_employee_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contractor_employee_training_records"
    ADD CONSTRAINT "contractor_employee_training_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corrective_actions"
    ADD CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "daily_reports_unique_per_jobsite_date" UNIQUE ("company_id", "jobsite_id", "report_date");



ALTER TABLE ONLY "public"."dap_activities"
    ADD CONSTRAINT "dap_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daps"
    ADD CONSTRAINT "daps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demo_requests"
    ADD CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_downloads"
    ADD CONSTRAINT "document_downloads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_unique_version" UNIQUE ("document_id", "version_number");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_document_assignments"
    ADD CONSTRAINT "employee_document_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_document_assignments"
    ADD CONSTRAINT "employee_document_assignments_user_id_template_id_key" UNIQUE ("user_id", "template_id");



ALTER TABLE ONLY "public"."employee_document_signatures"
    ADD CONSTRAINT "employee_document_signatures_assignment_id_key" UNIQUE ("assignment_id");



ALTER TABLE ONLY "public"."employee_document_signatures"
    ADD CONSTRAINT "employee_document_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_pay_rates"
    ADD CONSTRAINT "employee_pay_rates_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."employee_profiles"
    ADD CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."employee_time_card_payroll"
    ADD CONSTRAINT "employee_time_card_payroll_pkey" PRIMARY KEY ("time_card_id");



ALTER TABLE ONLY "public"."employee_time_cards"
    ADD CONSTRAINT "employee_time_cards_employee_user_id_week_start_key" UNIQUE ("employee_user_id", "week_start");



ALTER TABLE ONLY "public"."employee_time_cards"
    ADD CONSTRAINT "employee_time_cards_import_key_key" UNIQUE ("import_key");



ALTER TABLE ONLY "public"."employee_time_cards"
    ADD CONSTRAINT "employee_time_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_import_key_key" UNIQUE ("import_key");



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gus_generated_plans"
    ADD CONSTRAINT "gus_generated_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gus_planning_messages"
    ADD CONSTRAINT "gus_planning_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gus_planning_sessions"
    ADD CONSTRAINT "gus_planning_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hazard_categories"
    ADD CONSTRAINT "hazard_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hazard_categories"
    ADD CONSTRAINT "hazard_categories_unique_code" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."hr_document_templates"
    ADD CONSTRAINT "hr_document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hr_document_templates"
    ADD CONSTRAINT "hr_document_templates_title_version_key" UNIQUE ("title", "version");



ALTER TABLE ONLY "public"."incident_notification_deliveries"
    ADD CONSTRAINT "incident_notification_deliveries_dedupe_unique" UNIQUE ("dedupe_key");



ALTER TABLE ONLY "public"."incident_notification_deliveries"
    ADD CONSTRAINT "incident_notification_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incident_root_causes"
    ADD CONSTRAINT "incident_root_causes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingestion_audit_log"
    ADD CONSTRAINT "ingestion_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_forecast_audit_log"
    ADD CONSTRAINT "injury_forecast_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_weather_backtest_runs"
    ADD CONSTRAINT "injury_weather_backtest_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_weather_daily_snapshots"
    ADD CONSTRAINT "injury_weather_daily_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_weather_daily_snapshots"
    ADD CONSTRAINT "injury_weather_daily_snapshots_snapshot_date_key" UNIQUE ("snapshot_date");



ALTER TABLE ONLY "public"."internal_jobsite_audits"
    ADD CONSTRAINT "internal_jobsite_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobsite_contractor_training_requirements"
    ADD CONSTRAINT "jobsite_contractor_training_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobsite_rule_overrides"
    ADD CONSTRAINT "jobsite_rule_overrides_jobsite_code_uidx" UNIQUE ("jobsite_id", "code");



ALTER TABLE ONLY "public"."jobsite_rule_overrides"
    ADD CONSTRAINT "jobsite_rule_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobsite_users"
    ADD CONSTRAINT "jobsite_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobsite_users"
    ADD CONSTRAINT "jobsite_users_unique" UNIQUE ("jobsite_id", "company_user_id");



ALTER TABLE ONLY "public"."jobsite_weather_subscriptions"
    ADD CONSTRAINT "jobsite_weather_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobsite_weather_subscriptions"
    ADD CONSTRAINT "jobsite_weather_subscriptions_unique" UNIQUE ("jobsite_id", "user_id");



ALTER TABLE ONLY "public"."jobsites"
    ADD CONSTRAINT "jobsites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobsites"
    ADD CONSTRAINT "jobsites_unique_name_per_company" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."library_categories"
    ADD CONSTRAINT "library_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."library_categories"
    ADD CONSTRAINT "library_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."library_document_tags"
    ADD CONSTRAINT "library_document_tags_pkey" PRIMARY KEY ("document_id", "tag_id");



ALTER TABLE ONLY "public"."library_documents"
    ADD CONSTRAINT "library_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."library_tags"
    ADD CONSTRAINT "library_tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."library_tags"
    ADD CONSTRAINT "library_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_document_purchases"
    ADD CONSTRAINT "marketplace_document_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observation_photos"
    ADD CONSTRAINT "observation_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."osha_predictability_baselines"
    ADD CONSTRAINT "osha_predictability_baselines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permit_types"
    ADD CONSTRAINT "permit_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permit_types"
    ADD CONSTRAINT "permit_types_unique_code" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."peshep_submissions"
    ADD CONSTRAINT "peshep_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_conflict_rules"
    ADD CONSTRAINT "platform_conflict_rules_conflict_code_key" UNIQUE ("conflict_code");



ALTER TABLE ONLY "public"."platform_conflict_rules"
    ADD CONSTRAINT "platform_conflict_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_job_runs"
    ADD CONSTRAINT "platform_job_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_jurisdiction_standard_mappings"
    ADD CONSTRAINT "platform_jurisdiction_standard_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_jurisdiction_standard_overrides"
    ADD CONSTRAINT "platform_jurisdiction_standard_overrides_pkey" PRIMARY KEY ("standard_id");



ALTER TABLE ONLY "public"."platform_jurisdiction_standards"
    ADD CONSTRAINT "platform_jurisdiction_standards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_jurisdictions"
    ADD CONSTRAINT "platform_jurisdictions_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."platform_major_construction_fatality_incident_controls"
    ADD CONSTRAINT "platform_major_construction_fatality_incident_controls_pkey" PRIMARY KEY ("incident_id", "control_number");



ALTER TABLE ONLY "public"."platform_major_construction_fatality_incidents"
    ADD CONSTRAINT "platform_major_construction_fatality_incidents_pkey" PRIMARY KEY ("incident_id");



ALTER TABLE ONLY "public"."platform_permit_trigger_rules"
    ADD CONSTRAINT "platform_permit_trigger_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_predictability_aggregates"
    ADD CONSTRAINT "platform_predictability_aggregates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_rule_templates"
    ADD CONSTRAINT "platform_rule_templates_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."platform_rule_templates"
    ADD CONSTRAINT "platform_rule_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."platform_sub_trades"
    ADD CONSTRAINT "platform_sub_trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_sub_trades"
    ADD CONSTRAINT "platform_sub_trades_trade_code_uidx" UNIQUE ("trade_id", "code");



ALTER TABLE ONLY "public"."platform_task_templates"
    ADD CONSTRAINT "platform_task_templates_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."platform_task_templates"
    ADD CONSTRAINT "platform_task_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_trades"
    ADD CONSTRAINT "platform_trades_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."platform_trades"
    ADD CONSTRAINT "platform_trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."pshsep_attachments"
    ADD CONSTRAINT "pshsep_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pshsep_drafts"
    ADD CONSTRAINT "pshsep_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pshsep_submissions"
    ADD CONSTRAINT "pshsep_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_baseline_profiles"
    ADD CONSTRAINT "risk_baseline_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safety_data_bucket"
    ADD CONSTRAINT "safety_data_bucket_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safety_scores"
    ADD CONSTRAINT "safety_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safety_scores"
    ADD CONSTRAINT "safety_scores_unique_per_scope_date" UNIQUE ("company_id", "jobsite_id", "score_date");



ALTER TABLE ONLY "public"."sif_reviews"
    ADD CONSTRAINT "sif_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sor_audit_log"
    ADD CONSTRAINT "sor_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."time_card_categories"
    ADD CONSTRAINT "time_card_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."time_card_categories"
    ADD CONSTRAINT "time_card_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_card_categories"
    ADD CONSTRAINT "time_card_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."time_card_role_categories"
    ADD CONSTRAINT "time_card_role_categories_pkey" PRIMARY KEY ("role_id", "category_id");



ALTER TABLE ONLY "public"."time_card_role_tasks"
    ADD CONSTRAINT "time_card_role_tasks_pkey" PRIMARY KEY ("role_id", "task_id");



ALTER TABLE ONLY "public"."time_card_roles"
    ADD CONSTRAINT "time_card_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."time_card_roles"
    ADD CONSTRAINT "time_card_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_card_roles"
    ADD CONSTRAINT "time_card_roles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."time_card_tasks"
    ADD CONSTRAINT "time_card_tasks_category_id_title_key" UNIQUE ("category_id", "title");



ALTER TABLE ONLY "public"."time_card_tasks"
    ADD CONSTRAINT "time_card_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_card_tasks"
    ADD CONSTRAINT "time_card_tasks_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."training_expiration_notification_deliveries"
    ADD CONSTRAINT "training_expiration_deliveries_dedupe_unique" UNIQUE ("dedupe_key");



ALTER TABLE ONLY "public"."training_expiration_notification_deliveries"
    ADD CONSTRAINT "training_expiration_notification_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_agreements"
    ADD CONSTRAINT "user_agreements_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_dashboard_layouts"
    ADD CONSTRAINT "user_dashboard_layouts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_onboarding_state"
    ADD CONSTRAINT "user_onboarding_state_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_submissions"
    ADD CONSTRAINT "user_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weather_alert_events"
    ADD CONSTRAINT "weather_alert_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weather_alert_events"
    ADD CONSTRAINT "weather_alert_events_unique" UNIQUE ("jobsite_id", "nws_alert_id");



ALTER TABLE ONLY "public"."weather_logs"
    ADD CONSTRAINT "weather_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weather_notification_deliveries"
    ADD CONSTRAINT "weather_notification_deliveries_dedupe_unique" UNIQUE ("dedupe_key");



ALTER TABLE ONLY "public"."weather_notification_deliveries"
    ADD CONSTRAINT "weather_notification_deliveries_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_call_log_created_at_idx" ON "public"."ai_call_log" USING "btree" ("created_at" DESC);



CREATE INDEX "ai_call_log_error_type_created_idx" ON "public"."ai_call_log" USING "btree" ("error_type", "created_at" DESC) WHERE ("error_type" IS NOT NULL);



CREATE INDEX "ai_call_log_provider_created_at_idx" ON "public"."ai_call_log" USING "btree" ("provider", "created_at" DESC);



CREATE INDEX "ai_call_log_status_created_at_idx" ON "public"."ai_call_log" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "ai_call_log_surface_created_at_idx" ON "public"."ai_call_log" USING "btree" ("surface", "created_at" DESC);



CREATE INDEX "ai_call_log_surface_latency_created_idx" ON "public"."ai_call_log" USING "btree" ("surface", "created_at" DESC, "latency_ms");



CREATE INDEX "ai_call_log_trace_id_idx" ON "public"."ai_call_log" USING "btree" ("trace_id") WHERE ("trace_id" IS NOT NULL);



CREATE INDEX "ai_engine_recommendation_snapshots_scope_idx" ON "public"."ai_engine_recommendation_snapshots" USING "btree" ("surface", "window_days", "snapshot_date" DESC);



CREATE INDEX "ai_output_feedback_created_at_idx" ON "public"."ai_output_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "ai_output_feedback_signal_metadata_gin_idx" ON "public"."ai_output_feedback" USING "gin" ("signal_metadata");



CREATE INDEX "ai_output_feedback_surface_created_at_idx" ON "public"."ai_output_feedback" USING "btree" ("surface", "created_at" DESC);



CREATE INDEX "ai_visual_generation_jobs_company_jobsite_created_idx" ON "public"."ai_visual_generation_jobs" USING "btree" ("company_id", "jobsite_id", "created_at" DESC);



CREATE INDEX "ai_visual_generation_jobs_prompt_hash_idx" ON "public"."ai_visual_generation_jobs" USING "btree" ("company_id", "jobsite_id", "prompt_hash", "created_at" DESC) WHERE ("prompt_hash" IS NOT NULL);



CREATE INDEX "ai_visual_generation_jobs_status_created_idx" ON "public"."ai_visual_generation_jobs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "behavior_risk_events_company_status_idx" ON "public"."behavior_risk_events" USING "btree" ("company_id", "status", "created_at" DESC);



CREATE INDEX "behavior_risk_events_crew_id_idx" ON "public"."behavior_risk_events" USING "btree" ("crew_id");



CREATE INDEX "behavior_risk_events_driver_idx" ON "public"."behavior_risk_events" USING "btree" ("company_id", "risk_driver", "created_at" DESC);



CREATE INDEX "behavior_risk_events_jobsite_id_idx" ON "public"."behavior_risk_events" USING "btree" ("jobsite_id");



CREATE INDEX "behavior_risk_events_jobsite_idx" ON "public"."behavior_risk_events" USING "btree" ("company_id", "jobsite_id", "created_at" DESC) WHERE ("jobsite_id" IS NOT NULL);



CREATE INDEX "behavior_risk_events_supervisor_id_idx" ON "public"."behavior_risk_events" USING "btree" ("supervisor_id");



CREATE INDEX "billing_customers_billing_email_idx" ON "public"."billing_customers" USING "btree" ("lower"("billing_email"));



CREATE INDEX "billing_customers_company_id_idx" ON "public"."billing_customers" USING "btree" ("company_id");



CREATE INDEX "billing_events_created_by_user_id_idx" ON "public"."billing_events" USING "btree" ("created_by_user_id");



CREATE INDEX "billing_events_invoice_id_idx" ON "public"."billing_events" USING "btree" ("invoice_id", "created_at" DESC);



CREATE INDEX "billing_invoice_line_items_invoice_id_idx" ON "public"."billing_invoice_line_items" USING "btree" ("invoice_id", "sort_order");



CREATE INDEX "billing_invoice_payments_created_by_user_id_idx" ON "public"."billing_invoice_payments" USING "btree" ("created_by_user_id");



CREATE UNIQUE INDEX "billing_invoice_payments_external_payment_id_unique" ON "public"."billing_invoice_payments" USING "btree" ("external_payment_id") WHERE ("external_payment_id" IS NOT NULL);



CREATE INDEX "billing_invoice_payments_invoice_id_idx" ON "public"."billing_invoice_payments" USING "btree" ("invoice_id", "created_at" DESC);



CREATE INDEX "billing_invoices_billing_period_key_idx" ON "public"."billing_invoices" USING "btree" ("company_id", "billing_source", "billing_period_key");



CREATE INDEX "billing_invoices_company_id_idx" ON "public"."billing_invoices" USING "btree" ("company_id");



CREATE INDEX "billing_invoices_created_by_user_id_idx" ON "public"."billing_invoices" USING "btree" ("created_by_user_id");



CREATE INDEX "billing_invoices_customer_id_idx" ON "public"."billing_invoices" USING "btree" ("customer_id");



CREATE INDEX "billing_invoices_due_date_idx" ON "public"."billing_invoices" USING "btree" ("due_date");



CREATE INDEX "billing_invoices_issue_date_idx" ON "public"."billing_invoices" USING "btree" ("issue_date" DESC);



CREATE UNIQUE INDEX "billing_invoices_recurring_period_unique_idx" ON "public"."billing_invoices" USING "btree" ("company_id", "billing_period_key") WHERE (("billing_source" = 'recurring_company_pricing'::"text") AND ("billing_period_key" IS NOT NULL));



CREATE INDEX "billing_invoices_status_idx" ON "public"."billing_invoices" USING "btree" ("status");



CREATE INDEX "billing_staff_company_assignments_company_idx" ON "public"."billing_staff_company_assignments" USING "btree" ("company_id");



CREATE INDEX "billing_staff_company_assignments_created_by_idx" ON "public"."billing_staff_company_assignments" USING "btree" ("created_by");



CREATE INDEX "billing_staff_company_assignments_staff_idx" ON "public"."billing_staff_company_assignments" USING "btree" ("staff_user_id");



CREATE INDEX "companies_demo_company_idx" ON "public"."companies" USING "btree" ("demo_company", "created_by", "updated_at" DESC) WHERE ("demo_company" = true);



CREATE INDEX "companies_industry_code_idx" ON "public"."companies" USING "btree" ("industry_code") WHERE ("industry_code" IS NOT NULL);



CREATE INDEX "company_ai_reviews_bucket_run_id_idx" ON "public"."company_ai_reviews" USING "btree" ("bucket_run_id");



CREATE INDEX "company_ai_reviews_created_by_idx" ON "public"."company_ai_reviews" USING "btree" ("created_by");



CREATE INDEX "company_ai_reviews_jobsite_id_idx" ON "public"."company_ai_reviews" USING "btree" ("jobsite_id");



CREATE INDEX "company_ai_reviews_scope_idx" ON "public"."company_ai_reviews" USING "btree" ("company_id", "jobsite_id", "status", "updated_at" DESC);



CREATE INDEX "company_ai_reviews_updated_by_idx" ON "public"."company_ai_reviews" USING "btree" ("updated_by");



CREATE INDEX "company_analytics_snapshots_company_date_idx" ON "public"."company_analytics_snapshots" USING "btree" ("company_id", "snapshot_date" DESC);



CREATE UNIQUE INDEX "company_analytics_snapshots_unique_idx" ON "public"."company_analytics_snapshots" USING "btree" ("company_id", "jobsite_id", "snapshot_date");



CREATE INDEX "company_audit_customer_locations_company_customer_idx" ON "public"."company_audit_customer_locations" USING "btree" ("company_id", "audit_customer_id", "status", "updated_at" DESC);



CREATE UNIQUE INDEX "company_audit_customer_locations_customer_name_unique_ci_idx" ON "public"."company_audit_customer_locations" USING "btree" ("company_id", "audit_customer_id", "lower"("name"));



CREATE UNIQUE INDEX "company_audit_customers_company_name_unique_ci_idx" ON "public"."company_audit_customers" USING "btree" ("company_id", "lower"("name"));



CREATE INDEX "company_audit_customers_company_status_idx" ON "public"."company_audit_customers" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_auditflow_action_links_action_idx" ON "public"."company_auditflow_corrective_action_links" USING "btree" ("company_id", "action_id");



CREATE INDEX "company_auditflow_assignments_assigned_user_id_idx" ON "public"."company_auditflow_assignments" USING "btree" ("assigned_user_id");



CREATE INDEX "company_auditflow_assignments_assignee_idx" ON "public"."company_auditflow_assignments" USING "btree" ("company_id", "assigned_user_id", "status", "due_at");



CREATE INDEX "company_auditflow_assignments_company_status_idx" ON "public"."company_auditflow_assignments" USING "btree" ("company_id", "status", "due_at", "updated_at" DESC);



CREATE INDEX "company_auditflow_assignments_created_by_idx" ON "public"."company_auditflow_assignments" USING "btree" ("created_by");



CREATE INDEX "company_auditflow_assignments_jobsite_id_idx" ON "public"."company_auditflow_assignments" USING "btree" ("jobsite_id");



CREATE INDEX "company_auditflow_assignments_template_id_idx" ON "public"."company_auditflow_assignments" USING "btree" ("template_id");



CREATE INDEX "company_auditflow_assignments_template_version_id_idx" ON "public"."company_auditflow_assignments" USING "btree" ("template_version_id");



CREATE INDEX "company_auditflow_assignments_updated_by_idx" ON "public"."company_auditflow_assignments" USING "btree" ("updated_by");



CREATE INDEX "company_auditflow_submissions_assignment_id_idx" ON "public"."company_auditflow_submissions" USING "btree" ("assignment_id");



CREATE INDEX "company_auditflow_submissions_assignment_idx" ON "public"."company_auditflow_submissions" USING "btree" ("company_id", "assignment_id", "submitted_at" DESC);



CREATE INDEX "company_auditflow_submissions_jobsite_id_idx" ON "public"."company_auditflow_submissions" USING "btree" ("jobsite_id");



CREATE INDEX "company_auditflow_submissions_reviewed_by_idx" ON "public"."company_auditflow_submissions" USING "btree" ("reviewed_by");



CREATE INDEX "company_auditflow_submissions_submitted_by_idx" ON "public"."company_auditflow_submissions" USING "btree" ("submitted_by");



CREATE INDEX "company_auditflow_submissions_template_id_idx" ON "public"."company_auditflow_submissions" USING "btree" ("template_id");



CREATE INDEX "company_auditflow_submissions_template_version_id_idx" ON "public"."company_auditflow_submissions" USING "btree" ("template_version_id");



CREATE INDEX "company_auditflow_template_versions_template_idx" ON "public"."company_auditflow_template_versions" USING "btree" ("template_id", "version" DESC);



CREATE INDEX "company_auditflow_templates_company_idx" ON "public"."company_auditflow_templates" USING "btree" ("company_id", "active", "updated_at" DESC);



CREATE INDEX "company_bucket_items_bucket_run_id_idx" ON "public"."company_bucket_items" USING "btree" ("bucket_run_id");



CREATE INDEX "company_bucket_items_created_by_idx" ON "public"."company_bucket_items" USING "btree" ("created_by");



CREATE INDEX "company_bucket_items_jobsite_id_idx" ON "public"."company_bucket_items" USING "btree" ("jobsite_id");



CREATE INDEX "company_bucket_items_payload_gin" ON "public"."company_bucket_items" USING "gin" ("bucket_payload");



CREATE INDEX "company_bucket_items_rule_results_gin" ON "public"."company_bucket_items" USING "gin" ("rule_results");



CREATE INDEX "company_bucket_items_scope_idx" ON "public"."company_bucket_items" USING "btree" ("company_id", "jobsite_id", "ai_ready", "updated_at" DESC);



CREATE INDEX "company_bucket_items_time_idx" ON "public"."company_bucket_items" USING "btree" ("company_id", "work_area_id", "starts_at", "ends_at");



CREATE INDEX "company_bucket_items_updated_by_idx" ON "public"."company_bucket_items" USING "btree" ("updated_by");



CREATE INDEX "company_bucket_runs_created_by_idx" ON "public"."company_bucket_runs" USING "btree" ("created_by");



CREATE INDEX "company_bucket_runs_jobsite_id_idx" ON "public"."company_bucket_runs" USING "btree" ("jobsite_id");



CREATE INDEX "company_bucket_runs_scope_idx" ON "public"."company_bucket_runs" USING "btree" ("company_id", "jobsite_id", "run_status", "updated_at" DESC);



CREATE UNIQUE INDEX "company_checklist_items_section_title_idx" ON "public"."company_checklist_items" USING "btree" ("section", "title");



CREATE INDEX "company_conflict_pairs_overlap_gin" ON "public"."company_conflict_pairs" USING "gin" ("overlap_scope");



CREATE INDEX "company_conflict_pairs_scope_idx" ON "public"."company_conflict_pairs" USING "btree" ("company_id", "jobsite_id", "status", "updated_at" DESC);



CREATE INDEX "company_conflict_rules_lookup_idx" ON "public"."company_conflict_rules" USING "btree" ("company_id", "conflict_code", "left_trade_code", "right_trade_code");



CREATE INDEX "company_contractor_documents_contractor_idx" ON "public"."company_contractor_documents" USING "btree" ("company_id", "contractor_id", "expires_on");



CREATE INDEX "company_contractor_evaluations_contractor_idx" ON "public"."company_contractor_evaluations" USING "btree" ("company_id", "contractor_id", "evaluated_at" DESC);



CREATE INDEX "company_contractors_company_active_idx" ON "public"."company_contractors" USING "btree" ("company_id", "active", "name");



CREATE INDEX "company_corrective_action_events_action_id_idx" ON "public"."company_corrective_action_events" USING "btree" ("action_id");



CREATE INDEX "company_corrective_action_events_action_idx" ON "public"."company_corrective_action_events" USING "btree" ("action_id", "created_at" DESC);



CREATE INDEX "company_corrective_action_events_company_idx" ON "public"."company_corrective_action_events" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_corrective_action_events_created_by_idx" ON "public"."company_corrective_action_events" USING "btree" ("created_by");



CREATE INDEX "company_corrective_action_evidence_action_idx" ON "public"."company_corrective_action_evidence" USING "btree" ("action_id", "created_at" DESC);



CREATE INDEX "company_corrective_action_evidence_company_idx" ON "public"."company_corrective_action_evidence" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_corrective_actions_assignee_idx" ON "public"."company_corrective_actions" USING "btree" ("company_id", "assigned_user_id", "status", "due_at");



CREATE INDEX "company_corrective_actions_category_idx" ON "public"."company_corrective_actions" USING "btree" ("company_id", "category", "status", "updated_at" DESC);



CREATE INDEX "company_corrective_actions_company_status_idx" ON "public"."company_corrective_actions" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_corrective_actions_due_idx" ON "public"."company_corrective_actions" USING "btree" ("company_id", "due_at") WHERE ("status" <> 'closed'::"text");



CREATE INDEX "company_corrective_actions_prediction_review_idx" ON "public"."company_corrective_actions" USING "btree" ("company_id", "prediction_validation_status", "created_at" DESC);



CREATE INDEX "company_corrective_actions_proof_status_idx" ON "public"."company_corrective_actions" USING "btree" ("company_id", "proof_status", "updated_at" DESC);



CREATE UNIQUE INDEX "company_corrective_actions_source_sor_unique_idx" ON "public"."company_corrective_actions" USING "btree" ("source_sor_id") WHERE ("source_sor_id" IS NOT NULL);



CREATE INDEX "company_corrective_actions_source_submission_idx" ON "public"."company_corrective_actions" USING "btree" ("source_submission_id");



CREATE INDEX "company_corrective_actions_source_type_idx" ON "public"."company_corrective_actions" USING "btree" ("company_id", "source_type", "updated_at" DESC);



CREATE INDEX "company_credit_transactions_company_created_at_idx" ON "public"."company_credit_transactions" USING "btree" ("company_id", "created_at" DESC);



CREATE UNIQUE INDEX "company_credit_transactions_marketplace_credit_pack_unique" ON "public"."company_credit_transactions" USING "btree" ("company_id", (("metadata" ->> 'invoice_id'::"text"))) WHERE (("transaction_type" = 'grant'::"text") AND (("metadata" ->> 'source'::"text") = 'marketplace_credit_pack'::"text") AND (("metadata" ->> 'invoice_id'::"text") IS NOT NULL));



CREATE INDEX "company_crews_company_active_idx" ON "public"."company_crews" USING "btree" ("company_id", "active", "name");



CREATE INDEX "company_crews_company_jobsite_idx" ON "public"."company_crews" USING "btree" ("company_id", "jobsite_id") WHERE ("jobsite_id" IS NOT NULL);



CREATE INDEX "company_data_requests_company_created_idx" ON "public"."company_data_requests" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_data_requests_company_status_idx" ON "public"."company_data_requests" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_data_requests_subject_email_idx" ON "public"."company_data_requests" USING "btree" ("company_id", "lower"("subject_email")) WHERE ("subject_email" IS NOT NULL);



CREATE INDEX "company_data_requests_subject_user_idx" ON "public"."company_data_requests" USING "btree" ("company_id", "subject_user_id") WHERE ("subject_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "company_employee_jobsite_assignments_active_unique" ON "public"."company_employee_jobsite_assignments" USING "btree" ("company_id", "employee_id", "jobsite_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "company_employee_jobsite_assignments_company_jobsite_idx" ON "public"."company_employee_jobsite_assignments" USING "btree" ("company_id", "jobsite_id", "status");



CREATE INDEX "company_employee_jobsite_assignments_employee_idx" ON "public"."company_employee_jobsite_assignments" USING "btree" ("employee_id", "status");



CREATE UNIQUE INDEX "company_employee_profiles_company_email_unique" ON "public"."company_employee_profiles" USING "btree" ("company_id", "email_normalized") WHERE (("email_normalized" IS NOT NULL) AND ("email_normalized" <> ''::"text"));



CREATE UNIQUE INDEX "company_employee_profiles_company_external_id_unique" ON "public"."company_employee_profiles" USING "btree" ("company_id", "external_employee_id") WHERE (("external_employee_id" IS NOT NULL) AND ("external_employee_id" <> ''::"text"));



CREATE INDEX "company_employee_profiles_company_status_idx" ON "public"."company_employee_profiles" USING "btree" ("company_id", "status", "full_name");



CREATE INDEX "company_employee_training_records_employee_idx" ON "public"."company_employee_training_records" USING "btree" ("company_id", "employee_id", "expires_on");



CREATE INDEX "company_employee_training_records_requirement_idx" ON "public"."company_employee_training_records" USING "btree" ("company_id", "requirement_id");



CREATE INDEX "company_finance_budgets_period_idx" ON "public"."company_finance_budgets" USING "btree" ("period_start" DESC, "budget_type", "category");



CREATE INDEX "company_finance_receipts_transaction_idx" ON "public"."company_finance_receipts" USING "btree" ("transaction_id");



CREATE INDEX "company_finance_recurring_items_status_idx" ON "public"."company_finance_recurring_items" USING "btree" ("status", "next_due_date");



CREATE INDEX "company_finance_transactions_status_idx" ON "public"."company_finance_transactions" USING "btree" ("status");



CREATE INDEX "company_finance_transactions_type_date_idx" ON "public"."company_finance_transactions" USING "btree" ("transaction_type", "transaction_date" DESC);



CREATE INDEX "company_generated_document_versions_scope_idx" ON "public"."company_generated_document_versions" USING "btree" ("company_id", "generated_document_id", "version_number" DESC);



CREATE INDEX "company_generated_documents_risk_outputs_gin" ON "public"."company_generated_documents" USING "gin" ("risk_outputs");



CREATE INDEX "company_generated_documents_scope_idx" ON "public"."company_generated_documents" USING "btree" ("company_id", "jobsite_id", "status", "updated_at" DESC);



CREATE INDEX "company_hris_roster_imports_company_idx" ON "public"."company_hris_roster_imports" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_incidents_company_body_part_idx" ON "public"."company_incidents" USING "btree" ("company_id", "body_part") WHERE ("body_part" IS NOT NULL);



CREATE INDEX "company_incidents_company_dart_idx" ON "public"."company_incidents" USING "btree" ("company_id", "days_away_from_work", "days_restricted") WHERE (("days_away_from_work" > 0) OR ("days_restricted" > 0) OR ("job_transfer" = true));



CREATE INDEX "company_incidents_company_exposure_event_type_idx" ON "public"."company_incidents" USING "btree" ("company_id", "exposure_event_type") WHERE ("exposure_event_type" IS NOT NULL);



CREATE INDEX "company_incidents_company_fatality_idx" ON "public"."company_incidents" USING "btree" ("company_id", "fatality") WHERE ("fatality" = true);



CREATE INDEX "company_incidents_company_injury_month_idx" ON "public"."company_incidents" USING "btree" ("company_id", "injury_month") WHERE ("injury_month" IS NOT NULL);



CREATE INDEX "company_incidents_company_injury_season_idx" ON "public"."company_incidents" USING "btree" ("company_id", "injury_season") WHERE ("injury_season" IS NOT NULL);



CREATE INDEX "company_incidents_company_injury_source_idx" ON "public"."company_incidents" USING "btree" ("company_id", "injury_source") WHERE ("injury_source" IS NOT NULL);



CREATE INDEX "company_incidents_company_injury_type_idx" ON "public"."company_incidents" USING "btree" ("company_id", "injury_type") WHERE ("injury_type" IS NOT NULL);



CREATE INDEX "company_incidents_company_recordable_idx" ON "public"."company_incidents" USING "btree" ("company_id", "recordable") WHERE ("recordable" = true);



CREATE INDEX "company_incidents_company_status_idx" ON "public"."company_incidents" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_incidents_prediction_injury_review_idx" ON "public"."company_incidents" USING "btree" ("company_id", "prediction_validation_status", "injury_type", "body_part", "created_at" DESC) WHERE (("injury_type" IS NOT NULL) OR ("body_part" IS NOT NULL));



CREATE INDEX "company_incidents_prediction_review_idx" ON "public"."company_incidents" USING "btree" ("company_id", "prediction_validation_status", "created_at" DESC);



CREATE INDEX "company_incidents_sif_idx" ON "public"."company_incidents" USING "btree" ("company_id", "sif_flag", "escalation_level", "updated_at" DESC);



CREATE INDEX "company_induction_completions_expires_idx" ON "public"."company_induction_completions" USING "btree" ("company_id", "expires_at");



CREATE INDEX "company_induction_completions_user_idx" ON "public"."company_induction_completions" USING "btree" ("company_id", "user_id", "program_id", "jobsite_id");



CREATE INDEX "company_induction_programs_company_active_idx" ON "public"."company_induction_programs" USING "btree" ("company_id", "active", "name");



CREATE INDEX "company_induction_requirements_lookup_idx" ON "public"."company_induction_requirements" USING "btree" ("company_id", "active", "jobsite_id", "program_id");



CREATE INDEX "company_inspection_calendar_signoffs_company_year_idx" ON "public"."company_inspection_calendar_signoffs" USING "btree" ("company_id", "calendar_year", "due_date", "status");



CREATE INDEX "company_inspection_calendar_signoffs_customer_idx" ON "public"."company_inspection_calendar_signoffs" USING "btree" ("company_id", "audit_customer_id", "audit_customer_location_id", "due_date");



CREATE UNIQUE INDEX "company_inspection_calendar_signoffs_unique_scope_idx" ON "public"."company_inspection_calendar_signoffs" USING "btree" ("company_id", "scope_key", "due_date", "template_key");



CREATE INDEX "company_integration_webhook_deliveries_webhook_idx" ON "public"."company_integration_webhook_deliveries" USING "btree" ("webhook_id", "delivered_at" DESC);



CREATE INDEX "company_integration_webhooks_company_idx" ON "public"."company_integration_webhooks" USING "btree" ("company_id", "active");



CREATE UNIQUE INDEX "company_invites_email_company_active_idx" ON "public"."company_invites" USING "btree" ("lower"("email"), "company_id") WHERE ("consumed_at" IS NULL);



CREATE INDEX "company_jobsite_assignments_company_user_idx" ON "public"."company_jobsite_assignments" USING "btree" ("company_id", "user_id");



CREATE INDEX "company_jobsite_audit_observation_evidence_obs_idx" ON "public"."company_jobsite_audit_observation_evidence" USING "btree" ("company_id", "observation_id", "created_at" DESC);



CREATE INDEX "company_jobsite_audit_observations_scope_idx" ON "public"."company_jobsite_audit_observations" USING "btree" ("company_id", "jobsite_id", "status", "created_at" DESC);



CREATE INDEX "company_jobsite_audit_observations_trade_idx" ON "public"."company_jobsite_audit_observations" USING "btree" ("company_id", "trade_code", "category_code", "severity", "created_at" DESC);



CREATE INDEX "company_jobsite_audit_report_deliveries_audit_idx" ON "public"."company_jobsite_audit_report_deliveries" USING "btree" ("company_id", "audit_id", "created_at" DESC);



CREATE INDEX "company_jobsite_audit_report_deliveries_recipient_idx" ON "public"."company_jobsite_audit_report_deliveries" USING "btree" ("company_id", "recipient_email", "created_at" DESC);



CREATE INDEX "company_jobsite_audit_signoffs_audit_idx" ON "public"."company_jobsite_audit_signoffs" USING "btree" ("company_id", "audit_id", "signed_at" DESC);



CREATE INDEX "company_jobsite_audits_ai_review_idx" ON "public"."company_jobsite_audits" USING "btree" ("company_id", "ai_review_status", "updated_at" DESC);



CREATE INDEX "company_jobsite_audits_audit_customer_idx" ON "public"."company_jobsite_audits" USING "btree" ("company_id", "audit_customer_id", "audit_customer_location_id", "created_at" DESC);



CREATE INDEX "company_jobsite_audits_scope_idx" ON "public"."company_jobsite_audits" USING "btree" ("company_id", "jobsite_id", "audit_date" DESC, "created_at" DESC);



CREATE INDEX "company_jobsite_audits_trade_idx" ON "public"."company_jobsite_audits" USING "btree" ("company_id", "selected_trade", "created_at" DESC);



CREATE INDEX "company_jobsite_chemicals_scope_idx" ON "public"."company_jobsite_chemicals" USING "btree" ("company_id", "jobsite_id", "next_review_date");



CREATE INDEX "company_jobsite_daily_todos_company_date_idx" ON "public"."company_jobsite_daily_todos" USING "btree" ("company_id", "work_date" DESC, "status", "priority");



CREATE INDEX "company_jobsite_daily_todos_jobsite_date_idx" ON "public"."company_jobsite_daily_todos" USING "btree" ("jobsite_id", "work_date" DESC, "role", "status");



CREATE INDEX "company_jobsite_schedule_items_active_idx" ON "public"."company_jobsite_schedule_items" USING "btree" ("company_id", "jobsite_id", "status", "archived_at") WHERE ("archived_at" IS NULL);



CREATE INDEX "company_jobsite_schedule_items_company_jobsite_date_idx" ON "public"."company_jobsite_schedule_items" USING "btree" ("company_id", "jobsite_id", "work_start_date", "work_end_date");



CREATE INDEX "company_jobsite_schedule_items_company_jobsite_risk_idx" ON "public"."company_jobsite_schedule_items" USING "btree" ("company_id", "jobsite_id", "risk_level", "is_high_risk", "work_start_date") WHERE ("archived_at" IS NULL);



CREATE INDEX "company_jobsite_schedule_items_hazard_categories_gin_idx" ON "public"."company_jobsite_schedule_items" USING "gin" ("hazard_categories");



CREATE INDEX "company_jobsite_schedule_items_permit_triggers_gin_idx" ON "public"."company_jobsite_schedule_items" USING "gin" ("permit_triggers");



CREATE INDEX "company_jobsite_site_blueprints_company_jobsite_idx" ON "public"."company_jobsite_site_blueprints" USING "btree" ("company_id", "jobsite_id", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "company_jobsite_site_blueprints_ready_idx" ON "public"."company_jobsite_site_blueprints" USING "btree" ("company_id", "jobsite_id", "updated_at" DESC) WHERE (("archived_at" IS NULL) AND ("processing_status" = 'ready'::"text"));



CREATE INDEX "company_jobsite_site_maps_blueprint_idx" ON "public"."company_jobsite_site_maps" USING "btree" ("blueprint_id") WHERE ("blueprint_id" IS NOT NULL);



CREATE INDEX "company_jobsite_site_maps_company_jobsite_idx" ON "public"."company_jobsite_site_maps" USING "btree" ("company_id", "jobsite_id", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "company_jobsite_site_renders_blueprint_idx" ON "public"."company_jobsite_site_renders" USING "btree" ("blueprint_id") WHERE (("blueprint_id" IS NOT NULL) AND ("archived_at" IS NULL));



CREATE INDEX "company_jobsite_site_renders_company_jobsite_idx" ON "public"."company_jobsite_site_renders" USING "btree" ("company_id", "jobsite_id", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "company_jobsite_site_renders_site_map_idx" ON "public"."company_jobsite_site_renders" USING "btree" ("site_map_id") WHERE (("site_map_id" IS NOT NULL) AND ("archived_at" IS NULL));



CREATE INDEX "company_jobsite_visual_zones_map_idx" ON "public"."company_jobsite_visual_zones" USING "btree" ("company_id", "jobsite_id", "site_map_id", "created_at");



CREATE INDEX "company_jobsite_visual_zones_schedule_idx" ON "public"."company_jobsite_visual_zones" USING "btree" ("schedule_item_id") WHERE ("schedule_item_id" IS NOT NULL);



CREATE INDEX "company_jobsites_audit_customer_idx" ON "public"."company_jobsites" USING "btree" ("company_id", "audit_customer_id", "status");



CREATE UNIQUE INDEX "company_jobsites_company_jobsite_number_unique_ci_idx" ON "public"."company_jobsites" USING "btree" ("company_id", "lower"("jobsite_number"));



CREATE UNIQUE INDEX "company_jobsites_company_name_unique_ci_idx" ON "public"."company_jobsites" USING "btree" ("company_id", "lower"("name"));



CREATE INDEX "company_jobsites_company_status_idx" ON "public"."company_jobsites" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_jobsites_weather_enabled_idx" ON "public"."company_jobsites" USING "btree" ("weather_enabled", "weather_last_checked_at") WHERE ("weather_enabled" = true);



CREATE INDEX "company_jobsites_weather_location_idx" ON "public"."company_jobsites" USING "btree" ("weather_latitude", "weather_longitude") WHERE (("weather_latitude" IS NOT NULL) AND ("weather_longitude" IS NOT NULL));



CREATE INDEX "company_jsa_activities_company_work_date_idx" ON "public"."company_jsa_activities" USING "btree" ("company_id", "work_date" DESC, "updated_at" DESC);



CREATE INDEX "company_jsa_activities_ppe_requirements_gin_idx" ON "public"."company_jsa_activities" USING "gin" ("ppe_requirements");



CREATE INDEX "company_jsa_signoffs_jsa_idx" ON "public"."company_jsa_signoffs" USING "btree" ("company_id", "jsa_id", "signed_at" DESC);



CREATE INDEX "company_jsas_company_status_idx" ON "public"."company_jsas" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_leadership_safety_scores_company_window_idx" ON "public"."company_leadership_safety_scores" USING "btree" ("company_id", "window_end" DESC, "score" DESC);



CREATE INDEX "company_leadership_safety_scores_user_window_idx" ON "public"."company_leadership_safety_scores" USING "btree" ("company_id", "user_id", "window_end" DESC);



CREATE INDEX "company_memory_items_company_created_idx" ON "public"."company_memory_items" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_memory_items_company_id_idx" ON "public"."company_memory_items" USING "btree" ("company_id");



CREATE INDEX "company_memory_items_embedding_hnsw" ON "public"."company_memory_items" USING "hnsw" ("embedding" "public"."vector_cosine_ops") WHERE ("embedding" IS NOT NULL);



CREATE INDEX "company_mobile_feature_entitlements_scope_idx" ON "public"."company_mobile_feature_entitlements" USING "btree" ("company_id", "user_id", "feature");



CREATE INDEX "company_notification_preferences_user_idx" ON "public"."company_notification_preferences" USING "btree" ("user_id", "company_id");



CREATE INDEX "company_notifications_company_event_idx" ON "public"."company_notifications" USING "btree" ("company_id", "event_type", "created_at" DESC);



CREATE INDEX "company_notifications_recipient_unread_idx" ON "public"."company_notifications" USING "btree" ("recipient_user_id", "company_id", "created_at" DESC) WHERE (("read_at" IS NULL) AND ("archived_at" IS NULL));



CREATE INDEX "company_notifications_source_idx" ON "public"."company_notifications" USING "btree" ("source_table", "source_id") WHERE (("source_table" IS NOT NULL) AND ("source_id" IS NOT NULL));



CREATE INDEX "company_onboarding_imports_company_created_idx" ON "public"."company_onboarding_imports" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_permit_trigger_rules_lookup_idx" ON "public"."company_permit_trigger_rules" USING "btree" ("company_id", "permit_code", "trade_code", "task_code");



CREATE UNIQUE INDEX "company_permit_trigger_rules_uidx" ON "public"."company_permit_trigger_rules" USING "btree" ("company_id", "permit_code", COALESCE("trade_code", ''::"text"), COALESCE("task_code", ''::"text"), COALESCE("hazard_family", ''::"text"), COALESCE("work_condition", ''::"text"), COALESCE("weather_condition", ''::"text"));



CREATE UNIQUE INDEX "company_permits_auto_schedule_open_unique_idx" ON "public"."company_permits" USING "btree" ("company_id", "jobsite_id", "schedule_item_id", "lower"("permit_type")) WHERE (("auto_assigned" IS TRUE) AND ("schedule_item_id" IS NOT NULL) AND ("status" = ANY (ARRAY['draft'::"text", 'active'::"text"])));



CREATE INDEX "company_permits_company_status_idx" ON "public"."company_permits" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_permits_schedule_item_idx" ON "public"."company_permits" USING "btree" ("company_id", "jobsite_id", "schedule_item_id", "updated_at" DESC) WHERE ("schedule_item_id" IS NOT NULL);



CREATE INDEX "company_permits_sif_idx" ON "public"."company_permits" USING "btree" ("company_id", "sif_flag", "escalation_level", "updated_at" DESC);



CREATE INDEX "company_positions_department_idx" ON "public"."company_positions" USING "btree" ("department");



CREATE INDEX "company_positions_parent_position_id_idx" ON "public"."company_positions" USING "btree" ("parent_position_id");



CREATE INDEX "company_positions_status_idx" ON "public"."company_positions" USING "btree" ("status");



CREATE INDEX "company_report_attachments_company_report_idx" ON "public"."company_report_attachments" USING "btree" ("company_id", "report_id", "created_at" DESC);



CREATE INDEX "company_reports_company_status_idx" ON "public"."company_reports" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_risk_ai_recommendations_action_type_idx" ON "public"."company_risk_ai_recommendations" USING "btree" ("company_id", "action_type", "mitigation_state", "created_at" DESC);



CREATE INDEX "company_risk_ai_recommendations_company_created_idx" ON "public"."company_risk_ai_recommendations" USING "btree" ("company_id", "created_at" DESC) WHERE ("dismissed" = false);



CREATE INDEX "company_risk_ai_recommendations_owner_idx" ON "public"."company_risk_ai_recommendations" USING "btree" ("company_id", "owner_user_id", "status") WHERE ("owner_user_id" IS NOT NULL);



CREATE INDEX "company_risk_ai_recommendations_workflow_idx" ON "public"."company_risk_ai_recommendations" USING "btree" ("company_id", "status", "priority", "created_at" DESC);



CREATE INDEX "company_risk_events_scope_idx" ON "public"."company_risk_events" USING "btree" ("company_id", "module_name", "created_at" DESC);



CREATE INDEX "company_risk_memory_facets_behavior_idx" ON "public"."company_risk_memory_facets" USING "btree" ("company_id", "behavior_category") WHERE ("behavior_category" IS NOT NULL);



CREATE INDEX "company_risk_memory_facets_company_scope_idx" ON "public"."company_risk_memory_facets" USING "btree" ("company_id", "scope_of_work_code") WHERE ("scope_of_work_code" IS NOT NULL);



CREATE INDEX "company_risk_memory_facets_company_updated_idx" ON "public"."company_risk_memory_facets" USING "btree" ("company_id", "updated_at" DESC);



CREATE INDEX "company_risk_memory_facets_contractor_idx" ON "public"."company_risk_memory_facets" USING "btree" ("company_id", "contractor_id") WHERE ("contractor_id" IS NOT NULL);



CREATE INDEX "company_risk_memory_facets_crew_idx" ON "public"."company_risk_memory_facets" USING "btree" ("company_id", "crew_id") WHERE ("crew_id" IS NOT NULL);



CREATE INDEX "company_risk_memory_facets_details_gin" ON "public"."company_risk_memory_facets" USING "gin" ("details");



CREATE INDEX "company_risk_memory_facets_secondary_gin" ON "public"."company_risk_memory_facets" USING "gin" ("secondary_hazard_codes");



CREATE UNIQUE INDEX "company_risk_memory_facets_source_uidx" ON "public"."company_risk_memory_facets" USING "btree" ("company_id", "source_module", "source_id");



CREATE INDEX "company_risk_memory_snapshots_company_date_idx" ON "public"."company_risk_memory_snapshots" USING "btree" ("company_id", "snapshot_date" DESC);



CREATE UNIQUE INDEX "company_risk_memory_snapshots_uidx" ON "public"."company_risk_memory_snapshots" USING "btree" ("company_id", "jobsite_id", "snapshot_date");



CREATE INDEX "company_risk_recommendation_events_company_created_idx" ON "public"."company_risk_recommendation_events" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_risk_recommendation_events_recommendation_idx" ON "public"."company_risk_recommendation_events" USING "btree" ("recommendation_id", "created_at" DESC);



CREATE UNIQUE INDEX "company_risk_scores_company_daily_uidx" ON "public"."company_risk_scores" USING "btree" ("company_id", "score_date") WHERE (("score_scope" = 'company'::"public"."si_score_scope") AND ("jobsite_id" IS NULL) AND ("bucket_run_id" IS NULL) AND ("bucket_item_id" IS NULL) AND ("trade_code" IS NULL) AND ("task_code" IS NULL) AND ("work_area_id" IS NULL));



CREATE INDEX "company_risk_scores_scope_idx" ON "public"."company_risk_scores" USING "btree" ("company_id", "jobsite_id", "created_at" DESC);



CREATE INDEX "company_risk_scores_time_series_idx" ON "public"."company_risk_scores" USING "btree" ("company_id", "score_date" DESC, "score_scope", "trade_code", "task_code");



CREATE INDEX "company_rule_overrides_company_idx" ON "public"."company_rule_overrides" USING "btree" ("company_id", "active", "precedence");



CREATE INDEX "company_safety_form_definitions_company_idx" ON "public"."company_safety_form_definitions" USING "btree" ("company_id", "active", "title");



CREATE INDEX "company_safety_form_submissions_scope_idx" ON "public"."company_safety_form_submissions" USING "btree" ("company_id", "jobsite_id", "status", "updated_at" DESC);



CREATE INDEX "company_safety_form_versions_definition_idx" ON "public"."company_safety_form_versions" USING "btree" ("definition_id", "version" DESC);



CREATE INDEX "company_safety_intelligence_audit_log_scope_idx" ON "public"."company_safety_intelligence_audit_log" USING "btree" ("company_id", "jobsite_id", "occurred_at" DESC);



CREATE INDEX "company_safety_intelligence_history_scope_idx" ON "public"."company_safety_intelligence_history" USING "btree" ("company_id", "entity_table", "entity_id", "changed_at" DESC);



CREATE INDEX "company_safety_submissions_company_created_idx" ON "public"."company_safety_submissions" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_safety_submissions_jobsite_idx" ON "public"."company_safety_submissions" USING "btree" ("company_id", "jobsite_id", "created_at" DESC);



CREATE INDEX "company_safety_submissions_last_modified_idx" ON "public"."company_safety_submissions" USING "btree" ("company_id", "last_modified" DESC);



CREATE INDEX "company_safety_submissions_review_status_idx" ON "public"."company_safety_submissions" USING "btree" ("company_id", "review_status", "created_at" DESC);



CREATE INDEX "company_schedule_prediction_cache_company_jobsite_date_idx" ON "public"."company_schedule_prediction_cache" USING "btree" ("company_id", "jobsite_id", "prediction_date" DESC);



CREATE UNIQUE INDEX "company_schedule_prediction_cache_daily_unique_idx" ON "public"."company_schedule_prediction_cache" USING "btree" ("company_id", "jobsite_id", "input_fingerprint", "prediction_date");



CREATE INDEX "company_security_events_company_occurred_idx" ON "public"."company_security_events" USING "btree" ("company_id", "occurred_at" DESC);



CREATE INDEX "company_security_events_company_type_idx" ON "public"."company_security_events" USING "btree" ("company_id", "event_type", "occurred_at" DESC);



CREATE INDEX "company_security_events_metadata_idx" ON "public"."company_security_events" USING "gin" ("metadata");



CREATE INDEX "company_security_events_resource_idx" ON "public"."company_security_events" USING "btree" ("company_id", "resource_type", "resource_id");



CREATE INDEX "company_signup_requests_owner_user_id_idx" ON "public"."company_signup_requests" USING "btree" ("owner_user_id");



CREATE UNIQUE INDEX "company_signup_requests_pending_email_idx" ON "public"."company_signup_requests" USING "btree" ("lower"("primary_contact_email")) WHERE ("status" = 'pending'::"text");



CREATE INDEX "company_signup_requests_status_created_at_idx" ON "public"."company_signup_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "company_simultaneous_operations_scope_idx" ON "public"."company_simultaneous_operations" USING "btree" ("company_id", "jobsite_id", "starts_at", "ends_at");



CREATE INDEX "company_sor_records_company_created_idx" ON "public"."company_sor_records" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "company_sor_records_company_hazard_code_idx" ON "public"."company_sor_records" USING "btree" ("company_id", "hazard_category_code") WHERE (("hazard_category_code" IS NOT NULL) AND ("is_deleted" = false));



CREATE INDEX "company_sor_records_company_status_idx" ON "public"."company_sor_records" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "company_sor_records_prediction_review_idx" ON "public"."company_sor_records" USING "btree" ("company_id", "prediction_validation_status", "created_at" DESC);



CREATE INDEX "company_sor_records_previous_version_idx" ON "public"."company_sor_records" USING "btree" ("previous_version_id");



CREATE INDEX "company_task_controls_company_task_idx" ON "public"."company_task_controls" USING "btree" ("company_id", "company_task_id", "control_code");



CREATE INDEX "company_task_hazards_company_task_idx" ON "public"."company_task_hazards" USING "btree" ("company_id", "company_task_id", "hazard_code");



CREATE INDEX "company_task_permit_triggers_company_task_idx" ON "public"."company_task_permit_triggers" USING "btree" ("company_id", "company_task_id", "permit_code");



CREATE INDEX "company_task_training_requirements_company_task_idx" ON "public"."company_task_training_requirements" USING "btree" ("company_id", "company_task_id", "requirement_code");



CREATE INDEX "company_tasks_scope_idx" ON "public"."company_tasks" USING "btree" ("company_id", "jobsite_id", "status", "updated_at" DESC);



CREATE INDEX "company_toolbox_attendees_session_idx" ON "public"."company_toolbox_attendees" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "company_toolbox_sessions_jobsite_idx" ON "public"."company_toolbox_sessions" USING "btree" ("company_id", "jobsite_id", "conducted_at" DESC);



CREATE INDEX "company_toolbox_templates_company_idx" ON "public"."company_toolbox_templates" USING "btree" ("company_id", "active", "name");



CREATE INDEX "company_training_requirements_company_id_idx" ON "public"."company_training_requirements" USING "btree" ("company_id");



CREATE INDEX "company_training_requirements_company_sort_idx" ON "public"."company_training_requirements" USING "btree" ("company_id", "sort_order");



CREATE INDEX "company_users_company_status_idx" ON "public"."company_users" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "contractor_employee_intake_tokens_assignment_idx" ON "public"."contractor_employee_intake_tokens" USING "btree" ("assignment_id", "created_at" DESC);



CREATE INDEX "contractor_employee_jobsite_assignments_scope_idx" ON "public"."contractor_employee_jobsite_assignments" USING "btree" ("company_id", "jobsite_id", "status");



CREATE UNIQUE INDEX "contractor_employee_profiles_email_norm_unique" ON "public"."contractor_employee_profiles" USING "btree" ("email_normalized") WHERE (("email_normalized" IS NOT NULL) AND ("email_normalized" <> ''::"text"));



CREATE UNIQUE INDEX "contractor_employee_profiles_phone_norm_unique" ON "public"."contractor_employee_profiles" USING "btree" ("phone_normalized") WHERE (("phone_normalized" IS NOT NULL) AND ("phone_normalized" <> ''::"text"));



CREATE INDEX "contractor_employee_training_records_employee_idx" ON "public"."contractor_employee_training_records" USING "btree" ("contractor_employee_id", "expires_on");



CREATE UNIQUE INDEX "contractor_employee_training_records_employee_requirement_uniqu" ON "public"."contractor_employee_training_records" USING "btree" ("contractor_employee_id", "requirement_id");



CREATE INDEX "corrective_actions_company_status_idx" ON "public"."corrective_actions" USING "btree" ("company_id", "status", "due_at", "updated_at" DESC);



CREATE INDEX "credit_transactions_document_id_idx" ON "public"."credit_transactions" USING "btree" ("document_id");



CREATE INDEX "credit_transactions_user_id_idx" ON "public"."credit_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "dap_activities_dap_created_idx" ON "public"."dap_activities" USING "btree" ("dap_id", "created_at" DESC);



CREATE INDEX "daps_company_status_idx" ON "public"."daps" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "document_versions_document_idx" ON "public"."document_versions" USING "btree" ("document_id", "version_number" DESC);



CREATE INDEX "documents_status_idx" ON "public"."documents" USING "btree" ("status");



CREATE INDEX "documents_user_id_idx" ON "public"."documents" USING "btree" ("user_id");



CREATE INDEX "employee_profiles_time_card_role_id_idx" ON "public"."employee_profiles" USING "btree" ("time_card_role_id");



CREATE INDEX "employee_time_cards_employee_week_idx" ON "public"."employee_time_cards" USING "btree" ("employee_user_id", "week_start" DESC);



CREATE INDEX "employee_time_cards_status_idx" ON "public"."employee_time_cards" USING "btree" ("status");



CREATE INDEX "employee_time_entries_card_idx" ON "public"."employee_time_entries" USING "btree" ("time_card_id");



CREATE INDEX "employee_time_entries_category_task_idx" ON "public"."employee_time_entries" USING "btree" ("category_id", "task_id");



CREATE INDEX "gus_generated_plans_company_created_idx" ON "public"."gus_generated_plans" USING "btree" ("company_id", "created_at" DESC) WHERE ("company_id" IS NOT NULL);



CREATE INDEX "gus_generated_plans_session_created_idx" ON "public"."gus_generated_plans" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "gus_planning_messages_session_created_idx" ON "public"."gus_planning_messages" USING "btree" ("session_id", "created_at");



CREATE INDEX "gus_planning_sessions_company_created_idx" ON "public"."gus_planning_sessions" USING "btree" ("company_id", "created_at" DESC) WHERE ("company_id" IS NOT NULL);



CREATE INDEX "gus_planning_sessions_jobsite_created_idx" ON "public"."gus_planning_sessions" USING "btree" ("jobsite_id", "created_at" DESC) WHERE ("jobsite_id" IS NOT NULL);



CREATE INDEX "gus_planning_sessions_user_created_idx" ON "public"."gus_planning_sessions" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "incident_notification_deliveries_company_idx" ON "public"."incident_notification_deliveries" USING "btree" ("company_id", "source_table", "source_id", "created_at" DESC);



CREATE INDEX "incident_notification_deliveries_recipient_idx" ON "public"."incident_notification_deliveries" USING "btree" ("recipient_user_id", "company_id", "created_at" DESC);



CREATE INDEX "incident_notification_deliveries_status_idx" ON "public"."incident_notification_deliveries" USING "btree" ("company_id", "status", "created_at" DESC);



CREATE INDEX "incident_root_causes_incident_idx" ON "public"."incident_root_causes" USING "btree" ("incident_id", "created_at" DESC);



CREATE INDEX "incidents_company_status_idx" ON "public"."incidents" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "ingestion_audit_log_company_received_idx" ON "public"."ingestion_audit_log" USING "btree" ("company_id", "received_at" DESC);



CREATE INDEX "ingestion_audit_log_company_status_idx" ON "public"."ingestion_audit_log" USING "btree" ("company_id", "validation_status", "insert_status", "received_at" DESC);



CREATE INDEX "ingestion_audit_log_hash_idx" ON "public"."ingestion_audit_log" USING "btree" ("raw_payload_hash");



CREATE INDEX "ingestion_audit_log_sanitized_payload_gin" ON "public"."ingestion_audit_log" USING "gin" ("sanitized_payload");



CREATE INDEX "injury_forecast_audit_log_company_generated_idx" ON "public"."injury_forecast_audit_log" USING "btree" ("company_id", "generated_at" DESC);



CREATE INDEX "injury_forecast_audit_log_jobsite_generated_idx" ON "public"."injury_forecast_audit_log" USING "btree" ("jobsite_id", "generated_at" DESC) WHERE ("jobsite_id" IS NOT NULL);



CREATE INDEX "injury_weather_backtest_runs_run_at_idx" ON "public"."injury_weather_backtest_runs" USING "btree" ("run_at" DESC);



CREATE INDEX "injury_weather_daily_snapshots_date_idx" ON "public"."injury_weather_daily_snapshots" USING "btree" ("snapshot_date" DESC);



CREATE INDEX "internal_jobsite_audits_created_at_idx" ON "public"."internal_jobsite_audits" USING "btree" ("created_at" DESC);



CREATE INDEX "internal_jobsite_audits_created_by_idx" ON "public"."internal_jobsite_audits" USING "btree" ("created_by_user_id");



CREATE INDEX "jobsite_contractor_training_requirements_position_scope_idx" ON "public"."jobsite_contractor_training_requirements" USING "gin" ("apply_positions");



CREATE INDEX "jobsite_contractor_training_requirements_scope_idx" ON "public"."jobsite_contractor_training_requirements" USING "btree" ("company_id", "jobsite_id", "sort_order");



CREATE INDEX "jobsite_contractor_training_requirements_trade_scope_idx" ON "public"."jobsite_contractor_training_requirements" USING "gin" ("apply_trades");



CREATE INDEX "jobsite_rule_overrides_jobsite_idx" ON "public"."jobsite_rule_overrides" USING "btree" ("company_id", "jobsite_id", "active", "precedence");



CREATE INDEX "jobsite_users_company_user_idx" ON "public"."jobsite_users" USING "btree" ("company_id", "company_user_id");



CREATE INDEX "jobsite_weather_subscriptions_company_jobsite_idx" ON "public"."jobsite_weather_subscriptions" USING "btree" ("company_id", "jobsite_id", "enabled");



CREATE INDEX "jobsite_weather_subscriptions_user_idx" ON "public"."jobsite_weather_subscriptions" USING "btree" ("user_id", "enabled");



CREATE INDEX "jobsites_company_status_idx" ON "public"."jobsites" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "marketplace_document_purchases_company_created_idx" ON "public"."marketplace_document_purchases" USING "btree" ("company_id", "created_at" DESC);



CREATE UNIQUE INDEX "marketplace_document_purchases_company_document_uidx" ON "public"."marketplace_document_purchases" USING "btree" ("company_id", "document_id");



CREATE INDEX "marketplace_document_purchases_document_idx" ON "public"."marketplace_document_purchases" USING "btree" ("document_id");



CREATE INDEX "marketplace_document_purchases_invoice_idx" ON "public"."marketplace_document_purchases" USING "btree" ("invoice_id");



CREATE INDEX "observation_photos_observation_idx" ON "public"."observation_photos" USING "btree" ("observation_id", "created_at" DESC);



CREATE INDEX "observations_company_status_idx" ON "public"."observations" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "osha_predictability_baselines_dimensions_idx" ON "public"."osha_predictability_baselines" USING "btree" ("industry", "incident_type", "job_type", "period_label");



CREATE INDEX "permits_company_status_idx" ON "public"."permits" USING "btree" ("company_id", "status", "updated_at" DESC);



CREATE INDEX "platform_conflict_rules_lookup_idx" ON "public"."platform_conflict_rules" USING "btree" ("conflict_code", "left_trade_code", "right_trade_code");



CREATE INDEX "platform_job_runs_job_started_idx" ON "public"."platform_job_runs" USING "btree" ("job_name", "started_at" DESC);



CREATE INDEX "platform_job_runs_status_started_idx" ON "public"."platform_job_runs" USING "btree" ("status", "started_at" DESC);



CREATE INDEX "platform_jurisdiction_standard_mappings_standard_idx" ON "public"."platform_jurisdiction_standard_mappings" USING "btree" ("standard_id");



CREATE INDEX "platform_jurisdiction_standards_lookup_idx" ON "public"."platform_jurisdiction_standards" USING "btree" ("jurisdiction_code", "surface_scope");



CREATE UNIQUE INDEX "platform_jurisdictions_state_code_uidx" ON "public"."platform_jurisdictions" USING "btree" ("state_code") WHERE ("state_code" IS NOT NULL);



CREATE INDEX "platform_major_construction_fatality_incidents_tags_idx" ON "public"."platform_major_construction_fatality_incidents" USING "gin" ("tags");



CREATE INDEX "platform_major_construction_fatality_incidents_type_idx" ON "public"."platform_major_construction_fatality_incidents" USING "btree" ("incident_type");



CREATE INDEX "platform_major_construction_fatality_incidents_year_idx" ON "public"."platform_major_construction_fatality_incidents" USING "btree" ("incident_year", "occurred_on" DESC);



CREATE INDEX "platform_permit_trigger_rules_lookup_idx" ON "public"."platform_permit_trigger_rules" USING "btree" ("permit_code", "trade_code", "task_template_code");



CREATE UNIQUE INDEX "platform_permit_trigger_rules_uidx" ON "public"."platform_permit_trigger_rules" USING "btree" ("permit_code", COALESCE("trade_code", ''::"text"), COALESCE("task_template_code", ''::"text"), COALESCE("hazard_family", ''::"text"), COALESCE("work_condition", ''::"text"), COALESCE("weather_condition", ''::"text"));



CREATE INDEX "platform_predictability_aggregates_dimensions_idx" ON "public"."platform_predictability_aggregates" USING "btree" ("industry", "company_size_bucket", "region", "incident_type", "job_type", "time_period");



CREATE INDEX "platform_predictability_aggregates_privacy_idx" ON "public"."platform_predictability_aggregates" USING "btree" ("company_count", "record_count", "observation_days");



CREATE INDEX "pmcfi_focus_four_idx" ON "public"."platform_major_construction_fatality_incidents" USING "gin" ("osha_focus_four_exposures");



CREATE INDEX "pshsep_attachments_draft_idx" ON "public"."pshsep_attachments" USING "btree" ("draft_id");



CREATE INDEX "pshsep_drafts_status_idx" ON "public"."pshsep_drafts" USING "btree" ("status");



CREATE INDEX "pshsep_drafts_user_id_idx" ON "public"."pshsep_drafts" USING "btree" ("user_id");



CREATE INDEX "pshsep_submissions_status_idx" ON "public"."pshsep_submissions" USING "btree" ("status");



CREATE INDEX "pshsep_submissions_user_id_idx" ON "public"."pshsep_submissions" USING "btree" ("user_id");



CREATE INDEX "report_snapshots_company_date_idx" ON "public"."report_snapshots" USING "btree" ("company_id", "snapshot_date" DESC);



CREATE UNIQUE INDEX "risk_baseline_profiles_scope_hazard_trade_uidx" ON "public"."risk_baseline_profiles" USING "btree" ("scope_code", "hazard_code", "trade_code");



CREATE INDEX "safety_data_bucket_ai_ready_idx" ON "public"."safety_data_bucket" USING "btree" ("company_id", "ai_ready", "source_created_at" DESC);



CREATE INDEX "safety_data_bucket_company_created_idx" ON "public"."safety_data_bucket" USING "btree" ("company_id", "jobsite_id", "source_type", "created_at" DESC);



CREATE INDEX "safety_data_bucket_normalized_payload_gin" ON "public"."safety_data_bucket" USING "gin" ("normalized_payload");



CREATE INDEX "safety_data_bucket_sanitized_payload_gin" ON "public"."safety_data_bucket" USING "gin" ("sanitized_payload");



CREATE UNIQUE INDEX "safety_data_bucket_source_uidx" ON "public"."safety_data_bucket" USING "btree" ("company_id", "source_type", COALESCE("source_record_id", ''::"text"), "raw_payload_hash");



CREATE INDEX "safety_data_bucket_trade_category_idx" ON "public"."safety_data_bucket" USING "btree" ("company_id", "trade_code", "category_code", "severity", "source_created_at" DESC);



CREATE INDEX "sor_audit_log_company_timestamp_idx" ON "public"."sor_audit_log" USING "btree" ("company_id", "timestamp" DESC);



CREATE INDEX "sor_audit_log_sor_timestamp_idx" ON "public"."sor_audit_log" USING "btree" ("sor_id", "timestamp" DESC);



CREATE INDEX "time_card_tasks_category_id_idx" ON "public"."time_card_tasks" USING "btree" ("category_id");



CREATE INDEX "training_expiration_deliveries_company_idx" ON "public"."training_expiration_notification_deliveries" USING "btree" ("company_id", "reminder_stage", "status", "created_at" DESC);



CREATE INDEX "training_expiration_deliveries_recipient_idx" ON "public"."training_expiration_notification_deliveries" USING "btree" ("recipient_user_id", "company_id", "created_at" DESC) WHERE ("recipient_user_id" IS NOT NULL);



CREATE INDEX "training_expiration_deliveries_subject_idx" ON "public"."training_expiration_notification_deliveries" USING "btree" ("company_id", "subject_type", "subject_id", "expires_on" DESC);



CREATE INDEX "user_roles_role_idx" ON "public"."user_roles" USING "btree" ("role");



CREATE INDEX "weather_alert_events_company_jobsite_idx" ON "public"."weather_alert_events" USING "btree" ("company_id", "jobsite_id", "last_seen_at" DESC);



CREATE INDEX "weather_alert_events_expires_idx" ON "public"."weather_alert_events" USING "btree" ("company_id", "jobsite_id", "expires_at" DESC);



CREATE INDEX "weather_notification_deliveries_employee_idx" ON "public"."weather_notification_deliveries" USING "btree" ("recipient_employee_id", "status", "created_at" DESC) WHERE ("recipient_employee_id" IS NOT NULL);



CREATE INDEX "weather_notification_deliveries_jobsite_idx" ON "public"."weather_notification_deliveries" USING "btree" ("company_id", "jobsite_id", "created_at" DESC);



CREATE INDEX "weather_notification_deliveries_user_idx" ON "public"."weather_notification_deliveries" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE OR REPLACE TRIGGER "bump_company_generated_document_version" BEFORE INSERT OR UPDATE ON "public"."company_generated_documents" FOR EACH ROW EXECUTE FUNCTION "public"."si_bump_generated_document_version"();



CREATE OR REPLACE TRIGGER "log_company_ai_reviews_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_ai_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "log_company_bucket_runs_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_bucket_runs" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "log_company_conflict_pairs_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_conflict_pairs" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "log_company_conflict_rules_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_conflict_rules" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "log_company_generated_documents_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_generated_documents" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "log_company_permit_trigger_rules_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_permit_trigger_rules" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "log_company_risk_scores_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_risk_scores" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "log_company_training_matrix_requirements_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."company_training_matrix_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."si_log_history"();



CREATE OR REPLACE TRIGGER "prevent_non_owner_compensation_changes" BEFORE INSERT OR UPDATE ON "public"."company_positions" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_non_owner_compensation_changes"();



CREATE OR REPLACE TRIGGER "protect_employee_profile_time_card_role_fields" BEFORE INSERT OR UPDATE ON "public"."employee_profiles" FOR EACH ROW EXECUTE FUNCTION "private"."protect_employee_profile_time_card_role"();



CREATE OR REPLACE TRIGGER "refresh_employee_time_card_payroll_on_card" AFTER INSERT OR UPDATE OF "employee_user_id" ON "public"."employee_time_cards" FOR EACH ROW EXECUTE FUNCTION "private"."refresh_time_card_payroll_from_card"();



CREATE OR REPLACE TRIGGER "refresh_employee_time_card_payroll_on_entry" AFTER INSERT OR DELETE OR UPDATE ON "public"."employee_time_entries" FOR EACH ROW EXECUTE FUNCTION "private"."refresh_time_card_payroll_from_entry"();



CREATE OR REPLACE TRIGGER "set_billing_customers_updated_at" BEFORE UPDATE ON "public"."billing_customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_billing_invoice_line_items_updated_at" BEFORE UPDATE ON "public"."billing_invoice_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_billing_invoices_updated_at" BEFORE UPDATE ON "public"."billing_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_client_onboarding_items_updated_at" BEFORE UPDATE ON "public"."client_onboarding_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_ai_reviews_updated_at" BEFORE UPDATE ON "public"."company_ai_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_audit_customer_locations_updated_at" BEFORE UPDATE ON "public"."company_audit_customer_locations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_audit_customers_updated_at" BEFORE UPDATE ON "public"."company_audit_customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_auditflow_assignments_updated_at" BEFORE UPDATE ON "public"."company_auditflow_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_auditflow_submissions_updated_at" BEFORE UPDATE ON "public"."company_auditflow_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_auditflow_templates_updated_at" BEFORE UPDATE ON "public"."company_auditflow_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_bucket_items_updated_at" BEFORE UPDATE ON "public"."company_bucket_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_bucket_runs_updated_at" BEFORE UPDATE ON "public"."company_bucket_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_checklist_items_updated_at" BEFORE UPDATE ON "public"."company_checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_clients_updated_at" BEFORE UPDATE ON "public"."company_clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_conflict_pairs_updated_at" BEFORE UPDATE ON "public"."company_conflict_pairs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_conflict_rules_updated_at" BEFORE UPDATE ON "public"."company_conflict_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_contractor_documents_updated_at" BEFORE UPDATE ON "public"."company_contractor_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_contractors_updated_at" BEFORE UPDATE ON "public"."company_contractors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_controls_updated_at" BEFORE UPDATE ON "public"."company_controls" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_corrective_actions_updated_at" BEFORE UPDATE ON "public"."company_corrective_actions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_crews_updated_at" BEFORE UPDATE ON "public"."company_crews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_data_requests_updated_at" BEFORE UPDATE ON "public"."company_data_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_document_templates_updated_at" BEFORE UPDATE ON "public"."company_document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_documents_updated_at" BEFORE UPDATE ON "public"."company_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_employee_jobsite_assignments_updated_at" BEFORE UPDATE ON "public"."company_employee_jobsite_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_employee_profiles_updated_at" BEFORE UPDATE ON "public"."company_employee_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_employee_training_records_updated_at" BEFORE UPDATE ON "public"."company_employee_training_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_finance_authorized_users_updated_at" BEFORE UPDATE ON "public"."company_finance_authorized_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_finance_budgets_updated_at" BEFORE UPDATE ON "public"."company_finance_budgets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_finance_recurring_items_updated_at" BEFORE UPDATE ON "public"."company_finance_recurring_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_finance_transactions_updated_at" BEFORE UPDATE ON "public"."company_finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_generated_documents_updated_at" BEFORE UPDATE ON "public"."company_generated_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_hazards_updated_at" BEFORE UPDATE ON "public"."company_hazards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_incidents_updated_at" BEFORE UPDATE ON "public"."company_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_induction_completions_updated_at" BEFORE UPDATE ON "public"."company_induction_completions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_induction_programs_updated_at" BEFORE UPDATE ON "public"."company_induction_programs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_induction_requirements_updated_at" BEFORE UPDATE ON "public"."company_induction_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_inspection_calendar_signoffs_updated_at" BEFORE UPDATE ON "public"."company_inspection_calendar_signoffs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_integration_webhooks_updated_at" BEFORE UPDATE ON "public"."company_integration_webhooks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_invites_updated_at" BEFORE UPDATE ON "public"."company_invites" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_assignments_updated_at" BEFORE UPDATE ON "public"."company_jobsite_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_audit_observations_updated_at" BEFORE UPDATE ON "public"."company_jobsite_audit_observations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_audits_updated_at" BEFORE UPDATE ON "public"."company_jobsite_audits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_chemicals_updated_at" BEFORE UPDATE ON "public"."company_jobsite_chemicals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_daily_todos_updated_at" BEFORE UPDATE ON "public"."company_jobsite_daily_todos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_schedule_items_updated_at" BEFORE UPDATE ON "public"."company_jobsite_schedule_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_site_blueprints_updated_at" BEFORE UPDATE ON "public"."company_jobsite_site_blueprints" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_site_maps_updated_at" BEFORE UPDATE ON "public"."company_jobsite_site_maps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_site_renders_updated_at" BEFORE UPDATE ON "public"."company_jobsite_site_renders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsite_visual_zones_updated_at" BEFORE UPDATE ON "public"."company_jobsite_visual_zones" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jobsites_updated_at" BEFORE UPDATE ON "public"."company_jobsites" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jsa_activities_updated_at" BEFORE UPDATE ON "public"."company_jsa_activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jsa_signoffs_updated_at" BEFORE UPDATE ON "public"."company_jsa_signoffs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_jsas_updated_at" BEFORE UPDATE ON "public"."company_jsas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_leadership_safety_scores_updated_at" BEFORE UPDATE ON "public"."company_leadership_safety_scores" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_legal_issues_updated_at" BEFORE UPDATE ON "public"."company_legal_issues" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_mobile_feature_entitlements_updated_at" BEFORE UPDATE ON "public"."company_mobile_feature_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_notification_preferences_updated_at" BEFORE UPDATE ON "public"."company_notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_operations_records_updated_at" BEFORE UPDATE ON "public"."company_operations_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_permit_trigger_rules_updated_at" BEFORE UPDATE ON "public"."company_permit_trigger_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_permits_catalog_updated_at" BEFORE UPDATE ON "public"."company_permits_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_permits_updated_at" BEFORE UPDATE ON "public"."company_permits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_positions_updated_at" BEFORE UPDATE ON "public"."company_positions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_reports_updated_at" BEFORE UPDATE ON "public"."company_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_risk_memory_facets_updated_at" BEFORE UPDATE ON "public"."company_risk_memory_facets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_rule_overrides_updated_at" BEFORE UPDATE ON "public"."company_rule_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_safety_form_definitions_updated_at" BEFORE UPDATE ON "public"."company_safety_form_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_safety_form_submissions_updated_at" BEFORE UPDATE ON "public"."company_safety_form_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_safety_submissions_updated_at" BEFORE UPDATE ON "public"."company_safety_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_sales_activities_updated_at" BEFORE UPDATE ON "public"."company_sales_activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_schedule_prediction_cache_updated_at" BEFORE UPDATE ON "public"."company_schedule_prediction_cache" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_signup_requests_updated_at" BEFORE UPDATE ON "public"."company_signup_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_simultaneous_operations_updated_at" BEFORE UPDATE ON "public"."company_simultaneous_operations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_sub_trades_updated_at" BEFORE UPDATE ON "public"."company_sub_trades" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_tasks_updated_at" BEFORE UPDATE ON "public"."company_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_toolbox_sessions_updated_at" BEFORE UPDATE ON "public"."company_toolbox_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_toolbox_templates_updated_at" BEFORE UPDATE ON "public"."company_toolbox_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_trades_updated_at" BEFORE UPDATE ON "public"."company_trades" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_training_matrix_requirements_updated_at" BEFORE UPDATE ON "public"."company_training_matrix_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_users_updated_at" BEFORE UPDATE ON "public"."company_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_work_areas_updated_at" BEFORE UPDATE ON "public"."company_work_areas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_contractor_employee_jobsite_assignments_updated_at" BEFORE UPDATE ON "public"."contractor_employee_jobsite_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_contractor_employee_profiles_updated_at" BEFORE UPDATE ON "public"."contractor_employee_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_contractor_employee_training_records_updated_at" BEFORE UPDATE ON "public"."contractor_employee_training_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_corrective_actions_updated_at" BEFORE UPDATE ON "public"."corrective_actions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_daily_reports_updated_at" BEFORE UPDATE ON "public"."daily_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_daps_updated_at" BEFORE UPDATE ON "public"."daps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_employee_document_assignments_updated_at" BEFORE UPDATE ON "public"."employee_document_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_employee_pay_rates_updated_at" BEFORE UPDATE ON "public"."employee_pay_rates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_employee_profiles_updated_at" BEFORE UPDATE ON "public"."employee_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_employee_time_card_payroll_updated_at" BEFORE UPDATE ON "public"."employee_time_card_payroll" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_employee_time_cards_updated_at" BEFORE UPDATE ON "public"."employee_time_cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_employee_time_entries_updated_at" BEFORE UPDATE ON "public"."employee_time_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_gus_planning_sessions_updated_at" BEFORE UPDATE ON "public"."gus_planning_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_hazard_categories_updated_at" BEFORE UPDATE ON "public"."hazard_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_hr_document_templates_updated_at" BEFORE UPDATE ON "public"."hr_document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_incident_notification_deliveries_updated_at" BEFORE UPDATE ON "public"."incident_notification_deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_incidents_updated_at" BEFORE UPDATE ON "public"."incidents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_ingestion_audit_log_updated_at" BEFORE UPDATE ON "public"."ingestion_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_jobsite_contractor_training_requirements_updated_at" BEFORE UPDATE ON "public"."jobsite_contractor_training_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_jobsite_rule_overrides_updated_at" BEFORE UPDATE ON "public"."jobsite_rule_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_jobsite_users_updated_at" BEFORE UPDATE ON "public"."jobsite_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_jobsite_weather_subscriptions_updated_at" BEFORE UPDATE ON "public"."jobsite_weather_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_jobsites_updated_at" BEFORE UPDATE ON "public"."jobsites" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_marketplace_document_purchases_updated_at" BEFORE UPDATE ON "public"."marketplace_document_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_observations_updated_at" BEFORE UPDATE ON "public"."observations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_permit_types_updated_at" BEFORE UPDATE ON "public"."permit_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_permits_updated_at" BEFORE UPDATE ON "public"."permits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_conflict_rules_updated_at" BEFORE UPDATE ON "public"."platform_conflict_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_jurisdiction_standard_mappings_updated_at" BEFORE UPDATE ON "public"."platform_jurisdiction_standard_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_jurisdiction_standard_overrides_updated_at" BEFORE UPDATE ON "public"."platform_jurisdiction_standard_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_jurisdiction_standards_updated_at" BEFORE UPDATE ON "public"."platform_jurisdiction_standards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_jurisdictions_updated_at" BEFORE UPDATE ON "public"."platform_jurisdictions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_permit_trigger_rules_updated_at" BEFORE UPDATE ON "public"."platform_permit_trigger_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_rule_templates_updated_at" BEFORE UPDATE ON "public"."platform_rule_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_sub_trades_updated_at" BEFORE UPDATE ON "public"."platform_sub_trades" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_task_templates_updated_at" BEFORE UPDATE ON "public"."platform_task_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_trades_updated_at" BEFORE UPDATE ON "public"."platform_trades" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_pmcfi_updated_at" BEFORE UPDATE ON "public"."platform_major_construction_fatality_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_pmcfic_updated_at" BEFORE UPDATE ON "public"."platform_major_construction_fatality_incident_controls" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_safety_data_bucket_updated_at" BEFORE UPDATE ON "public"."safety_data_bucket" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_sif_reviews_updated_at" BEFORE UPDATE ON "public"."sif_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_training_expiration_notification_deliveries_updated_at" BEFORE UPDATE ON "public"."training_expiration_notification_deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_dashboard_layouts_updated_at" BEFORE UPDATE ON "public"."user_dashboard_layouts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_onboarding_state_updated_at" BEFORE UPDATE ON "public"."user_onboarding_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_roles_updated_at" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "store_company_generated_document_version" AFTER INSERT OR UPDATE ON "public"."company_generated_documents" FOR EACH ROW EXECUTE FUNCTION "public"."si_store_generated_document_version"();



CREATE OR REPLACE TRIGGER "sync_employee_time_card_review_fields" BEFORE INSERT OR UPDATE ON "public"."employee_time_cards" FOR EACH ROW EXECUTE FUNCTION "private"."sync_time_card_review_fields"();



CREATE OR REPLACE TRIGGER "trg_company_memory_items_updated_at" BEFORE UPDATE ON "public"."company_memory_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pshsep_drafts_updated_at" BEFORE UPDATE ON "public"."pshsep_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sor_audit_log_write_insert" AFTER INSERT ON "public"."company_sor_records" FOR EACH ROW EXECUTE FUNCTION "public"."sor_audit_log_write"();



CREATE OR REPLACE TRIGGER "trg_sor_audit_log_write_update" AFTER UPDATE ON "public"."company_sor_records" FOR EACH ROW EXECUTE FUNCTION "public"."sor_audit_log_write"();



CREATE OR REPLACE TRIGGER "trg_sor_guard_locked_rows" BEFORE UPDATE ON "public"."company_sor_records" FOR EACH ROW EXECUTE FUNCTION "public"."sor_guard_locked_rows"();



CREATE OR REPLACE TRIGGER "trg_sor_prevent_hard_delete" BEFORE DELETE ON "public"."company_sor_records" FOR EACH ROW EXECUTE FUNCTION "public"."sor_prevent_hard_delete"();



CREATE OR REPLACE TRIGGER "trg_sor_set_updated_at" BEFORE UPDATE ON "public"."company_sor_records" FOR EACH ROW EXECUTE FUNCTION "public"."sor_set_updated_at"();



CREATE OR REPLACE TRIGGER "validate_employee_time_card_entry" BEFORE INSERT OR UPDATE ON "public"."employee_time_entries" FOR EACH ROW EXECUTE FUNCTION "private"."validate_time_card_entry"();



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "public"."company_jobsite_site_blueprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_render_id_fkey" FOREIGN KEY ("render_id") REFERENCES "public"."company_jobsite_site_renders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_site_map_id_fkey" FOREIGN KEY ("site_map_id") REFERENCES "public"."company_jobsite_site_maps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_visual_generation_jobs"
    ADD CONSTRAINT "ai_visual_generation_jobs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."behavior_risk_events"
    ADD CONSTRAINT "behavior_risk_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."behavior_risk_events"
    ADD CONSTRAINT "behavior_risk_events_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "public"."company_crews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."behavior_risk_events"
    ADD CONSTRAINT "behavior_risk_events_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."behavior_risk_events"
    ADD CONSTRAINT "behavior_risk_events_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_events"
    ADD CONSTRAINT "billing_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_events"
    ADD CONSTRAINT "billing_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_invoice_line_items"
    ADD CONSTRAINT "billing_invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_invoice_payments"
    ADD CONSTRAINT "billing_invoice_payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_invoice_payments"
    ADD CONSTRAINT "billing_invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."billing_staff_company_assignments"
    ADD CONSTRAINT "billing_staff_company_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_staff_company_assignments"
    ADD CONSTRAINT "billing_staff_company_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_staff_company_assignments"
    ADD CONSTRAINT "billing_staff_company_assignments_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_onboarding_items"
    ADD CONSTRAINT "client_onboarding_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."company_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_onboarding_items"
    ADD CONSTRAINT "client_onboarding_items_linked_document_id_fkey" FOREIGN KEY ("linked_document_id") REFERENCES "public"."company_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_demo_previous_company_id_fkey" FOREIGN KEY ("demo_previous_company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_restored_by_fkey" FOREIGN KEY ("restored_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_ai_reviews"
    ADD CONSTRAINT "company_ai_reviews_bucket_run_id_fkey" FOREIGN KEY ("bucket_run_id") REFERENCES "public"."company_bucket_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_ai_reviews"
    ADD CONSTRAINT "company_ai_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_ai_reviews"
    ADD CONSTRAINT "company_ai_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_ai_reviews"
    ADD CONSTRAINT "company_ai_reviews_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_ai_reviews"
    ADD CONSTRAINT "company_ai_reviews_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_analytics_snapshots"
    ADD CONSTRAINT "company_analytics_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_analytics_snapshots"
    ADD CONSTRAINT "company_analytics_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_analytics_snapshots"
    ADD CONSTRAINT "company_analytics_snapshots_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_audit_customer_locations"
    ADD CONSTRAINT "company_audit_customer_locations_audit_customer_id_fkey" FOREIGN KEY ("audit_customer_id") REFERENCES "public"."company_audit_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_audit_customer_locations"
    ADD CONSTRAINT "company_audit_customer_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_audit_customer_locations"
    ADD CONSTRAINT "company_audit_customer_locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_audit_customer_locations"
    ADD CONSTRAINT "company_audit_customer_locations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_audit_customers"
    ADD CONSTRAINT "company_audit_customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_audit_customers"
    ADD CONSTRAINT "company_audit_customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_audit_customers"
    ADD CONSTRAINT "company_audit_customers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."company_auditflow_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "public"."company_auditflow_template_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."company_auditflow_assignments"
    ADD CONSTRAINT "company_auditflow_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_corrective_action_links"
    ADD CONSTRAINT "company_auditflow_corrective_action_links_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_corrective_action_links"
    ADD CONSTRAINT "company_auditflow_corrective_action_links_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."company_auditflow_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_corrective_action_links"
    ADD CONSTRAINT "company_auditflow_corrective_action_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_corrective_action_links"
    ADD CONSTRAINT "company_auditflow_corrective_action_links_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."company_auditflow_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."company_auditflow_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."company_auditflow_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."company_auditflow_submissions"
    ADD CONSTRAINT "company_auditflow_submissions_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "public"."company_auditflow_template_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."company_auditflow_template_versions"
    ADD CONSTRAINT "company_auditflow_template_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_template_versions"
    ADD CONSTRAINT "company_auditflow_template_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_template_versions"
    ADD CONSTRAINT "company_auditflow_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."company_auditflow_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_templates"
    ADD CONSTRAINT "company_auditflow_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_auditflow_templates"
    ADD CONSTRAINT "company_auditflow_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_templates"
    ADD CONSTRAINT "company_auditflow_templates_current_version_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."company_auditflow_template_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_auditflow_templates"
    ADD CONSTRAINT "company_auditflow_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_bucket_run_id_fkey" FOREIGN KEY ("bucket_run_id") REFERENCES "public"."company_bucket_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_company_task_id_fkey" FOREIGN KEY ("company_task_id") REFERENCES "public"."company_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_weather_condition_id_fkey" FOREIGN KEY ("weather_condition_id") REFERENCES "public"."company_weather_conditions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_items"
    ADD CONSTRAINT "company_bucket_items_work_area_id_fkey" FOREIGN KEY ("work_area_id") REFERENCES "public"."company_work_areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_runs"
    ADD CONSTRAINT "company_bucket_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_bucket_runs"
    ADD CONSTRAINT "company_bucket_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_runs"
    ADD CONSTRAINT "company_bucket_runs_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_bucket_runs"
    ADD CONSTRAINT "company_bucket_runs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_checklist_items"
    ADD CONSTRAINT "company_checklist_items_linked_document_id_fkey" FOREIGN KEY ("linked_document_id") REFERENCES "public"."company_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_bucket_run_id_fkey" FOREIGN KEY ("bucket_run_id") REFERENCES "public"."company_bucket_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_left_operation_id_fkey" FOREIGN KEY ("left_operation_id") REFERENCES "public"."company_simultaneous_operations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_right_operation_id_fkey" FOREIGN KEY ("right_operation_id") REFERENCES "public"."company_simultaneous_operations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_conflict_pairs"
    ADD CONSTRAINT "company_conflict_pairs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_conflict_rules"
    ADD CONSTRAINT "company_conflict_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_conflict_rules"
    ADD CONSTRAINT "company_conflict_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_conflict_rules"
    ADD CONSTRAINT "company_conflict_rules_platform_rule_id_fkey" FOREIGN KEY ("platform_rule_id") REFERENCES "public"."platform_conflict_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_conflict_rules"
    ADD CONSTRAINT "company_conflict_rules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_contractor_documents"
    ADD CONSTRAINT "company_contractor_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_contractor_documents"
    ADD CONSTRAINT "company_contractor_documents_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."company_contractors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_contractor_documents"
    ADD CONSTRAINT "company_contractor_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_contractor_evaluations"
    ADD CONSTRAINT "company_contractor_evaluations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_contractor_evaluations"
    ADD CONSTRAINT "company_contractor_evaluations_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."company_contractors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_contractor_evaluations"
    ADD CONSTRAINT "company_contractor_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_contractors"
    ADD CONSTRAINT "company_contractors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_contractors"
    ADD CONSTRAINT "company_contractors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_controls"
    ADD CONSTRAINT "company_controls_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_controls"
    ADD CONSTRAINT "company_controls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_controls"
    ADD CONSTRAINT "company_controls_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_action_events"
    ADD CONSTRAINT "company_corrective_action_events_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_corrective_action_events"
    ADD CONSTRAINT "company_corrective_action_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_corrective_action_events"
    ADD CONSTRAINT "company_corrective_action_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_action_evidence"
    ADD CONSTRAINT "company_corrective_action_evidence_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_corrective_action_evidence"
    ADD CONSTRAINT "company_corrective_action_evidence_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_corrective_action_evidence"
    ADD CONSTRAINT "company_corrective_action_evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_dap_activity_id_fkey" FOREIGN KEY ("dap_activity_id") REFERENCES "public"."company_jsa_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_dap_id_fkey" FOREIGN KEY ("dap_id") REFERENCES "public"."company_jsas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_prediction_reviewed_by_fkey" FOREIGN KEY ("prediction_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_proof_previous_version_id_fkey" FOREIGN KEY ("proof_previous_version_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_source_sor_id_fkey" FOREIGN KEY ("source_sor_id") REFERENCES "public"."company_sor_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_source_submission_id_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."company_safety_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_corrective_actions"
    ADD CONSTRAINT "company_corrective_actions_validation_reviewed_by_fkey" FOREIGN KEY ("validation_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_credit_transactions"
    ADD CONSTRAINT "company_credit_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_credit_transactions"
    ADD CONSTRAINT "company_credit_transactions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_crews"
    ADD CONSTRAINT "company_crews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_crews"
    ADD CONSTRAINT "company_crews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_crews"
    ADD CONSTRAINT "company_crews_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsa_activities"
    ADD CONSTRAINT "company_dap_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jsa_activities"
    ADD CONSTRAINT "company_dap_activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsa_activities"
    ADD CONSTRAINT "company_dap_activities_dap_id_fkey" FOREIGN KEY ("jsa_id") REFERENCES "public"."company_jsas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jsa_activities"
    ADD CONSTRAINT "company_dap_activities_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsa_activities"
    ADD CONSTRAINT "company_dap_activities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsas"
    ADD CONSTRAINT "company_daps_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jsas"
    ADD CONSTRAINT "company_daps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsas"
    ADD CONSTRAINT "company_daps_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsas"
    ADD CONSTRAINT "company_daps_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsas"
    ADD CONSTRAINT "company_daps_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_data_requests"
    ADD CONSTRAINT "company_data_requests_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_document_templates"
    ADD CONSTRAINT "company_document_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_document_templates"
    ADD CONSTRAINT "company_document_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_document_templates"
    ADD CONSTRAINT "company_document_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_documents"
    ADD CONSTRAINT "company_documents_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."company_checklist_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_documents"
    ADD CONSTRAINT "company_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."company_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_documents"
    ADD CONSTRAINT "company_documents_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."company_document_requirements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_documents"
    ADD CONSTRAINT "company_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_jobsite_assignments"
    ADD CONSTRAINT "company_employee_jobsite_assignments_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_jobsite_assignments"
    ADD CONSTRAINT "company_employee_jobsite_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employee_jobsite_assignments"
    ADD CONSTRAINT "company_employee_jobsite_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_jobsite_assignments"
    ADD CONSTRAINT "company_employee_jobsite_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employee_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employee_jobsite_assignments"
    ADD CONSTRAINT "company_employee_jobsite_assignments_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employee_jobsite_assignments"
    ADD CONSTRAINT "company_employee_jobsite_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_responsible_sponsor_id_fkey" FOREIGN KEY ("responsible_sponsor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_profiles"
    ADD CONSTRAINT "company_employee_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_training_records"
    ADD CONSTRAINT "company_employee_training_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employee_training_records"
    ADD CONSTRAINT "company_employee_training_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_training_records"
    ADD CONSTRAINT "company_employee_training_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employee_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_employee_training_records"
    ADD CONSTRAINT "company_employee_training_records_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."company_training_requirements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_employee_training_records"
    ADD CONSTRAINT "company_employee_training_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_authorized_users"
    ADD CONSTRAINT "company_finance_authorized_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_authorized_users"
    ADD CONSTRAINT "company_finance_authorized_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_finance_budgets"
    ADD CONSTRAINT "company_finance_budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_receipts"
    ADD CONSTRAINT "company_finance_receipts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."company_finance_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_finance_receipts"
    ADD CONSTRAINT "company_finance_receipts_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_recurring_items"
    ADD CONSTRAINT "company_finance_recurring_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_transactions"
    ADD CONSTRAINT "company_finance_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_transactions"
    ADD CONSTRAINT "company_finance_transactions_related_client_id_fkey" FOREIGN KEY ("related_client_id") REFERENCES "public"."company_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_transactions"
    ADD CONSTRAINT "company_finance_transactions_related_document_id_fkey" FOREIGN KEY ("related_document_id") REFERENCES "public"."company_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_finance_transactions"
    ADD CONSTRAINT "company_finance_transactions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_ai_review_id_fkey" FOREIGN KEY ("ai_review_id") REFERENCES "public"."company_ai_reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "public"."company_generated_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_document_versions"
    ADD CONSTRAINT "company_generated_document_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."company_document_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_ai_review_id_fkey" FOREIGN KEY ("ai_review_id") REFERENCES "public"."company_ai_reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_bucket_run_id_fkey" FOREIGN KEY ("bucket_run_id") REFERENCES "public"."company_bucket_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."company_document_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_generated_documents"
    ADD CONSTRAINT "company_generated_documents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_hazards"
    ADD CONSTRAINT "company_hazards_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_hazards"
    ADD CONSTRAINT "company_hazards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_hazards"
    ADD CONSTRAINT "company_hazards_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_hris_roster_imports"
    ADD CONSTRAINT "company_hris_roster_imports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_hris_roster_imports"
    ADD CONSTRAINT "company_hris_roster_imports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_converted_from_submission_id_fkey" FOREIGN KEY ("converted_from_submission_id") REFERENCES "public"."company_safety_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_dap_activity_id_fkey" FOREIGN KEY ("dap_activity_id") REFERENCES "public"."company_jsa_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_prediction_reviewed_by_fkey" FOREIGN KEY ("prediction_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_incidents"
    ADD CONSTRAINT "company_incidents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_induction_completions"
    ADD CONSTRAINT "company_induction_completions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_induction_completions"
    ADD CONSTRAINT "company_induction_completions_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_induction_completions"
    ADD CONSTRAINT "company_induction_completions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_induction_completions"
    ADD CONSTRAINT "company_induction_completions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."company_induction_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_induction_completions"
    ADD CONSTRAINT "company_induction_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_induction_programs"
    ADD CONSTRAINT "company_induction_programs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_induction_programs"
    ADD CONSTRAINT "company_induction_programs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_induction_programs"
    ADD CONSTRAINT "company_induction_programs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_induction_requirements"
    ADD CONSTRAINT "company_induction_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_induction_requirements"
    ADD CONSTRAINT "company_induction_requirements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_induction_requirements"
    ADD CONSTRAINT "company_induction_requirements_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_induction_requirements"
    ADD CONSTRAINT "company_induction_requirements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."company_induction_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_sig_audit_customer_location_id_fkey" FOREIGN KEY ("audit_customer_location_id") REFERENCES "public"."company_audit_customer_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_signoffs_audit_customer_id_fkey" FOREIGN KEY ("audit_customer_id") REFERENCES "public"."company_audit_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_signoffs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_signoffs_corrective_action_id_fkey" FOREIGN KEY ("corrective_action_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_signoffs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_signoffs_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_inspection_calendar_signoffs"
    ADD CONSTRAINT "company_inspection_calendar_signoffs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_integration_webhook_deliveries"
    ADD CONSTRAINT "company_integration_webhook_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_integration_webhook_deliveries"
    ADD CONSTRAINT "company_integration_webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "public"."company_integration_webhooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_integration_webhooks"
    ADD CONSTRAINT "company_integration_webhooks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_integration_webhooks"
    ADD CONSTRAINT "company_integration_webhooks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_invites"
    ADD CONSTRAINT "company_invites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_invites"
    ADD CONSTRAINT "company_invites_consumed_by_fkey" FOREIGN KEY ("consumed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_invites"
    ADD CONSTRAINT "company_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_invites"
    ADD CONSTRAINT "company_invites_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_assignments"
    ADD CONSTRAINT "company_jobsite_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_assignments"
    ADD CONSTRAINT "company_jobsite_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_assignments"
    ADD CONSTRAINT "company_jobsite_assignments_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_assignments"
    ADD CONSTRAINT "company_jobsite_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_assignments"
    ADD CONSTRAINT "company_jobsite_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_observation_evidence"
    ADD CONSTRAINT "company_jobsite_audit_observation_evidence_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "public"."company_jobsite_audits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_observation_evidence"
    ADD CONSTRAINT "company_jobsite_audit_observation_evidence_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_observation_evidence"
    ADD CONSTRAINT "company_jobsite_audit_observation_evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_observation_evidence"
    ADD CONSTRAINT "company_jobsite_audit_observation_evidence_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_observation_evidence"
    ADD CONSTRAINT "company_jobsite_audit_observation_evidence_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."company_jobsite_audit_observations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_ai_bucket_id_fkey" FOREIGN KEY ("ai_bucket_id") REFERENCES "public"."safety_data_bucket"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "public"."company_jobsite_audits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_corrective_action_id_fkey" FOREIGN KEY ("corrective_action_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_observations"
    ADD CONSTRAINT "company_jobsite_audit_observations_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_report_deliveries"
    ADD CONSTRAINT "company_jobsite_audit_report_deliveries_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "public"."company_jobsite_audits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_report_deliveries"
    ADD CONSTRAINT "company_jobsite_audit_report_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_report_deliveries"
    ADD CONSTRAINT "company_jobsite_audit_report_deliveries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_report_deliveries"
    ADD CONSTRAINT "company_jobsite_audit_report_deliveries_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_signoffs"
    ADD CONSTRAINT "company_jobsite_audit_signoffs_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "public"."company_jobsite_audits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_signoffs"
    ADD CONSTRAINT "company_jobsite_audit_signoffs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audit_signoffs"
    ADD CONSTRAINT "company_jobsite_audit_signoffs_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audit_signoffs"
    ADD CONSTRAINT "company_jobsite_audit_signoffs_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audits"
    ADD CONSTRAINT "company_jobsite_audits_ai_review_id_fkey" FOREIGN KEY ("ai_review_id") REFERENCES "public"."company_ai_reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audits"
    ADD CONSTRAINT "company_jobsite_audits_audit_customer_id_fkey" FOREIGN KEY ("audit_customer_id") REFERENCES "public"."company_audit_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audits"
    ADD CONSTRAINT "company_jobsite_audits_audit_customer_location_id_fkey" FOREIGN KEY ("audit_customer_location_id") REFERENCES "public"."company_audit_customer_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audits"
    ADD CONSTRAINT "company_jobsite_audits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_audits"
    ADD CONSTRAINT "company_jobsite_audits_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_audits"
    ADD CONSTRAINT "company_jobsite_audits_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_chemicals"
    ADD CONSTRAINT "company_jobsite_chemicals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_chemicals"
    ADD CONSTRAINT "company_jobsite_chemicals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_chemicals"
    ADD CONSTRAINT "company_jobsite_chemicals_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_daily_todos"
    ADD CONSTRAINT "company_jobsite_daily_todos_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_daily_todos"
    ADD CONSTRAINT "company_jobsite_daily_todos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_daily_todos"
    ADD CONSTRAINT "company_jobsite_daily_todos_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_daily_todos"
    ADD CONSTRAINT "company_jobsite_daily_todos_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_daily_todos"
    ADD CONSTRAINT "company_jobsite_daily_todos_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_schedule_items"
    ADD CONSTRAINT "company_jobsite_schedule_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_schedule_items"
    ADD CONSTRAINT "company_jobsite_schedule_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_schedule_items"
    ADD CONSTRAINT "company_jobsite_schedule_items_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_schedule_items"
    ADD CONSTRAINT "company_jobsite_schedule_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_blueprints"
    ADD CONSTRAINT "company_jobsite_site_blueprints_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_site_blueprints"
    ADD CONSTRAINT "company_jobsite_site_blueprints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_blueprints"
    ADD CONSTRAINT "company_jobsite_site_blueprints_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_site_blueprints"
    ADD CONSTRAINT "company_jobsite_site_blueprints_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_maps"
    ADD CONSTRAINT "company_jobsite_site_maps_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "public"."company_jobsite_site_blueprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_maps"
    ADD CONSTRAINT "company_jobsite_site_maps_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_site_maps"
    ADD CONSTRAINT "company_jobsite_site_maps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_maps"
    ADD CONSTRAINT "company_jobsite_site_maps_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_site_maps"
    ADD CONSTRAINT "company_jobsite_site_maps_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_renders"
    ADD CONSTRAINT "company_jobsite_site_renders_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "public"."company_jobsite_site_blueprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_renders"
    ADD CONSTRAINT "company_jobsite_site_renders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_site_renders"
    ADD CONSTRAINT "company_jobsite_site_renders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_site_renders"
    ADD CONSTRAINT "company_jobsite_site_renders_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_site_renders"
    ADD CONSTRAINT "company_jobsite_site_renders_site_map_id_fkey" FOREIGN KEY ("site_map_id") REFERENCES "public"."company_jobsite_site_maps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_site_renders"
    ADD CONSTRAINT "company_jobsite_site_renders_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_visual_zones"
    ADD CONSTRAINT "company_jobsite_visual_zones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_visual_zones"
    ADD CONSTRAINT "company_jobsite_visual_zones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_visual_zones"
    ADD CONSTRAINT "company_jobsite_visual_zones_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_visual_zones"
    ADD CONSTRAINT "company_jobsite_visual_zones_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."company_jobsite_schedule_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsite_visual_zones"
    ADD CONSTRAINT "company_jobsite_visual_zones_site_map_id_fkey" FOREIGN KEY ("site_map_id") REFERENCES "public"."company_jobsite_site_maps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsite_visual_zones"
    ADD CONSTRAINT "company_jobsite_visual_zones_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsites"
    ADD CONSTRAINT "company_jobsites_audit_customer_id_fkey" FOREIGN KEY ("audit_customer_id") REFERENCES "public"."company_audit_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsites"
    ADD CONSTRAINT "company_jobsites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jobsites"
    ADD CONSTRAINT "company_jobsites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jobsites"
    ADD CONSTRAINT "company_jobsites_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsa_signoffs"
    ADD CONSTRAINT "company_jsa_signoffs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jsa_signoffs"
    ADD CONSTRAINT "company_jsa_signoffs_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_jsa_signoffs"
    ADD CONSTRAINT "company_jsa_signoffs_jsa_id_fkey" FOREIGN KEY ("jsa_id") REFERENCES "public"."company_jsas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_jsa_signoffs"
    ADD CONSTRAINT "company_jsa_signoffs_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_leadership_safety_scores"
    ADD CONSTRAINT "company_leadership_safety_scores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_leadership_safety_scores"
    ADD CONSTRAINT "company_leadership_safety_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_legal_issues"
    ADD CONSTRAINT "company_legal_issues_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."company_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_legal_issues"
    ADD CONSTRAINT "company_legal_issues_linked_document_id_fkey" FOREIGN KEY ("linked_document_id") REFERENCES "public"."company_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_memory_items"
    ADD CONSTRAINT "company_memory_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_memory_items"
    ADD CONSTRAINT "company_memory_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_mobile_feature_entitlements"
    ADD CONSTRAINT "company_mobile_feature_entitlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_mobile_feature_entitlements"
    ADD CONSTRAINT "company_mobile_feature_entitlements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_mobile_feature_entitlements"
    ADD CONSTRAINT "company_mobile_feature_entitlements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_mobile_feature_entitlements"
    ADD CONSTRAINT "company_mobile_feature_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_notification_preferences"
    ADD CONSTRAINT "company_notification_preferences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_notification_preferences"
    ADD CONSTRAINT "company_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_notifications"
    ADD CONSTRAINT "company_notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_notifications"
    ADD CONSTRAINT "company_notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_notifications"
    ADD CONSTRAINT "company_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_onboarding_imports"
    ADD CONSTRAINT "company_onboarding_imports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_onboarding_imports"
    ADD CONSTRAINT "company_onboarding_imports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_operations_records"
    ADD CONSTRAINT "company_operations_records_related_client_id_fkey" FOREIGN KEY ("related_client_id") REFERENCES "public"."company_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_operations_records"
    ADD CONSTRAINT "company_operations_records_related_document_id_fkey" FOREIGN KEY ("related_document_id") REFERENCES "public"."company_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permit_trigger_rules"
    ADD CONSTRAINT "company_permit_trigger_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_permit_trigger_rules"
    ADD CONSTRAINT "company_permit_trigger_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permit_trigger_rules"
    ADD CONSTRAINT "company_permit_trigger_rules_platform_rule_id_fkey" FOREIGN KEY ("platform_rule_id") REFERENCES "public"."platform_permit_trigger_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permit_trigger_rules"
    ADD CONSTRAINT "company_permit_trigger_rules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits_catalog"
    ADD CONSTRAINT "company_permits_catalog_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_permits_catalog"
    ADD CONSTRAINT "company_permits_catalog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits_catalog"
    ADD CONSTRAINT "company_permits_catalog_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_dap_activity_id_fkey" FOREIGN KEY ("dap_activity_id") REFERENCES "public"."company_jsa_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."company_jobsite_schedule_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_permits"
    ADD CONSTRAINT "company_permits_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_positions"
    ADD CONSTRAINT "company_positions_parent_position_id_fkey" FOREIGN KEY ("parent_position_id") REFERENCES "public"."company_positions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_positions"
    ADD CONSTRAINT "company_positions_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_report_attachments"
    ADD CONSTRAINT "company_report_attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_report_attachments"
    ADD CONSTRAINT "company_report_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_report_attachments"
    ADD CONSTRAINT "company_report_attachments_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_report_attachments"
    ADD CONSTRAINT "company_report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."company_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_reports"
    ADD CONSTRAINT "company_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_reports"
    ADD CONSTRAINT "company_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_reports"
    ADD CONSTRAINT "company_reports_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_reports"
    ADD CONSTRAINT "company_reports_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_ai_recommendations"
    ADD CONSTRAINT "company_risk_ai_recommendations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_ai_recommendations"
    ADD CONSTRAINT "company_risk_ai_recommendations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_ai_recommendations"
    ADD CONSTRAINT "company_risk_ai_recommendations_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_ai_recommendations"
    ADD CONSTRAINT "company_risk_ai_recommendations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_events"
    ADD CONSTRAINT "company_risk_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_events"
    ADD CONSTRAINT "company_risk_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_memory_facets"
    ADD CONSTRAINT "company_risk_memory_facets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_memory_facets"
    ADD CONSTRAINT "company_risk_memory_facets_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."company_contractors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_memory_facets"
    ADD CONSTRAINT "company_risk_memory_facets_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "public"."company_crews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_memory_facets"
    ADD CONSTRAINT "company_risk_memory_facets_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_memory_snapshots"
    ADD CONSTRAINT "company_risk_memory_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_memory_snapshots"
    ADD CONSTRAINT "company_risk_memory_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_memory_snapshots"
    ADD CONSTRAINT "company_risk_memory_snapshots_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_recommendation_events"
    ADD CONSTRAINT "company_risk_recommendation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_recommendation_events"
    ADD CONSTRAINT "company_risk_recommendation_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_recommendation_events"
    ADD CONSTRAINT "company_risk_recommendation_events_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "public"."company_risk_ai_recommendations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_scores"
    ADD CONSTRAINT "company_risk_scores_bucket_item_id_fkey" FOREIGN KEY ("bucket_item_id") REFERENCES "public"."company_bucket_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_scores"
    ADD CONSTRAINT "company_risk_scores_bucket_run_id_fkey" FOREIGN KEY ("bucket_run_id") REFERENCES "public"."company_bucket_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_scores"
    ADD CONSTRAINT "company_risk_scores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_risk_scores"
    ADD CONSTRAINT "company_risk_scores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_scores"
    ADD CONSTRAINT "company_risk_scores_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_risk_scores"
    ADD CONSTRAINT "company_risk_scores_work_area_id_fkey" FOREIGN KEY ("work_area_id") REFERENCES "public"."company_work_areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_rule_overrides"
    ADD CONSTRAINT "company_rule_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_rule_overrides"
    ADD CONSTRAINT "company_rule_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_rule_overrides"
    ADD CONSTRAINT "company_rule_overrides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_form_definitions"
    ADD CONSTRAINT "company_safety_form_definitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_safety_form_definitions"
    ADD CONSTRAINT "company_safety_form_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_form_submissions"
    ADD CONSTRAINT "company_safety_form_submissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_safety_form_submissions"
    ADD CONSTRAINT "company_safety_form_submissions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_form_submissions"
    ADD CONSTRAINT "company_safety_form_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_form_submissions"
    ADD CONSTRAINT "company_safety_form_submissions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."company_safety_form_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."company_safety_form_versions"
    ADD CONSTRAINT "company_safety_form_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_safety_form_versions"
    ADD CONSTRAINT "company_safety_form_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_form_versions"
    ADD CONSTRAINT "company_safety_form_versions_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."company_safety_form_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_safety_intelligence_audit_log"
    ADD CONSTRAINT "company_safety_intelligence_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_intelligence_audit_log"
    ADD CONSTRAINT "company_safety_intelligence_audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_safety_intelligence_audit_log"
    ADD CONSTRAINT "company_safety_intelligence_audit_log_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_intelligence_history"
    ADD CONSTRAINT "company_safety_intelligence_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_intelligence_history"
    ADD CONSTRAINT "company_safety_intelligence_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_safety_intelligence_history"
    ADD CONSTRAINT "company_safety_intelligence_history_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_submissions"
    ADD CONSTRAINT "company_safety_submissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_safety_submissions"
    ADD CONSTRAINT "company_safety_submissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_submissions"
    ADD CONSTRAINT "company_safety_submissions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_submissions"
    ADD CONSTRAINT "company_safety_submissions_linked_action_id_fkey" FOREIGN KEY ("linked_action_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_submissions"
    ADD CONSTRAINT "company_safety_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_safety_submissions"
    ADD CONSTRAINT "company_safety_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sales_activities"
    ADD CONSTRAINT "company_sales_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."company_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_schedule_prediction_cache"
    ADD CONSTRAINT "company_schedule_prediction_cache_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_schedule_prediction_cache"
    ADD CONSTRAINT "company_schedule_prediction_cache_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_schedule_prediction_cache"
    ADD CONSTRAINT "company_schedule_prediction_cache_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_security_events"
    ADD CONSTRAINT "company_security_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_security_events"
    ADD CONSTRAINT "company_security_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_security_events"
    ADD CONSTRAINT "company_security_events_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_signup_requests"
    ADD CONSTRAINT "company_signup_requests_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_signup_requests"
    ADD CONSTRAINT "company_signup_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_bucket_item_id_fkey" FOREIGN KEY ("bucket_item_id") REFERENCES "public"."company_bucket_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_company_task_id_fkey" FOREIGN KEY ("company_task_id") REFERENCES "public"."company_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_simultaneous_operations"
    ADD CONSTRAINT "company_simultaneous_operations_work_area_id_fkey" FOREIGN KEY ("work_area_id") REFERENCES "public"."company_work_areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sor_records"
    ADD CONSTRAINT "company_sor_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_sor_records"
    ADD CONSTRAINT "company_sor_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sor_records"
    ADD CONSTRAINT "company_sor_records_prediction_reviewed_by_fkey" FOREIGN KEY ("prediction_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sor_records"
    ADD CONSTRAINT "company_sor_records_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "public"."company_sor_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sor_records"
    ADD CONSTRAINT "company_sor_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sub_trades"
    ADD CONSTRAINT "company_sub_trades_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_sub_trades"
    ADD CONSTRAINT "company_sub_trades_company_trade_id_fkey" FOREIGN KEY ("company_trade_id") REFERENCES "public"."company_trades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_sub_trades"
    ADD CONSTRAINT "company_sub_trades_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sub_trades"
    ADD CONSTRAINT "company_sub_trades_platform_sub_trade_id_fkey" FOREIGN KEY ("platform_sub_trade_id") REFERENCES "public"."platform_sub_trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_sub_trades"
    ADD CONSTRAINT "company_sub_trades_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_subscriptions"
    ADD CONSTRAINT "company_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_controls"
    ADD CONSTRAINT "company_task_controls_company_control_id_fkey" FOREIGN KEY ("company_control_id") REFERENCES "public"."company_controls"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_task_controls"
    ADD CONSTRAINT "company_task_controls_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_controls"
    ADD CONSTRAINT "company_task_controls_company_task_id_fkey" FOREIGN KEY ("company_task_id") REFERENCES "public"."company_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_controls"
    ADD CONSTRAINT "company_task_controls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_task_hazards"
    ADD CONSTRAINT "company_task_hazards_company_hazard_id_fkey" FOREIGN KEY ("company_hazard_id") REFERENCES "public"."company_hazards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_task_hazards"
    ADD CONSTRAINT "company_task_hazards_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_hazards"
    ADD CONSTRAINT "company_task_hazards_company_task_id_fkey" FOREIGN KEY ("company_task_id") REFERENCES "public"."company_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_hazards"
    ADD CONSTRAINT "company_task_hazards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_task_permit_triggers"
    ADD CONSTRAINT "company_task_permit_triggers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_permit_triggers"
    ADD CONSTRAINT "company_task_permit_triggers_company_permits_catalog_id_fkey" FOREIGN KEY ("company_permits_catalog_id") REFERENCES "public"."company_permits_catalog"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_task_permit_triggers"
    ADD CONSTRAINT "company_task_permit_triggers_company_task_id_fkey" FOREIGN KEY ("company_task_id") REFERENCES "public"."company_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_permit_triggers"
    ADD CONSTRAINT "company_task_permit_triggers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_task_training_requirements"
    ADD CONSTRAINT "company_task_training_require_company_training_matrix_requ_fkey" FOREIGN KEY ("company_training_matrix_requirement_id") REFERENCES "public"."company_training_matrix_requirements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_task_training_requirements"
    ADD CONSTRAINT "company_task_training_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_training_requirements"
    ADD CONSTRAINT "company_task_training_requirements_company_task_id_fkey" FOREIGN KEY ("company_task_id") REFERENCES "public"."company_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_task_training_requirements"
    ADD CONSTRAINT "company_task_training_requirements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_company_sub_trade_id_fkey" FOREIGN KEY ("company_sub_trade_id") REFERENCES "public"."company_sub_trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_company_trade_id_fkey" FOREIGN KEY ("company_trade_id") REFERENCES "public"."company_trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_platform_task_template_id_fkey" FOREIGN KEY ("platform_task_template_id") REFERENCES "public"."platform_task_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_tasks"
    ADD CONSTRAINT "company_tasks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_toolbox_attendees"
    ADD CONSTRAINT "company_toolbox_attendees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_toolbox_attendees"
    ADD CONSTRAINT "company_toolbox_attendees_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."company_toolbox_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_toolbox_attendees"
    ADD CONSTRAINT "company_toolbox_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_toolbox_sessions"
    ADD CONSTRAINT "company_toolbox_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_toolbox_sessions"
    ADD CONSTRAINT "company_toolbox_sessions_conducted_by_fkey" FOREIGN KEY ("conducted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_toolbox_sessions"
    ADD CONSTRAINT "company_toolbox_sessions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_toolbox_sessions"
    ADD CONSTRAINT "company_toolbox_sessions_linked_corrective_action_id_fkey" FOREIGN KEY ("linked_corrective_action_id") REFERENCES "public"."company_corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_toolbox_sessions"
    ADD CONSTRAINT "company_toolbox_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."company_toolbox_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_toolbox_templates"
    ADD CONSTRAINT "company_toolbox_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_toolbox_templates"
    ADD CONSTRAINT "company_toolbox_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_trades"
    ADD CONSTRAINT "company_trades_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_trades"
    ADD CONSTRAINT "company_trades_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_trades"
    ADD CONSTRAINT "company_trades_platform_trade_id_fkey" FOREIGN KEY ("platform_trade_id") REFERENCES "public"."platform_trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_trades"
    ADD CONSTRAINT "company_trades_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_training_matrix_requirements"
    ADD CONSTRAINT "company_training_matrix_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_training_matrix_requirements"
    ADD CONSTRAINT "company_training_matrix_requirements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_training_matrix_requirements"
    ADD CONSTRAINT "company_training_matrix_requirements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_training_requirements"
    ADD CONSTRAINT "company_training_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_training_requirements"
    ADD CONSTRAINT "company_training_requirements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_weather_conditions"
    ADD CONSTRAINT "company_weather_conditions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_weather_conditions"
    ADD CONSTRAINT "company_weather_conditions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_weather_conditions"
    ADD CONSTRAINT "company_weather_conditions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_work_areas"
    ADD CONSTRAINT "company_work_areas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_work_areas"
    ADD CONSTRAINT "company_work_areas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_work_areas"
    ADD CONSTRAINT "company_work_areas_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_work_areas"
    ADD CONSTRAINT "company_work_areas_parent_area_id_fkey" FOREIGN KEY ("parent_area_id") REFERENCES "public"."company_work_areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_work_areas"
    ADD CONSTRAINT "company_work_areas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_intake_tokens"
    ADD CONSTRAINT "contractor_employee_intake_tokens_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."contractor_employee_jobsite_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_intake_tokens"
    ADD CONSTRAINT "contractor_employee_intake_tokens_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_intake_tokens"
    ADD CONSTRAINT "contractor_employee_intake_tokens_contractor_employee_id_fkey" FOREIGN KEY ("contractor_employee_id") REFERENCES "public"."contractor_employee_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_intake_tokens"
    ADD CONSTRAINT "contractor_employee_intake_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_intake_tokens"
    ADD CONSTRAINT "contractor_employee_intake_tokens_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignm_contractor_employee_id_fkey" FOREIGN KEY ("contractor_employee_id") REFERENCES "public"."contractor_employee_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."company_contractors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_jobsite_assignments"
    ADD CONSTRAINT "contractor_employee_jobsite_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_profiles"
    ADD CONSTRAINT "contractor_employee_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_profiles"
    ADD CONSTRAINT "contractor_employee_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_training_records"
    ADD CONSTRAINT "contractor_employee_training_record_contractor_employee_id_fkey" FOREIGN KEY ("contractor_employee_id") REFERENCES "public"."contractor_employee_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contractor_employee_training_records"
    ADD CONSTRAINT "contractor_employee_training_records_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."jobsite_contractor_training_requirements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contractor_employee_training_records"
    ADD CONSTRAINT "contractor_employee_training_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."corrective_actions"
    ADD CONSTRAINT "corrective_actions_assigned_company_user_id_fkey" FOREIGN KEY ("assigned_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."corrective_actions"
    ADD CONSTRAINT "corrective_actions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."corrective_actions"
    ADD CONSTRAINT "corrective_actions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."corrective_actions"
    ADD CONSTRAINT "corrective_actions_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."corrective_actions"
    ADD CONSTRAINT "corrective_actions_source_dap_id_fkey" FOREIGN KEY ("source_dap_id") REFERENCES "public"."daps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."corrective_actions"
    ADD CONSTRAINT "corrective_actions_verified_by_company_user_id_fkey" FOREIGN KEY ("verified_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "daily_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "daily_reports_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "daily_reports_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dap_activities"
    ADD CONSTRAINT "dap_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dap_activities"
    ADD CONSTRAINT "dap_activities_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dap_activities"
    ADD CONSTRAINT "dap_activities_dap_id_fkey" FOREIGN KEY ("dap_id") REFERENCES "public"."daps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daps"
    ADD CONSTRAINT "daps_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daps"
    ADD CONSTRAINT "daps_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daps"
    ADD CONSTRAINT "daps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daps"
    ADD CONSTRAINT "daps_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daps"
    ADD CONSTRAINT "daps_owner_company_user_id_fkey" FOREIGN KEY ("owner_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daps"
    ADD CONSTRAINT "daps_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_downloads"
    ADD CONSTRAINT "document_downloads_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_downloads"
    ADD CONSTRAINT "document_downloads_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_downloads"
    ADD CONSTRAINT "document_downloads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_versions"
    ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "public"."company_generated_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_restored_by_fkey" FOREIGN KEY ("restored_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_document_assignments"
    ADD CONSTRAINT "employee_document_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_document_assignments"
    ADD CONSTRAINT "employee_document_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."hr_document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_document_assignments"
    ADD CONSTRAINT "employee_document_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_document_signatures"
    ADD CONSTRAINT "employee_document_signatures_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."employee_document_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_document_signatures"
    ADD CONSTRAINT "employee_document_signatures_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "public"."company_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_document_signatures"
    ADD CONSTRAINT "employee_document_signatures_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."hr_document_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employee_document_signatures"
    ADD CONSTRAINT "employee_document_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_pay_rates"
    ADD CONSTRAINT "employee_pay_rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_profiles"
    ADD CONSTRAINT "employee_profiles_time_card_role_id_fkey" FOREIGN KEY ("time_card_role_id") REFERENCES "public"."time_card_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_profiles"
    ADD CONSTRAINT "employee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_time_card_payroll"
    ADD CONSTRAINT "employee_time_card_payroll_time_card_id_fkey" FOREIGN KEY ("time_card_id") REFERENCES "public"."employee_time_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_time_cards"
    ADD CONSTRAINT "employee_time_cards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_time_cards"
    ADD CONSTRAINT "employee_time_cards_employee_user_id_fkey" FOREIGN KEY ("employee_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_time_cards"
    ADD CONSTRAINT "employee_time_cards_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."time_card_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."time_card_tasks"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employee_time_entries"
    ADD CONSTRAINT "employee_time_entries_time_card_id_fkey" FOREIGN KEY ("time_card_id") REFERENCES "public"."employee_time_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gus_generated_plans"
    ADD CONSTRAINT "gus_generated_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gus_generated_plans"
    ADD CONSTRAINT "gus_generated_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gus_generated_plans"
    ADD CONSTRAINT "gus_generated_plans_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gus_generated_plans"
    ADD CONSTRAINT "gus_generated_plans_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."gus_planning_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gus_planning_messages"
    ADD CONSTRAINT "gus_planning_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."gus_planning_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gus_planning_sessions"
    ADD CONSTRAINT "gus_planning_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gus_planning_sessions"
    ADD CONSTRAINT "gus_planning_sessions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gus_planning_sessions"
    ADD CONSTRAINT "gus_planning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hazard_categories"
    ADD CONSTRAINT "hazard_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hr_document_templates"
    ADD CONSTRAINT "hr_document_templates_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "public"."company_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incident_notification_deliveries"
    ADD CONSTRAINT "incident_notification_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incident_notification_deliveries"
    ADD CONSTRAINT "incident_notification_deliveries_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incident_root_causes"
    ADD CONSTRAINT "incident_root_causes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incident_root_causes"
    ADD CONSTRAINT "incident_root_causes_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incident_root_causes"
    ADD CONSTRAINT "incident_root_causes_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_reported_by_company_user_id_fkey" FOREIGN KEY ("reported_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingestion_audit_log"
    ADD CONSTRAINT "ingestion_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingestion_audit_log"
    ADD CONSTRAINT "ingestion_audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingestion_audit_log"
    ADD CONSTRAINT "ingestion_audit_log_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."injury_forecast_audit_log"
    ADD CONSTRAINT "injury_forecast_audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."injury_forecast_audit_log"
    ADD CONSTRAINT "injury_forecast_audit_log_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."injury_forecast_audit_log"
    ADD CONSTRAINT "injury_forecast_audit_log_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."injury_weather_daily_snapshots"
    ADD CONSTRAINT "injury_weather_daily_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_jobsite_audits"
    ADD CONSTRAINT "internal_jobsite_audits_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_contractor_training_requirements"
    ADD CONSTRAINT "jobsite_contractor_training_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_contractor_training_requirements"
    ADD CONSTRAINT "jobsite_contractor_training_requirements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobsite_contractor_training_requirements"
    ADD CONSTRAINT "jobsite_contractor_training_requirements_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_contractor_training_requirements"
    ADD CONSTRAINT "jobsite_contractor_training_requirements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobsite_rule_overrides"
    ADD CONSTRAINT "jobsite_rule_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_rule_overrides"
    ADD CONSTRAINT "jobsite_rule_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobsite_rule_overrides"
    ADD CONSTRAINT "jobsite_rule_overrides_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_rule_overrides"
    ADD CONSTRAINT "jobsite_rule_overrides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobsite_users"
    ADD CONSTRAINT "jobsite_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_users"
    ADD CONSTRAINT "jobsite_users_company_user_id_fkey" FOREIGN KEY ("company_user_id") REFERENCES "public"."company_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_users"
    ADD CONSTRAINT "jobsite_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobsite_users"
    ADD CONSTRAINT "jobsite_users_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_users"
    ADD CONSTRAINT "jobsite_users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobsite_weather_subscriptions"
    ADD CONSTRAINT "jobsite_weather_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_weather_subscriptions"
    ADD CONSTRAINT "jobsite_weather_subscriptions_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsite_weather_subscriptions"
    ADD CONSTRAINT "jobsite_weather_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsites"
    ADD CONSTRAINT "jobsites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobsites"
    ADD CONSTRAINT "jobsites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobsites"
    ADD CONSTRAINT "jobsites_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."library_document_tags"
    ADD CONSTRAINT "library_document_tags_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."library_document_tags"
    ADD CONSTRAINT "library_document_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."library_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."library_documents"
    ADD CONSTRAINT "library_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."library_categories"("id");



ALTER TABLE ONLY "public"."marketplace_document_purchases"
    ADD CONSTRAINT "marketplace_document_purchases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_document_purchases"
    ADD CONSTRAINT "marketplace_document_purchases_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_document_purchases"
    ADD CONSTRAINT "marketplace_document_purchases_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_document_purchases"
    ADD CONSTRAINT "marketplace_document_purchases_purchased_by_user_id_fkey" FOREIGN KEY ("purchased_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observation_photos"
    ADD CONSTRAINT "observation_photos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observation_photos"
    ADD CONSTRAINT "observation_photos_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observation_photos"
    ADD CONSTRAINT "observation_photos_uploaded_by_company_user_id_fkey" FOREIGN KEY ("uploaded_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observation_photos"
    ADD CONSTRAINT "observation_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_dap_activity_id_fkey" FOREIGN KEY ("dap_activity_id") REFERENCES "public"."dap_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_observer_company_user_id_fkey" FOREIGN KEY ("observer_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_observer_id_fkey" FOREIGN KEY ("observer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permit_types"
    ADD CONSTRAINT "permit_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_approved_by_company_user_id_fkey" FOREIGN KEY ("approved_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_dap_activity_id_fkey" FOREIGN KEY ("dap_activity_id") REFERENCES "public"."dap_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_permit_type_id_fkey" FOREIGN KEY ("permit_type_id") REFERENCES "public"."permit_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permits"
    ADD CONSTRAINT "permits_requested_by_company_user_id_fkey" FOREIGN KEY ("requested_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_jurisdiction_standard_mappings"
    ADD CONSTRAINT "platform_jurisdiction_standard_mappings_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."platform_jurisdiction_standards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_jurisdiction_standard_mappings"
    ADD CONSTRAINT "platform_jurisdiction_standard_mappings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_jurisdiction_standard_overrides"
    ADD CONSTRAINT "platform_jurisdiction_standard_overrides_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."platform_jurisdiction_standards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_jurisdiction_standard_overrides"
    ADD CONSTRAINT "platform_jurisdiction_standard_overrides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_jurisdiction_standards"
    ADD CONSTRAINT "platform_jurisdiction_standards_jurisdiction_code_fkey" FOREIGN KEY ("jurisdiction_code") REFERENCES "public"."platform_jurisdictions"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_jurisdiction_standards"
    ADD CONSTRAINT "platform_jurisdiction_standards_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_jurisdictions"
    ADD CONSTRAINT "platform_jurisdictions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_major_construction_fatality_incident_controls"
    ADD CONSTRAINT "platform_major_construction_fatality_incident__incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."platform_major_construction_fatality_incidents"("incident_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_sub_trades"
    ADD CONSTRAINT "platform_sub_trades_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "public"."platform_trades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_task_templates"
    ADD CONSTRAINT "platform_task_templates_sub_trade_id_fkey" FOREIGN KEY ("sub_trade_id") REFERENCES "public"."platform_sub_trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_task_templates"
    ADD CONSTRAINT "platform_task_templates_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "public"."platform_trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pshsep_attachments"
    ADD CONSTRAINT "pshsep_attachments_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."pshsep_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pshsep_attachments"
    ADD CONSTRAINT "pshsep_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pshsep_drafts"
    ADD CONSTRAINT "pshsep_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pshsep_submissions"
    ADD CONSTRAINT "pshsep_submissions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."pshsep_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pshsep_submissions"
    ADD CONSTRAINT "pshsep_submissions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pshsep_submissions"
    ADD CONSTRAINT "pshsep_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_daily_report_id_fkey" FOREIGN KEY ("daily_report_id") REFERENCES "public"."daily_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_snapshots"
    ADD CONSTRAINT "report_snapshots_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_data_bucket"
    ADD CONSTRAINT "safety_data_bucket_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."safety_data_bucket"
    ADD CONSTRAINT "safety_data_bucket_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_data_bucket"
    ADD CONSTRAINT "safety_data_bucket_ingestion_audit_log_id_fkey" FOREIGN KEY ("ingestion_audit_log_id") REFERENCES "public"."ingestion_audit_log"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."safety_data_bucket"
    ADD CONSTRAINT "safety_data_bucket_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_data_bucket"
    ADD CONSTRAINT "safety_data_bucket_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_scores"
    ADD CONSTRAINT "safety_scores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."safety_scores"
    ADD CONSTRAINT "safety_scores_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_scores"
    ADD CONSTRAINT "safety_scores_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sif_reviews"
    ADD CONSTRAINT "sif_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sif_reviews"
    ADD CONSTRAINT "sif_reviews_corrective_action_id_fkey" FOREIGN KEY ("corrective_action_id") REFERENCES "public"."corrective_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sif_reviews"
    ADD CONSTRAINT "sif_reviews_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sif_reviews"
    ADD CONSTRAINT "sif_reviews_reviewer_company_user_id_fkey" FOREIGN KEY ("reviewer_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sor_audit_log"
    ADD CONSTRAINT "sor_audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sor_audit_log"
    ADD CONSTRAINT "sor_audit_log_sor_id_fkey" FOREIGN KEY ("sor_id") REFERENCES "public"."company_sor_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sor_audit_log"
    ADD CONSTRAINT "sor_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_card_role_categories"
    ADD CONSTRAINT "time_card_role_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."time_card_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_card_role_categories"
    ADD CONSTRAINT "time_card_role_categories_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."time_card_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_card_role_tasks"
    ADD CONSTRAINT "time_card_role_tasks_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."time_card_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_card_role_tasks"
    ADD CONSTRAINT "time_card_role_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."time_card_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_card_tasks"
    ADD CONSTRAINT "time_card_tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."time_card_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_expiration_notification_deliveries"
    ADD CONSTRAINT "training_expiration_notification_deliver_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_expiration_notification_deliveries"
    ADD CONSTRAINT "training_expiration_notification_deliverie_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_expiration_notification_deliveries"
    ADD CONSTRAINT "training_expiration_notification_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_agreements"
    ADD CONSTRAINT "user_agreements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_dashboard_layouts"
    ADD CONSTRAINT "user_dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_onboarding_state"
    ADD CONSTRAINT "user_onboarding_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_submissions"
    ADD CONSTRAINT "user_submissions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_submissions"
    ADD CONSTRAINT "user_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weather_alert_events"
    ADD CONSTRAINT "weather_alert_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weather_alert_events"
    ADD CONSTRAINT "weather_alert_events_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weather_logs"
    ADD CONSTRAINT "weather_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weather_logs"
    ADD CONSTRAINT "weather_logs_created_by_company_user_id_fkey" FOREIGN KEY ("created_by_company_user_id") REFERENCES "public"."company_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weather_logs"
    ADD CONSTRAINT "weather_logs_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weather_notification_deliveries"
    ADD CONSTRAINT "weather_notification_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weather_notification_deliveries"
    ADD CONSTRAINT "weather_notification_deliveries_jobsite_id_fkey" FOREIGN KEY ("jobsite_id") REFERENCES "public"."company_jobsites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weather_notification_deliveries"
    ADD CONSTRAINT "weather_notification_deliveries_recipient_employee_id_fkey" FOREIGN KEY ("recipient_employee_id") REFERENCES "public"."company_employee_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weather_notification_deliveries"
    ADD CONSTRAINT "weather_notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weather_notification_deliveries"
    ADD CONSTRAINT "weather_notification_deliveries_weather_alert_event_id_fkey" FOREIGN KEY ("weather_alert_event_id") REFERENCES "public"."weather_alert_events"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create authorized finance users" ON "public"."company_finance_authorized_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can delete HR assignments" ON "public"."employee_document_assignments" FOR DELETE TO "authenticated" USING ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can delete HR templates" ON "public"."hr_document_templates" FOR DELETE TO "authenticated" USING ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can delete authorized finance users" ON "public"."company_finance_authorized_users" FOR DELETE TO "authenticated" USING ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can delete company positions" ON "public"."company_positions" FOR DELETE TO "authenticated" USING ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can delete employee profiles" ON "public"."employee_profiles" FOR DELETE TO "authenticated" USING ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can insert HR assignments" ON "public"."employee_document_assignments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can insert HR templates" ON "public"."hr_document_templates" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can insert company positions" ON "public"."company_positions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage all time cards" ON "public"."employee_time_cards" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage all time entries" ON "public"."employee_time_entries" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage employee profiles" ON "public"."employee_profiles" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage time card categories" ON "public"."time_card_categories" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage time card role categories" ON "public"."time_card_role_categories" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage time card role tasks" ON "public"."time_card_role_tasks" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage time card roles" ON "public"."time_card_roles" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can manage time card tasks" ON "public"."time_card_tasks" TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can update HR templates" ON "public"."hr_document_templates" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can update authorized finance users" ON "public"."company_finance_authorized_users" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Admins can update company positions" ON "public"."company_positions" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_admin"()) WITH CHECK ("public"."is_company_portal_admin"());



CREATE POLICY "Employees can create clients" ON "public"."company_clients" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can create documents" ON "public"."company_documents" FOR INSERT TO "authenticated" WITH CHECK ((("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_company_portal_employee"()));



CREATE POLICY "Employees can create legal issues" ON "public"."company_legal_issues" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can create onboarding items" ON "public"."client_onboarding_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can create operations records" ON "public"."company_operations_records" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can create own HR signatures" ON "public"."employee_document_signatures" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("consented" = true) AND (EXISTS ( SELECT 1
   FROM "public"."employee_document_assignments" "assignment"
  WHERE (("assignment"."id" = "employee_document_signatures"."assignment_id") AND ("assignment"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("assignment"."template_id" = "employee_document_signatures"."template_id") AND ("assignment"."status" = 'pending'::"text"))))));



CREATE POLICY "Employees can create own draft time cards" ON "public"."employee_time_cards" FOR INSERT TO "authenticated" WITH CHECK ((("employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'draft'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."employee_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."profile_status" = 'active'::"text") AND ("profile"."time_card_role_id" IS NOT NULL))))));



CREATE POLICY "Employees can create own editable time entries" ON "public"."employee_time_entries" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employee_time_cards" "card"
  WHERE (("card"."id" = "employee_time_entries"."time_card_id") AND ("card"."employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("card"."status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"]))))));



CREATE POLICY "Employees can create sales activities" ON "public"."company_sales_activities" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can delete documents" ON "public"."company_documents" FOR DELETE TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can delete operations records" ON "public"."company_operations_records" FOR DELETE TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can delete own editable time entries" ON "public"."employee_time_entries" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employee_time_cards" "card"
  WHERE (("card"."id" = "employee_time_entries"."time_card_id") AND ("card"."employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("card"."status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"]))))));



CREATE POLICY "Employees can insert own profile" ON "public"."employee_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"()));



CREATE POLICY "Employees can manage document requirements" ON "public"."company_document_requirements" TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read assigned HR templates" ON "public"."hr_document_templates" FOR SELECT TO "authenticated" USING (("public"."is_company_portal_admin"() OR ("active" AND (EXISTS ( SELECT 1
   FROM "public"."employee_document_assignments" "assignment"
  WHERE (("assignment"."template_id" = "hr_document_templates"."id") AND ("assignment"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Employees can read checklist items" ON "public"."company_checklist_items" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read clients" ON "public"."company_clients" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read company positions" ON "public"."company_positions" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read demo requests" ON "public"."demo_requests" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read document requirements" ON "public"."company_document_requirements" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read documents" ON "public"."company_documents" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read legal issues" ON "public"."company_legal_issues" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read onboarding items" ON "public"."client_onboarding_items" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read operations records" ON "public"."company_operations_records" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read own HR assignments" ON "public"."employee_document_assignments" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"()));



CREATE POLICY "Employees can read own HR signatures" ON "public"."employee_document_signatures" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"()));



CREATE POLICY "Employees can read own profile" ON "public"."employee_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"()));



CREATE POLICY "Employees can read own time cards" ON "public"."employee_time_cards" FOR SELECT TO "authenticated" USING ((("employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"()));



CREATE POLICY "Employees can read own time entries" ON "public"."employee_time_entries" FOR SELECT TO "authenticated" USING (("public"."is_company_portal_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."employee_time_cards" "card"
  WHERE (("card"."id" = "employee_time_entries"."time_card_id") AND ("card"."employee_user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Employees can read sales activities" ON "public"."company_sales_activities" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read time card categories" ON "public"."time_card_categories" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read time card role categories" ON "public"."time_card_role_categories" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read time card role tasks" ON "public"."time_card_role_tasks" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read time card roles" ON "public"."time_card_roles" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can read time card tasks" ON "public"."time_card_tasks" FOR SELECT TO "authenticated" USING ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update checklist items" ON "public"."company_checklist_items" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update clients" ON "public"."company_clients" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update demo requests" ON "public"."demo_requests" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update documents" ON "public"."company_documents" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update legal issues" ON "public"."company_legal_issues" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update onboarding items" ON "public"."client_onboarding_items" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update operations records" ON "public"."company_operations_records" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Employees can update own HR assignments" ON "public"."employee_document_assignments" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"())) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"()));



CREATE POLICY "Employees can update own editable time cards" ON "public"."employee_time_cards" FOR UPDATE TO "authenticated" USING ((("employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"])))) WITH CHECK ((("employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'rejected'::"text"]))));



CREATE POLICY "Employees can update own editable time entries" ON "public"."employee_time_entries" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employee_time_cards" "card"
  WHERE (("card"."id" = "employee_time_entries"."time_card_id") AND ("card"."employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("card"."status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employee_time_cards" "card"
  WHERE (("card"."id" = "employee_time_entries"."time_card_id") AND ("card"."employee_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("card"."status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"]))))));



CREATE POLICY "Employees can update own profile" ON "public"."employee_profiles" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"())) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_company_portal_admin"()));



CREATE POLICY "Employees can update sales activities" ON "public"."company_sales_activities" FOR UPDATE TO "authenticated" USING ("public"."is_company_portal_employee"()) WITH CHECK ("public"."is_company_portal_employee"());



CREATE POLICY "Finance users and admins can read authorized finance users" ON "public"."company_finance_authorized_users" FOR SELECT TO "authenticated" USING (("public"."is_company_finance_user"() OR "public"."is_company_portal_admin"()));



CREATE POLICY "Finance users can create finance receipts" ON "public"."company_finance_receipts" FOR INSERT TO "authenticated" WITH CHECK ((("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_company_finance_user"()));



CREATE POLICY "Finance users can delete finance receipts" ON "public"."company_finance_receipts" FOR DELETE TO "authenticated" USING ("public"."is_company_finance_user"());



CREATE POLICY "Finance users can manage finance budgets" ON "public"."company_finance_budgets" TO "authenticated" USING ("public"."is_company_finance_user"()) WITH CHECK ("public"."is_company_finance_user"());



CREATE POLICY "Finance users can manage finance recurring items" ON "public"."company_finance_recurring_items" TO "authenticated" USING ("public"."is_company_finance_user"()) WITH CHECK ("public"."is_company_finance_user"());



CREATE POLICY "Finance users can manage finance transactions" ON "public"."company_finance_transactions" TO "authenticated" USING ("public"."is_company_finance_user"()) WITH CHECK ("public"."is_company_finance_user"());



CREATE POLICY "Finance users can read finance receipts" ON "public"."company_finance_receipts" FOR SELECT TO "authenticated" USING ("public"."is_company_finance_user"());



CREATE POLICY "Owners can manage employee pay rates" ON "public"."employee_pay_rates" TO "authenticated" USING ("public"."is_company_portal_owner"()) WITH CHECK ("public"."is_company_portal_owner"());



CREATE POLICY "Owners can manage time card payroll" ON "public"."employee_time_card_payroll" TO "authenticated" USING ("public"."is_company_portal_owner"()) WITH CHECK ("public"."is_company_portal_owner"());



CREATE POLICY "Users can insert own agreement acceptance" ON "public"."user_agreements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own agreement acceptance" ON "public"."user_agreements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own agreement acceptance" ON "public"."user_agreements" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_call_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_call_log_no_anon_select" ON "public"."ai_call_log" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."ai_engine_recommendation_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_engine_recommendation_snapshots_no_authenticated_select" ON "public"."ai_engine_recommendation_snapshots" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."ai_output_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_output_feedback_no_authenticated_select" ON "public"."ai_output_feedback" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."ai_visual_generation_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_visual_generation_jobs_no_authenticated_access" ON "public"."ai_visual_generation_jobs" TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."behavior_risk_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "behavior_risk_events_insert_scope" ON "public"."behavior_risk_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id"))))));



CREATE POLICY "behavior_risk_events_select_scope" ON "public"."behavior_risk_events" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id"))))));



CREATE POLICY "behavior_risk_events_update_scope" ON "public"."behavior_risk_events" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "behavior_risk_events"."company_id"))))));



ALTER TABLE "public"."billing_customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_customers_mutate_staff" ON "public"."billing_customers" TO "authenticated" USING ("public"."billing_staff_can_mutate_company"("company_id")) WITH CHECK ("public"."billing_staff_can_mutate_company"("company_id"));



CREATE POLICY "billing_customers_select" ON "public"."billing_customers" FOR SELECT TO "authenticated" USING ("public"."billing_user_can_access_company"("company_id"));



ALTER TABLE "public"."billing_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_events_insert_staff" ON "public"."billing_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_events"."invoice_id") AND "public"."billing_staff_can_mutate_company"("i"."company_id")))));



CREATE POLICY "billing_events_select" ON "public"."billing_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_events"."invoice_id") AND "public"."billing_user_can_access_company"("i"."company_id")))));



ALTER TABLE "public"."billing_invoice_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_invoice_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_invoice_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_invoices_delete_staff" ON "public"."billing_invoices" FOR DELETE TO "authenticated" USING ("public"."billing_is_super_platform"());



CREATE POLICY "billing_invoices_insert_staff" ON "public"."billing_invoices" FOR INSERT TO "authenticated" WITH CHECK ("public"."billing_staff_can_mutate_company"("company_id"));



CREATE POLICY "billing_invoices_select" ON "public"."billing_invoices" FOR SELECT TO "authenticated" USING ("public"."billing_user_can_access_company"("company_id"));



CREATE POLICY "billing_invoices_update_staff" ON "public"."billing_invoices" FOR UPDATE TO "authenticated" USING ("public"."billing_staff_can_mutate_company"("company_id")) WITH CHECK ("public"."billing_staff_can_mutate_company"("company_id"));



CREATE POLICY "billing_line_items_select" ON "public"."billing_invoice_line_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_invoice_line_items"."invoice_id") AND "public"."billing_user_can_access_company"("i"."company_id")))));



CREATE POLICY "billing_line_items_staff_all" ON "public"."billing_invoice_line_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_invoice_line_items"."invoice_id") AND "public"."billing_staff_can_mutate_company"("i"."company_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_invoice_line_items"."invoice_id") AND "public"."billing_staff_can_mutate_company"("i"."company_id")))));



CREATE POLICY "billing_payments_select" ON "public"."billing_invoice_payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_invoice_payments"."invoice_id") AND "public"."billing_user_can_access_company"("i"."company_id")))));



CREATE POLICY "billing_payments_staff_mutate" ON "public"."billing_invoice_payments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_invoice_payments"."invoice_id") AND "public"."billing_staff_can_mutate_company"("i"."company_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."billing_invoices" "i"
  WHERE (("i"."id" = "billing_invoice_payments"."invoice_id") AND "public"."billing_staff_can_mutate_company"("i"."company_id")))));



CREATE POLICY "billing_staff_assign_super_all" ON "public"."billing_staff_company_assignments" TO "authenticated" USING ("public"."billing_is_super_platform"()) WITH CHECK ("public"."billing_is_super_platform"());



ALTER TABLE "public"."billing_staff_company_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_onboarding_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_delete_admin_only" ON "public"."companies" FOR DELETE TO "authenticated" USING ("public"."is_admin_role"());



CREATE POLICY "companies_insert_admin_only" ON "public"."companies" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_role"());



CREATE POLICY "companies_select_admin_or_member" ON "public"."companies" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR "public"."security_is_company_member"("id")));



CREATE POLICY "companies_update_admin_only" ON "public"."companies" FOR UPDATE TO "authenticated" USING ("public"."is_admin_role"()) WITH CHECK ("public"."is_admin_role"());



ALTER TABLE "public"."company_ai_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_ai_reviews_delete_manager_scope" ON "public"."company_ai_reviews" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_ai_reviews_insert_manager_scope" ON "public"."company_ai_reviews" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_ai_reviews_select_member_scope" ON "public"."company_ai_reviews" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_ai_reviews_update_manager_scope" ON "public"."company_ai_reviews" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_analytics_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_analytics_snapshots_delete_company_scope" ON "public"."company_analytics_snapshots" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_analytics_snapshots_insert_company_scope" ON "public"."company_analytics_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_analytics_snapshots_select_company_scope" ON "public"."company_analytics_snapshots" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_analytics_snapshots_update_company_scope" ON "public"."company_analytics_snapshots" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_audit_customer_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_audit_customer_locations_insert_scope" ON "public"."company_audit_customer_locations" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_audit_customer_locations_select_scope" ON "public"."company_audit_customer_locations" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_audit_customer_locations_update_scope" ON "public"."company_audit_customer_locations" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_audit_customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_audit_customers_insert_scope" ON "public"."company_audit_customers" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_audit_customers_select_scope" ON "public"."company_audit_customers" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_audit_customers_update_scope" ON "public"."company_audit_customers" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_auditflow_action_links_insert_scope" ON "public"."company_auditflow_corrective_action_links" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_auditflow_action_links_select_scope" ON "public"."company_auditflow_corrective_action_links" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



ALTER TABLE "public"."company_auditflow_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_auditflow_assignments_insert_scope" ON "public"."company_auditflow_assignments" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_auditflow_assignments_select_scope" ON "public"."company_auditflow_assignments" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_auditflow_assignments_update_scope" ON "public"."company_auditflow_assignments" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_is_company_member"("company_id"));



ALTER TABLE "public"."company_auditflow_corrective_action_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_auditflow_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_auditflow_submissions_insert_scope" ON "public"."company_auditflow_submissions" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_auditflow_submissions_select_scope" ON "public"."company_auditflow_submissions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_auditflow_submissions_update_scope" ON "public"."company_auditflow_submissions" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_is_company_member"("company_id"));



ALTER TABLE "public"."company_auditflow_template_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_auditflow_template_versions_insert_scope" ON "public"."company_auditflow_template_versions" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_auditflow_template_versions_select_scope" ON "public"."company_auditflow_template_versions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



ALTER TABLE "public"."company_auditflow_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_auditflow_templates_insert_scope" ON "public"."company_auditflow_templates" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_auditflow_templates_select_scope" ON "public"."company_auditflow_templates" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_auditflow_templates_update_scope" ON "public"."company_auditflow_templates" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_bucket_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_bucket_items_delete_write_scope" ON "public"."company_bucket_items" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_bucket_items_insert_write_scope" ON "public"."company_bucket_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_bucket_items_select_member_scope" ON "public"."company_bucket_items" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_bucket_items_update_write_scope" ON "public"."company_bucket_items" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_bucket_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_bucket_runs_delete_write_scope" ON "public"."company_bucket_runs" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_bucket_runs_insert_write_scope" ON "public"."company_bucket_runs" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_bucket_runs_select_member_scope" ON "public"."company_bucket_runs" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_bucket_runs_update_write_scope" ON "public"."company_bucket_runs" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_conflict_pairs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_conflict_pairs_delete_manager_scope" ON "public"."company_conflict_pairs" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_conflict_pairs_insert_manager_scope" ON "public"."company_conflict_pairs" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_conflict_pairs_select_member_scope" ON "public"."company_conflict_pairs" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_conflict_pairs_update_manager_scope" ON "public"."company_conflict_pairs" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_conflict_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_conflict_rules_delete_write_scope" ON "public"."company_conflict_rules" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_conflict_rules_insert_write_scope" ON "public"."company_conflict_rules" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_conflict_rules_select_member_scope" ON "public"."company_conflict_rules" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_conflict_rules_update_write_scope" ON "public"."company_conflict_rules" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_contractor_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_contractor_documents_insert_scope" ON "public"."company_contractor_documents" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id"))))));



CREATE POLICY "company_contractor_documents_select_scope" ON "public"."company_contractor_documents" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id"))))));



CREATE POLICY "company_contractor_documents_update_scope" ON "public"."company_contractor_documents" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_documents"."company_id"))))));



ALTER TABLE "public"."company_contractor_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_contractor_evaluations_insert_scope" ON "public"."company_contractor_evaluations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_evaluations"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_evaluations"."company_id"))))));



CREATE POLICY "company_contractor_evaluations_select_scope" ON "public"."company_contractor_evaluations" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_evaluations"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractor_evaluations"."company_id"))))));



ALTER TABLE "public"."company_contractors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_contractors_insert_scope" ON "public"."company_contractors" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id"))))));



CREATE POLICY "company_contractors_select_scope" ON "public"."company_contractors" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id"))))));



CREATE POLICY "company_contractors_update_scope" ON "public"."company_contractors" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_contractors"."company_id"))))));



ALTER TABLE "public"."company_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_controls_delete_write_scope" ON "public"."company_controls" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_controls_insert_write_scope" ON "public"."company_controls" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_controls_select_member_scope" ON "public"."company_controls" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_controls_update_write_scope" ON "public"."company_controls" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_corrective_action_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_corrective_action_events_delete_company_scope" ON "public"."company_corrective_action_events" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_corrective_action_events_insert_company_scope" ON "public"."company_corrective_action_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_corrective_action_events_select_company_scope" ON "public"."company_corrective_action_events" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_corrective_action_events_update_company_scope" ON "public"."company_corrective_action_events" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_corrective_action_evidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_corrective_action_evidence_delete_company_scope" ON "public"."company_corrective_action_evidence" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_corrective_action_evidence_insert_company_scope" ON "public"."company_corrective_action_evidence" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_corrective_action_evidence_select_company_scope" ON "public"."company_corrective_action_evidence" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_corrective_action_evidence_update_company_scope" ON "public"."company_corrective_action_evidence" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_corrective_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_corrective_actions_delete_company_scope" ON "public"."company_corrective_actions" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_corrective_actions_insert_company_scope" ON "public"."company_corrective_actions" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_corrective_actions_select_company_scope" ON "public"."company_corrective_actions" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_corrective_actions_update_company_scope" ON "public"."company_corrective_actions" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_credit_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_credit_transactions_delete_manager_scope" ON "public"."company_credit_transactions" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_credit_transactions_insert_manager_scope" ON "public"."company_credit_transactions" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_credit_transactions_select_manager_scope" ON "public"."company_credit_transactions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_credit_transactions_select_member_scope" ON "public"."company_credit_transactions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_credit_transactions_update_manager_scope" ON "public"."company_credit_transactions" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_crews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_crews_insert_scope" ON "public"."company_crews" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id"))))));



CREATE POLICY "company_crews_select_scope" ON "public"."company_crews" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id"))))));



CREATE POLICY "company_crews_update_scope" ON "public"."company_crews" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_crews"."company_id"))))));



CREATE POLICY "company_dap_activities_delete_company_scope" ON "public"."company_jsa_activities" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_dap_activities_insert_company_scope" ON "public"."company_jsa_activities" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_dap_activities_select_company_scope" ON "public"."company_jsa_activities" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_dap_activities_update_company_scope" ON "public"."company_jsa_activities" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_daps_delete_company_scope" ON "public"."company_jsas" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_data_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_data_requests_insert_manager_scope" ON "public"."company_data_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND "public"."security_is_company_manager"("company_id")));



CREATE POLICY "company_data_requests_select_manager_scope" ON "public"."company_data_requests" FOR SELECT TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_data_requests_update_manager_scope" ON "public"."company_data_requests" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_document_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_document_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_document_templates_delete_manager_scope" ON "public"."company_document_templates" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_document_templates_insert_manager_scope" ON "public"."company_document_templates" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_document_templates_select_member_scope" ON "public"."company_document_templates" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_document_templates_update_manager_scope" ON "public"."company_document_templates" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_employee_jobsite_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_employee_jobsite_assignments_delete_manager_scope" ON "public"."company_employee_jobsite_assignments" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_employee_jobsite_assignments_insert_manager_scope" ON "public"."company_employee_jobsite_assignments" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_employee_jobsite_assignments_select_company_scope" ON "public"."company_employee_jobsite_assignments" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_employee_jobsite_assignments_update_manager_scope" ON "public"."company_employee_jobsite_assignments" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_employee_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_employee_profiles_delete_manager_scope" ON "public"."company_employee_profiles" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_employee_profiles_insert_manager_scope" ON "public"."company_employee_profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_employee_profiles_select_company_scope" ON "public"."company_employee_profiles" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_employee_profiles_update_manager_scope" ON "public"."company_employee_profiles" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_employee_training_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_employee_training_records_delete_manager_scope" ON "public"."company_employee_training_records" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_employee_training_records_insert_manager_scope" ON "public"."company_employee_training_records" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_employee_training_records_select_company_scope" ON "public"."company_employee_training_records" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_employee_training_records_update_manager_scope" ON "public"."company_employee_training_records" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_finance_authorized_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_finance_budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_finance_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_finance_recurring_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_finance_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_generated_document_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_generated_document_versions_delete_manager_scope" ON "public"."company_generated_document_versions" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_generated_document_versions_insert_manager_scope" ON "public"."company_generated_document_versions" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_generated_document_versions_select_member_scope" ON "public"."company_generated_document_versions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_generated_document_versions_update_manager_scope" ON "public"."company_generated_document_versions" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_generated_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_generated_documents_delete_manager_scope" ON "public"."company_generated_documents" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_generated_documents_insert_manager_scope" ON "public"."company_generated_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_generated_documents_select_member_scope" ON "public"."company_generated_documents" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_generated_documents_update_manager_scope" ON "public"."company_generated_documents" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_hazards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_hazards_delete_write_scope" ON "public"."company_hazards" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_hazards_insert_write_scope" ON "public"."company_hazards" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_hazards_select_member_scope" ON "public"."company_hazards" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_hazards_update_write_scope" ON "public"."company_hazards" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_hris_roster_imports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_hris_roster_imports_insert_scope" ON "public"."company_hris_roster_imports" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_hris_roster_imports"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_hris_roster_imports"."company_id"))))));



CREATE POLICY "company_hris_roster_imports_select_scope" ON "public"."company_hris_roster_imports" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_hris_roster_imports"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_hris_roster_imports"."company_id"))))));



ALTER TABLE "public"."company_incidents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_incidents_delete_company_scope" ON "public"."company_incidents" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_incidents_insert_company_scope" ON "public"."company_incidents" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_incidents_select_company_scope" ON "public"."company_incidents" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_incidents_update_company_scope" ON "public"."company_incidents" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_induction_completions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_induction_completions_insert_scope" ON "public"."company_induction_completions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id"))))));



CREATE POLICY "company_induction_completions_select_scope" ON "public"."company_induction_completions" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id"))))));



CREATE POLICY "company_induction_completions_update_scope" ON "public"."company_induction_completions" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_completions"."company_id"))))));



ALTER TABLE "public"."company_induction_programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_induction_programs_insert_scope" ON "public"."company_induction_programs" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id"))))));



CREATE POLICY "company_induction_programs_select_scope" ON "public"."company_induction_programs" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id"))))));



CREATE POLICY "company_induction_programs_update_scope" ON "public"."company_induction_programs" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_programs"."company_id"))))));



ALTER TABLE "public"."company_induction_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_induction_requirements_insert_scope" ON "public"."company_induction_requirements" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id"))))));



CREATE POLICY "company_induction_requirements_select_scope" ON "public"."company_induction_requirements" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id"))))));



CREATE POLICY "company_induction_requirements_update_scope" ON "public"."company_induction_requirements" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_induction_requirements"."company_id"))))));



ALTER TABLE "public"."company_inspection_calendar_signoffs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_inspection_calendar_signoffs_insert_scope" ON "public"."company_inspection_calendar_signoffs" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_inspection_calendar_signoffs_select_scope" ON "public"."company_inspection_calendar_signoffs" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_inspection_calendar_signoffs_update_scope" ON "public"."company_inspection_calendar_signoffs" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_integration_webhook_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_integration_webhook_deliveries_insert_scope" ON "public"."company_integration_webhook_deliveries" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhook_deliveries"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhook_deliveries"."company_id"))))));



CREATE POLICY "company_integration_webhook_deliveries_select_scope" ON "public"."company_integration_webhook_deliveries" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhook_deliveries"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhook_deliveries"."company_id"))))));



ALTER TABLE "public"."company_integration_webhooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_integration_webhooks_insert_scope" ON "public"."company_integration_webhooks" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id"))))));



CREATE POLICY "company_integration_webhooks_select_scope" ON "public"."company_integration_webhooks" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id"))))));



CREATE POLICY "company_integration_webhooks_update_scope" ON "public"."company_integration_webhooks" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_integration_webhooks"."company_id"))))));



ALTER TABLE "public"."company_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_invites_delete_manager_scope" ON "public"."company_invites" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_invites_insert_manager_scope" ON "public"."company_invites" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_invites_select_manager_scope" ON "public"."company_invites" FOR SELECT TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_invites_update_manager_scope" ON "public"."company_invites" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_jobsite_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_assignments_delete_manager_scope" ON "public"."company_jobsite_assignments" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_jobsite_assignments_insert_manager_scope" ON "public"."company_jobsite_assignments" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_jobsite_assignments_select_manager_scope" ON "public"."company_jobsite_assignments" FOR SELECT TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_jobsite_assignments_update_manager_scope" ON "public"."company_jobsite_assignments" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_jobsite_audit_observation_evidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_audit_observation_evidence_insert_scope" ON "public"."company_jobsite_audit_observation_evidence" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsite_audit_observation_evidence_select_scope" ON "public"."company_jobsite_audit_observation_evidence" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



ALTER TABLE "public"."company_jobsite_audit_observations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_audit_observations_insert_scope" ON "public"."company_jobsite_audit_observations" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_submit_company_field_audit"("company_id"));



CREATE POLICY "company_jobsite_audit_observations_select_scope" ON "public"."company_jobsite_audit_observations" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_audit_observations_update_scope" ON "public"."company_jobsite_audit_observations" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_submit_company_field_audit"("company_id"));



ALTER TABLE "public"."company_jobsite_audit_report_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_audit_report_deliveries_insert_scope" ON "public"."company_jobsite_audit_report_deliveries" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsite_audit_report_deliveries_select_scope" ON "public"."company_jobsite_audit_report_deliveries" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_audit_report_deliveries_update_scope" ON "public"."company_jobsite_audit_report_deliveries" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_jobsite_audit_signoffs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_audit_signoffs_insert_scope" ON "public"."company_jobsite_audit_signoffs" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsite_audit_signoffs_select_scope" ON "public"."company_jobsite_audit_signoffs" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_audit_signoffs_update_scope" ON "public"."company_jobsite_audit_signoffs" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_jobsite_audits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_audits_insert_scope" ON "public"."company_jobsite_audits" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_submit_company_field_audit"("company_id"));



CREATE POLICY "company_jobsite_audits_select_scope" ON "public"."company_jobsite_audits" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_audits_update_scope" ON "public"."company_jobsite_audits" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_submit_company_field_audit"("company_id"));



ALTER TABLE "public"."company_jobsite_chemicals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_chemicals_insert_scope" ON "public"."company_jobsite_chemicals" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id"))))));



CREATE POLICY "company_jobsite_chemicals_select_scope" ON "public"."company_jobsite_chemicals" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id"))))));



CREATE POLICY "company_jobsite_chemicals_update_scope" ON "public"."company_jobsite_chemicals" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_chemicals"."company_id"))))));



ALTER TABLE "public"."company_jobsite_daily_todos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_daily_todos_insert_scope" ON "public"."company_jobsite_daily_todos" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id"))))));



CREATE POLICY "company_jobsite_daily_todos_select_scope" ON "public"."company_jobsite_daily_todos" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id"))))));



CREATE POLICY "company_jobsite_daily_todos_update_scope" ON "public"."company_jobsite_daily_todos" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jobsite_daily_todos"."company_id"))))));



ALTER TABLE "public"."company_jobsite_schedule_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_schedule_items_insert_scope" ON "public"."company_jobsite_schedule_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_schedule_items"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_schedule_items"."company_id"))))));



CREATE POLICY "company_jobsite_schedule_items_select_scope" ON "public"."company_jobsite_schedule_items" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_schedule_items_update_scope" ON "public"."company_jobsite_schedule_items" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_schedule_items"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_schedule_items"."company_id"))))));



ALTER TABLE "public"."company_jobsite_site_blueprints" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_site_blueprints_delete_scope" ON "public"."company_jobsite_site_blueprints" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsite_site_blueprints_insert_scope" ON "public"."company_jobsite_site_blueprints" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_site_blueprints"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_site_blueprints"."company_id"))))));



CREATE POLICY "company_jobsite_site_blueprints_select_scope" ON "public"."company_jobsite_site_blueprints" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_site_blueprints_update_scope" ON "public"."company_jobsite_site_blueprints" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_site_blueprints"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_site_blueprints"."company_id"))))));



ALTER TABLE "public"."company_jobsite_site_maps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_site_maps_delete_scope" ON "public"."company_jobsite_site_maps" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsite_site_maps_insert_scope" ON "public"."company_jobsite_site_maps" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_site_maps"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_site_maps"."company_id"))))));



CREATE POLICY "company_jobsite_site_maps_select_scope" ON "public"."company_jobsite_site_maps" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_site_maps_update_scope" ON "public"."company_jobsite_site_maps" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_site_maps"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_site_maps"."company_id"))))));



ALTER TABLE "public"."company_jobsite_site_renders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_site_renders_delete_scope" ON "public"."company_jobsite_site_renders" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsite_site_renders_insert_scope" ON "public"."company_jobsite_site_renders" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_site_renders"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_site_renders"."company_id"))))));



CREATE POLICY "company_jobsite_site_renders_select_scope" ON "public"."company_jobsite_site_renders" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_site_renders_update_scope" ON "public"."company_jobsite_site_renders" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_jobsite_site_renders"."jobsite_id") AND ("jobsite"."company_id" = "company_jobsite_site_renders"."company_id"))))));



ALTER TABLE "public"."company_jobsite_visual_zones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsite_visual_zones_delete_scope" ON "public"."company_jobsite_visual_zones" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsite_visual_zones_insert_scope" ON "public"."company_jobsite_visual_zones" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsite_site_maps" "site_map"
  WHERE (("site_map"."id" = "company_jobsite_visual_zones"."site_map_id") AND ("site_map"."company_id" = "company_jobsite_visual_zones"."company_id") AND ("site_map"."jobsite_id" = "company_jobsite_visual_zones"."jobsite_id"))))));



CREATE POLICY "company_jobsite_visual_zones_select_scope" ON "public"."company_jobsite_visual_zones" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsite_visual_zones_update_scope" ON "public"."company_jobsite_visual_zones" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsite_site_maps" "site_map"
  WHERE (("site_map"."id" = "company_jobsite_visual_zones"."site_map_id") AND ("site_map"."company_id" = "company_jobsite_visual_zones"."company_id") AND ("site_map"."jobsite_id" = "company_jobsite_visual_zones"."jobsite_id"))))));



ALTER TABLE "public"."company_jobsites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jobsites_delete_company_scope" ON "public"."company_jobsites" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsites_insert_company_scope" ON "public"."company_jobsites" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jobsites_select_company_scope" ON "public"."company_jobsites" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jobsites_update_company_scope" ON "public"."company_jobsites" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_jsa_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jsa_activities_scope" ON "public"."company_jsa_activities" TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsa_activities"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsa_activities"."company_id") AND ("actor"."account_status" = 'active'::"text")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsa_activities"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsa_activities"."company_id") AND ("actor"."account_status" = 'active'::"text"))))));



ALTER TABLE "public"."company_jsa_signoffs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jsa_signoffs_insert_scope" ON "public"."company_jsa_signoffs" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_jsa_signoffs_select_scope" ON "public"."company_jsa_signoffs" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_jsa_signoffs_update_scope" ON "public"."company_jsa_signoffs" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_jsas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_jsas_insert_scope" ON "public"."company_jsas" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id"))))));



CREATE POLICY "company_jsas_select_scope" ON "public"."company_jsas" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id"))))));



CREATE POLICY "company_jsas_update_scope" ON "public"."company_jsas" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_jsas"."company_id"))))));



ALTER TABLE "public"."company_leadership_safety_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_leadership_safety_scores_insert_managers" ON "public"."company_leadership_safety_scores" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"])))))));



CREATE POLICY "company_leadership_safety_scores_select_scope" ON "public"."company_leadership_safety_scores" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR ("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text", 'project_manager'::"text", 'field_supervisor'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text", 'project_manager'::"text", 'field_supervisor'::"text"])))))));



CREATE POLICY "company_leadership_safety_scores_update_managers" ON "public"."company_leadership_safety_scores" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_leadership_safety_scores"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"])))))));



ALTER TABLE "public"."company_legal_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_memberships_delete_company_scope" ON "public"."company_memberships" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_memberships_insert_company_scope" ON "public"."company_memberships" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_memberships_select_company_scope" ON "public"."company_memberships" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_memberships_update_company_scope" ON "public"."company_memberships" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_memory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_memory_items_delete_lead" ON "public"."company_memory_items" FOR DELETE TO "authenticated" USING ("public"."security_can_mutate_company_memory"("company_id"));



CREATE POLICY "company_memory_items_insert_lead" ON "public"."company_memory_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_mutate_company_memory"("company_id"));



CREATE POLICY "company_memory_items_select_member" ON "public"."company_memory_items" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_memory_items_update_lead" ON "public"."company_memory_items" FOR UPDATE TO "authenticated" USING ("public"."security_can_mutate_company_memory"("company_id")) WITH CHECK ("public"."security_can_mutate_company_memory"("company_id"));



ALTER TABLE "public"."company_mobile_feature_entitlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_mobile_feature_entitlements_mutate_scope" ON "public"."company_mobile_feature_entitlements" TO "authenticated" USING ("public"."security_can_write_company_data"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_mobile_feature_entitlements_select_scope" ON "public"."company_mobile_feature_entitlements" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



ALTER TABLE "public"."company_notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_notification_preferences_insert_self" ON "public"."company_notification_preferences" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notification_preferences"."company_id") AND ("actor"."status" = 'active'::"text"))))));



CREATE POLICY "company_notification_preferences_select_self_or_admin" ON "public"."company_notification_preferences" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notification_preferences"."company_id") AND ("actor"."status" = 'active'::"text") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notification_preferences"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"])))))));



CREATE POLICY "company_notification_preferences_update_self" ON "public"."company_notification_preferences" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."company_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_notifications_insert_company_scope" ON "public"."company_notifications" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR ("recipient_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id") AND ("actor"."status" = 'active'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id"))))));



CREATE POLICY "company_notifications_select_recipient_or_admin" ON "public"."company_notifications" FOR SELECT TO "authenticated" USING ((("recipient_user_id" = "auth"."uid"()) OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id") AND ("actor"."status" = 'active'::"text") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"])))))));



CREATE POLICY "company_notifications_update_recipient_or_admin" ON "public"."company_notifications" FOR UPDATE TO "authenticated" USING ((("recipient_user_id" = "auth"."uid"()) OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id") AND ("actor"."status" = 'active'::"text") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))))) WITH CHECK ((("recipient_user_id" = "auth"."uid"()) OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id") AND ("actor"."status" = 'active'::"text") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_notifications"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"])))))));



ALTER TABLE "public"."company_onboarding_imports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_onboarding_imports_delete_manager_scope" ON "public"."company_onboarding_imports" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_onboarding_imports_insert_manager_scope" ON "public"."company_onboarding_imports" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_onboarding_imports_select_company_scope" ON "public"."company_onboarding_imports" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_onboarding_imports_update_manager_scope" ON "public"."company_onboarding_imports" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_operations_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_permit_trigger_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_permit_trigger_rules_delete_write_scope" ON "public"."company_permit_trigger_rules" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_permit_trigger_rules_insert_write_scope" ON "public"."company_permit_trigger_rules" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_permit_trigger_rules_select_member_scope" ON "public"."company_permit_trigger_rules" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_permit_trigger_rules_update_write_scope" ON "public"."company_permit_trigger_rules" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_permits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_permits_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_permits_catalog_delete_write_scope" ON "public"."company_permits_catalog" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_permits_catalog_insert_write_scope" ON "public"."company_permits_catalog" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_permits_catalog_select_member_scope" ON "public"."company_permits_catalog" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_permits_catalog_update_write_scope" ON "public"."company_permits_catalog" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_permits_delete_company_scope" ON "public"."company_permits" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_permits_insert_company_scope" ON "public"."company_permits" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_permits_select_company_scope" ON "public"."company_permits" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_permits_update_company_scope" ON "public"."company_permits" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_report_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_report_attachments_delete_company_scope" ON "public"."company_report_attachments" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_report_attachments_insert_company_scope" ON "public"."company_report_attachments" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_report_attachments_select_company_scope" ON "public"."company_report_attachments" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_report_attachments_update_company_scope" ON "public"."company_report_attachments" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_reports_delete_company_scope" ON "public"."company_reports" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_reports_insert_company_scope" ON "public"."company_reports" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_reports_select_company_scope" ON "public"."company_reports" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_reports_update_company_scope" ON "public"."company_reports" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_risk_ai_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_risk_ai_recommendations_insert_scope" ON "public"."company_risk_ai_recommendations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id"))))));



CREATE POLICY "company_risk_ai_recommendations_select_scope" ON "public"."company_risk_ai_recommendations" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id"))))));



CREATE POLICY "company_risk_ai_recommendations_update_scope" ON "public"."company_risk_ai_recommendations" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_ai_recommendations"."company_id"))))));



ALTER TABLE "public"."company_risk_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_risk_events_delete_company_scope" ON "public"."company_risk_events" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_risk_events_insert_company_scope" ON "public"."company_risk_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_risk_events_select_company_scope" ON "public"."company_risk_events" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_risk_events_update_company_scope" ON "public"."company_risk_events" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_risk_memory_facets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_risk_memory_facets_delete_scope" ON "public"."company_risk_memory_facets" FOR DELETE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id"))))));



CREATE POLICY "company_risk_memory_facets_insert_scope" ON "public"."company_risk_memory_facets" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id"))))));



CREATE POLICY "company_risk_memory_facets_select_scope" ON "public"."company_risk_memory_facets" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id"))))));



CREATE POLICY "company_risk_memory_facets_update_scope" ON "public"."company_risk_memory_facets" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_facets"."company_id"))))));



ALTER TABLE "public"."company_risk_memory_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_risk_memory_snapshots_insert_scope" ON "public"."company_risk_memory_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id"))))));



CREATE POLICY "company_risk_memory_snapshots_select_scope" ON "public"."company_risk_memory_snapshots" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id"))))));



CREATE POLICY "company_risk_memory_snapshots_update_scope" ON "public"."company_risk_memory_snapshots" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_memory_snapshots"."company_id"))))));



ALTER TABLE "public"."company_risk_recommendation_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_risk_recommendation_events_insert_scope" ON "public"."company_risk_recommendation_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_recommendation_events"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_recommendation_events"."company_id"))))));



CREATE POLICY "company_risk_recommendation_events_select_scope" ON "public"."company_risk_recommendation_events" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_recommendation_events"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_risk_recommendation_events"."company_id"))))));



ALTER TABLE "public"."company_risk_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_risk_scores_delete_manager_scope" ON "public"."company_risk_scores" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_risk_scores_insert_manager_scope" ON "public"."company_risk_scores" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_risk_scores_select_member_scope" ON "public"."company_risk_scores" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_risk_scores_update_manager_scope" ON "public"."company_risk_scores" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_rule_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_rule_overrides_delete_manager_scope" ON "public"."company_rule_overrides" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_rule_overrides_insert_manager_scope" ON "public"."company_rule_overrides" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_rule_overrides_select_member_scope" ON "public"."company_rule_overrides" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_rule_overrides_update_manager_scope" ON "public"."company_rule_overrides" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_safety_form_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_safety_form_definitions_insert_scope" ON "public"."company_safety_form_definitions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id"))))));



CREATE POLICY "company_safety_form_definitions_select_scope" ON "public"."company_safety_form_definitions" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id"))))));



CREATE POLICY "company_safety_form_definitions_update_scope" ON "public"."company_safety_form_definitions" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_definitions"."company_id"))))));



ALTER TABLE "public"."company_safety_form_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_safety_form_submissions_insert_scope" ON "public"."company_safety_form_submissions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id"))))));



CREATE POLICY "company_safety_form_submissions_select_scope" ON "public"."company_safety_form_submissions" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id"))))));



CREATE POLICY "company_safety_form_submissions_update_scope" ON "public"."company_safety_form_submissions" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_submissions"."company_id"))))));



ALTER TABLE "public"."company_safety_form_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_safety_form_versions_insert_scope" ON "public"."company_safety_form_versions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_versions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_versions"."company_id"))))));



CREATE POLICY "company_safety_form_versions_select_scope" ON "public"."company_safety_form_versions" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_versions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_safety_form_versions"."company_id"))))));



ALTER TABLE "public"."company_safety_intelligence_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_safety_intelligence_audit_log_delete_manager_scope" ON "public"."company_safety_intelligence_audit_log" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_safety_intelligence_audit_log_insert_manager_scope" ON "public"."company_safety_intelligence_audit_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_safety_intelligence_audit_log_select_manager_scope" ON "public"."company_safety_intelligence_audit_log" FOR SELECT TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_safety_intelligence_audit_log_update_manager_scope" ON "public"."company_safety_intelligence_audit_log" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_safety_intelligence_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_safety_intelligence_history_delete_manager_scope" ON "public"."company_safety_intelligence_history" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_safety_intelligence_history_insert_manager_scope" ON "public"."company_safety_intelligence_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_safety_intelligence_history_select_manager_scope" ON "public"."company_safety_intelligence_history" FOR SELECT TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "company_safety_intelligence_history_update_manager_scope" ON "public"."company_safety_intelligence_history" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."company_safety_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_safety_submissions_delete_company_scope" ON "public"."company_safety_submissions" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_safety_submissions_insert_company_scope" ON "public"."company_safety_submissions" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_safety_submissions_select_company_scope" ON "public"."company_safety_submissions" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "company_safety_submissions_update_company_scope" ON "public"."company_safety_submissions" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."company_sales_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_schedule_prediction_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_schedule_prediction_cache_insert_scope" ON "public"."company_schedule_prediction_cache" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_is_company_member"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_schedule_prediction_cache"."jobsite_id") AND ("jobsite"."company_id" = "company_schedule_prediction_cache"."company_id"))))));



CREATE POLICY "company_schedule_prediction_cache_select_scope" ON "public"."company_schedule_prediction_cache" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_schedule_prediction_cache_update_scope" ON "public"."company_schedule_prediction_cache" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK (("public"."security_is_company_member"("company_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "company_schedule_prediction_cache"."jobsite_id") AND ("jobsite"."company_id" = "company_schedule_prediction_cache"."company_id"))))));



ALTER TABLE "public"."company_security_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_security_events_insert_member_scope" ON "public"."company_security_events" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND "public"."security_is_company_member"("company_id")));



CREATE POLICY "company_security_events_select_manager_scope" ON "public"."company_security_events" FOR SELECT TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_signup_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_signup_requests_admin_select" ON "public"."company_signup_requests" FOR SELECT TO "authenticated" USING ("public"."is_admin_role"());



CREATE POLICY "company_signup_requests_admin_update" ON "public"."company_signup_requests" FOR UPDATE TO "authenticated" USING ("public"."is_admin_role"()) WITH CHECK ("public"."is_admin_role"());



ALTER TABLE "public"."company_simultaneous_operations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_simultaneous_operations_delete_write_scope" ON "public"."company_simultaneous_operations" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_simultaneous_operations_insert_write_scope" ON "public"."company_simultaneous_operations" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_simultaneous_operations_select_member_scope" ON "public"."company_simultaneous_operations" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_simultaneous_operations_update_write_scope" ON "public"."company_simultaneous_operations" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_sor_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_sub_trades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_sub_trades_delete_write_scope" ON "public"."company_sub_trades" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_sub_trades_insert_write_scope" ON "public"."company_sub_trades" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_sub_trades_select_member_scope" ON "public"."company_sub_trades" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_sub_trades_update_write_scope" ON "public"."company_sub_trades" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_subscriptions_delete_admin_only" ON "public"."company_subscriptions" FOR DELETE TO "authenticated" USING ("public"."is_admin_role"());



CREATE POLICY "company_subscriptions_delete_manager_scope" ON "public"."company_subscriptions" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_subscriptions_insert_admin_only" ON "public"."company_subscriptions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_role"());



CREATE POLICY "company_subscriptions_insert_manager_scope" ON "public"."company_subscriptions" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_subscriptions_select_manager_scope" ON "public"."company_subscriptions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_subscriptions_select_member_scope" ON "public"."company_subscriptions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_subscriptions_update_admin_only" ON "public"."company_subscriptions" FOR UPDATE TO "authenticated" USING ("public"."is_admin_role"()) WITH CHECK ("public"."is_admin_role"());



CREATE POLICY "company_subscriptions_update_manager_scope" ON "public"."company_subscriptions" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_task_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_task_controls_delete_write_scope" ON "public"."company_task_controls" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_controls_insert_write_scope" ON "public"."company_task_controls" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_controls_select_member_scope" ON "public"."company_task_controls" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_task_controls_update_write_scope" ON "public"."company_task_controls" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_task_hazards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_task_hazards_delete_write_scope" ON "public"."company_task_hazards" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_hazards_insert_write_scope" ON "public"."company_task_hazards" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_hazards_select_member_scope" ON "public"."company_task_hazards" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_task_hazards_update_write_scope" ON "public"."company_task_hazards" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_task_permit_triggers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_task_permit_triggers_delete_write_scope" ON "public"."company_task_permit_triggers" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_permit_triggers_insert_write_scope" ON "public"."company_task_permit_triggers" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_permit_triggers_select_member_scope" ON "public"."company_task_permit_triggers" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_task_permit_triggers_update_write_scope" ON "public"."company_task_permit_triggers" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_task_training_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_task_training_requirements_delete_write_scope" ON "public"."company_task_training_requirements" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_training_requirements_insert_write_scope" ON "public"."company_task_training_requirements" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_task_training_requirements_select_member_scope" ON "public"."company_task_training_requirements" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_task_training_requirements_update_write_scope" ON "public"."company_task_training_requirements" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_tasks_delete_write_scope" ON "public"."company_tasks" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_tasks_insert_write_scope" ON "public"."company_tasks" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_tasks_select_member_scope" ON "public"."company_tasks" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_tasks_update_write_scope" ON "public"."company_tasks" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_toolbox_attendees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_toolbox_attendees_insert_scope" ON "public"."company_toolbox_attendees" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id"))))));



CREATE POLICY "company_toolbox_attendees_select_scope" ON "public"."company_toolbox_attendees" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id"))))));



CREATE POLICY "company_toolbox_attendees_update_scope" ON "public"."company_toolbox_attendees" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_attendees"."company_id"))))));



ALTER TABLE "public"."company_toolbox_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_toolbox_sessions_insert_scope" ON "public"."company_toolbox_sessions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id"))))));



CREATE POLICY "company_toolbox_sessions_select_scope" ON "public"."company_toolbox_sessions" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id"))))));



CREATE POLICY "company_toolbox_sessions_update_scope" ON "public"."company_toolbox_sessions" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_sessions"."company_id"))))));



ALTER TABLE "public"."company_toolbox_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_toolbox_templates_insert_scope" ON "public"."company_toolbox_templates" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id"))))));



CREATE POLICY "company_toolbox_templates_select_scope" ON "public"."company_toolbox_templates" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id"))))));



CREATE POLICY "company_toolbox_templates_update_scope" ON "public"."company_toolbox_templates" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_toolbox_templates"."company_id"))))));



ALTER TABLE "public"."company_trades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_trades_delete_write_scope" ON "public"."company_trades" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_trades_insert_write_scope" ON "public"."company_trades" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_trades_select_member_scope" ON "public"."company_trades" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_trades_update_write_scope" ON "public"."company_trades" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_training_matrix_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_training_matrix_requirements_delete_write_scope" ON "public"."company_training_matrix_requirements" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_training_matrix_requirements_insert_write_scope" ON "public"."company_training_matrix_requirements" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_training_matrix_requirements_select_member_scope" ON "public"."company_training_matrix_requirements" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_training_matrix_requirements_update_write_scope" ON "public"."company_training_matrix_requirements" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_training_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_training_requirements_delete_lead" ON "public"."company_training_requirements" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."company_id" = "company_training_requirements"."company_id") AND ("m"."user_id" = "auth"."uid"()) AND (COALESCE("m"."status", ''::"text") = 'active'::"text") AND (COALESCE("m"."role", ''::"text") = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR "public"."is_admin_role"()));



CREATE POLICY "company_training_requirements_insert_lead" ON "public"."company_training_requirements" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."company_id" = "company_training_requirements"."company_id") AND ("m"."user_id" = "auth"."uid"()) AND (COALESCE("m"."status", ''::"text") = 'active'::"text") AND (COALESCE("m"."role", ''::"text") = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR "public"."is_admin_role"()));



CREATE POLICY "company_training_requirements_select_member" ON "public"."company_training_requirements" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."company_id" = "company_training_requirements"."company_id") AND ("m"."user_id" = "auth"."uid"()) AND (COALESCE("m"."status", ''::"text") = 'active'::"text")))) OR "public"."is_admin_role"()));



CREATE POLICY "company_training_requirements_update_lead" ON "public"."company_training_requirements" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."company_id" = "company_training_requirements"."company_id") AND ("m"."user_id" = "auth"."uid"()) AND (COALESCE("m"."status", ''::"text") = 'active'::"text") AND (COALESCE("m"."role", ''::"text") = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR "public"."is_admin_role"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."company_id" = "company_training_requirements"."company_id") AND ("m"."user_id" = "auth"."uid"()) AND (COALESCE("m"."status", ''::"text") = 'active'::"text") AND (COALESCE("m"."role", ''::"text") = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR "public"."is_admin_role"()));



ALTER TABLE "public"."company_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_users_delete_manager_scope" ON "public"."company_users" FOR DELETE TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_users_insert_manager_scope" ON "public"."company_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_users_select_manager_scope" ON "public"."company_users" FOR SELECT TO "authenticated" USING ("public"."security_is_company_manager"("company_id"));



CREATE POLICY "company_users_update_manager_scope" ON "public"."company_users" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_manager"("company_id")) WITH CHECK ("public"."security_is_company_manager"("company_id"));



ALTER TABLE "public"."company_weather_conditions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_weather_conditions_delete_write_scope" ON "public"."company_weather_conditions" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_weather_conditions_insert_write_scope" ON "public"."company_weather_conditions" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_weather_conditions_select_member_scope" ON "public"."company_weather_conditions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_weather_conditions_update_write_scope" ON "public"."company_weather_conditions" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."company_work_areas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_work_areas_delete_write_scope" ON "public"."company_work_areas" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_work_areas_insert_write_scope" ON "public"."company_work_areas" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "company_work_areas_select_member_scope" ON "public"."company_work_areas" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "company_work_areas_update_write_scope" ON "public"."company_work_areas" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."contractor_employee_intake_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contractor_employee_jobsite_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contractor_employee_jobsite_assignments_company_scope" ON "public"."contractor_employee_jobsite_assignments" TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."company_id" = "contractor_employee_jobsite_assignments"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "r"
  WHERE (("r"."user_id" = "auth"."uid"()) AND ("r"."company_id" = "contractor_employee_jobsite_assignments"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."company_id" = "contractor_employee_jobsite_assignments"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "r"
  WHERE (("r"."user_id" = "auth"."uid"()) AND ("r"."company_id" = "contractor_employee_jobsite_assignments"."company_id"))))));



ALTER TABLE "public"."contractor_employee_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contractor_employee_training_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."corrective_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "corrective_actions_delete_company_scope" ON "public"."corrective_actions" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "corrective_actions_insert_company_scope" ON "public"."corrective_actions" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "corrective_actions_select_company_scope" ON "public"."corrective_actions" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "corrective_actions_update_company_scope" ON "public"."corrective_actions" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_transactions_admin_all" ON "public"."credit_transactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "credit_transactions_select_own" ON "public"."credit_transactions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."daily_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_reports_delete_company_scope" ON "public"."daily_reports" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "daily_reports_insert_company_scope" ON "public"."daily_reports" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "daily_reports_select_company_scope" ON "public"."daily_reports" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "daily_reports_update_company_scope" ON "public"."daily_reports" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."dap_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dap_activities_delete_company_scope" ON "public"."dap_activities" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "dap_activities_insert_company_scope" ON "public"."dap_activities" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "dap_activities_select_company_scope" ON "public"."dap_activities" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "dap_activities_update_company_scope" ON "public"."dap_activities" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."daps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daps_delete_company_scope" ON "public"."daps" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "daps_insert_company_scope" ON "public"."daps" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "daps_select_company_scope" ON "public"."daps" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "daps_update_company_scope" ON "public"."daps" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."demo_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_downloads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "document_downloads_admin_all" ON "public"."document_downloads" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "document_downloads_insert_own" ON "public"."document_downloads" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "actor_user_id"));



CREATE POLICY "document_downloads_select_own" ON "public"."document_downloads" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "actor_user_id") OR ("auth"."uid"() = "owner_user_id")));



ALTER TABLE "public"."document_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "document_versions_delete_company_scope" ON "public"."document_versions" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "document_versions_insert_company_scope" ON "public"."document_versions" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "document_versions_select_company_scope" ON "public"."document_versions" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "document_versions_update_company_scope" ON "public"."document_versions" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_delete_company_scope" ON "public"."documents" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "documents_insert_company_scope" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "documents_scope" ON "public"."documents" TO "authenticated" USING (("public"."is_admin_role"() OR ("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "documents"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "documents"."company_id") AND ("actor"."account_status" = 'active'::"text")))) OR (("lower"(COALESCE("status", ''::"text")) = 'approved'::"text") AND ("final_file_path" IS NOT NULL)))) WITH CHECK (("public"."is_admin_role"() OR (("auth"."uid"() = "user_id") AND (("company_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "documents"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "documents"."company_id") AND ("actor"."account_status" = 'active'::"text")))))) OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "documents"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "documents"."company_id") AND ("actor"."account_status" = 'active'::"text"))))));



CREATE POLICY "documents_select_company_scope" ON "public"."documents" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "documents_update_company_scope" ON "public"."documents" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."employee_document_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_document_signatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_pay_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_time_card_payroll" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_time_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_time_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gus_generated_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gus_generated_plans_insert_scope" ON "public"."gus_generated_plans" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gus_planning_sessions" "session"
  WHERE (("session"."id" = "gus_generated_plans"."session_id") AND (NOT ("gus_generated_plans"."company_id" IS DISTINCT FROM "session"."company_id")) AND (NOT ("gus_generated_plans"."jobsite_id" IS DISTINCT FROM "session"."jobsite_id")) AND ("public"."is_admin_role"() OR (("session"."company_id" IS NOT NULL) AND "public"."security_can_write_company_data"("session"."company_id") AND "public"."security_has_jobsite_access"("session"."company_id", "session"."jobsite_id") AND (("gus_generated_plans"."created_by" IS NULL) OR ("gus_generated_plans"."created_by" = "auth"."uid"()) OR "public"."security_is_company_manager"("session"."company_id"))) OR (("session"."company_id" IS NULL) AND ("session"."user_id" = "auth"."uid"()) AND (("gus_generated_plans"."created_by" IS NULL) OR ("gus_generated_plans"."created_by" = "auth"."uid"()))))))));



CREATE POLICY "gus_generated_plans_select_scope" ON "public"."gus_generated_plans" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gus_planning_sessions" "session"
  WHERE (("session"."id" = "gus_generated_plans"."session_id") AND ("public"."is_admin_role"() OR (("session"."company_id" IS NOT NULL) AND "public"."security_is_company_member"("session"."company_id") AND "public"."security_has_jobsite_access"("session"."company_id", "session"."jobsite_id")) OR (("session"."company_id" IS NULL) AND ("session"."user_id" = "auth"."uid"())))))));



CREATE POLICY "gus_generated_plans_update_scope" ON "public"."gus_generated_plans" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gus_planning_sessions" "session"
  WHERE (("session"."id" = "gus_generated_plans"."session_id") AND ("public"."is_admin_role"() OR (("session"."company_id" IS NOT NULL) AND "public"."security_is_company_member"("session"."company_id") AND "public"."security_has_jobsite_access"("session"."company_id", "session"."jobsite_id")) OR (("session"."company_id" IS NULL) AND ("session"."user_id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gus_planning_sessions" "session"
  WHERE (("session"."id" = "gus_generated_plans"."session_id") AND (NOT ("gus_generated_plans"."company_id" IS DISTINCT FROM "session"."company_id")) AND (NOT ("gus_generated_plans"."jobsite_id" IS DISTINCT FROM "session"."jobsite_id")) AND ("public"."is_admin_role"() OR (("session"."company_id" IS NOT NULL) AND "public"."security_can_write_company_data"("session"."company_id") AND "public"."security_has_jobsite_access"("session"."company_id", "session"."jobsite_id")) OR (("session"."company_id" IS NULL) AND ("session"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."gus_planning_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gus_planning_messages_insert_scope" ON "public"."gus_planning_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gus_planning_sessions" "session"
  WHERE (("session"."id" = "gus_planning_messages"."session_id") AND ("public"."is_admin_role"() OR (("session"."company_id" IS NOT NULL) AND "public"."security_can_write_company_data"("session"."company_id") AND "public"."security_has_jobsite_access"("session"."company_id", "session"."jobsite_id")) OR (("session"."company_id" IS NULL) AND ("session"."user_id" = "auth"."uid"())))))));



CREATE POLICY "gus_planning_messages_select_scope" ON "public"."gus_planning_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gus_planning_sessions" "session"
  WHERE (("session"."id" = "gus_planning_messages"."session_id") AND ("public"."is_admin_role"() OR (("session"."company_id" IS NOT NULL) AND "public"."security_is_company_member"("session"."company_id") AND "public"."security_has_jobsite_access"("session"."company_id", "session"."jobsite_id")) OR (("session"."company_id" IS NULL) AND ("session"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."gus_planning_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gus_planning_sessions_insert_scope" ON "public"."gus_planning_sessions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (("company_id" IS NOT NULL) AND "public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id") AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()) OR "public"."security_is_company_manager"("company_id"))) OR (("company_id" IS NULL) AND ("user_id" = "auth"."uid"()))));



CREATE POLICY "gus_planning_sessions_select_scope" ON "public"."gus_planning_sessions" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (("company_id" IS NOT NULL) AND "public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")) OR (("company_id" IS NULL) AND ("user_id" = "auth"."uid"()))));



CREATE POLICY "gus_planning_sessions_update_scope" ON "public"."gus_planning_sessions" FOR UPDATE TO "authenticated" USING (("public"."is_admin_role"() OR (("company_id" IS NOT NULL) AND "public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")) OR (("company_id" IS NULL) AND ("user_id" = "auth"."uid"())))) WITH CHECK (("public"."is_admin_role"() OR (("company_id" IS NOT NULL) AND "public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id") AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()) OR "public"."security_is_company_manager"("company_id"))) OR (("company_id" IS NULL) AND ("user_id" = "auth"."uid"()))));



ALTER TABLE "public"."hazard_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hazard_categories_delete_company_scope" ON "public"."hazard_categories" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "hazard_categories_insert_company_scope" ON "public"."hazard_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "hazard_categories_select_company_scope" ON "public"."hazard_categories" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "hazard_categories_update_company_scope" ON "public"."hazard_categories" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."hr_document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incident_notification_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incident_notification_deliveries_select_scope" ON "public"."incident_notification_deliveries" FOR SELECT TO "authenticated" USING ((("recipient_user_id" = "auth"."uid"()) OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "incident_notification_deliveries"."company_id") AND ("actor"."status" = 'active'::"text") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "incident_notification_deliveries"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"])))))));



ALTER TABLE "public"."incident_root_causes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incident_root_causes_delete_company_scope" ON "public"."incident_root_causes" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "incident_root_causes_insert_company_scope" ON "public"."incident_root_causes" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "incident_root_causes_select_company_scope" ON "public"."incident_root_causes" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "incident_root_causes_update_company_scope" ON "public"."incident_root_causes" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."incidents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incidents_delete_company_scope" ON "public"."incidents" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "incidents_insert_company_scope" ON "public"."incidents" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "incidents_select_company_scope" ON "public"."incidents" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "incidents_update_company_scope" ON "public"."incidents" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."ingestion_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ingestion_audit_log_delete_manager_scope" ON "public"."ingestion_audit_log" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "ingestion_audit_log_insert_company_scope" ON "public"."ingestion_audit_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "ingestion_audit_log_select_manager_scope" ON "public"."ingestion_audit_log" FOR SELECT TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "ingestion_audit_log_update_company_scope" ON "public"."ingestion_audit_log" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."injury_forecast_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "injury_forecast_audit_log_insert_admin_scope" ON "public"."injury_forecast_audit_log" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_role"() OR (("company_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "injury_forecast_audit_log"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'admin'::"text", 'super_admin'::"text", 'platform_admin'::"text"])) AND ("actor"."account_status" = 'active'::"text")))))));



CREATE POLICY "injury_forecast_audit_log_select_scope" ON "public"."injury_forecast_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (("company_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "injury_forecast_audit_log"."company_id"))))) OR (("company_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "injury_forecast_audit_log"."company_id") AND ("actor"."account_status" = 'active'::"text")))))));



ALTER TABLE "public"."injury_weather_backtest_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "injury_weather_backtest_runs_select_admin" ON "public"."injury_weather_backtest_runs" FOR SELECT TO "authenticated" USING ("public"."is_admin_role"());



ALTER TABLE "public"."injury_weather_daily_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "injury_weather_daily_snapshots_select_admin_only" ON "public"."injury_weather_daily_snapshots" FOR SELECT TO "authenticated" USING ("public"."is_admin_role"());



ALTER TABLE "public"."internal_jobsite_audits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_jobsite_audits_insert_admin" ON "public"."internal_jobsite_audits" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by_user_id") AND "public"."is_admin_role"()));



CREATE POLICY "internal_jobsite_audits_select_admin" ON "public"."internal_jobsite_audits" FOR SELECT TO "authenticated" USING ("public"."is_admin_role"());



ALTER TABLE "public"."jobsite_contractor_training_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobsite_contractor_training_requirements_company_scope" ON "public"."jobsite_contractor_training_requirements" TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."company_id" = "jobsite_contractor_training_requirements"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "r"
  WHERE (("r"."user_id" = "auth"."uid"()) AND ("r"."company_id" = "jobsite_contractor_training_requirements"."company_id")))))) WITH CHECK (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."company_id" = "jobsite_contractor_training_requirements"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "r"
  WHERE (("r"."user_id" = "auth"."uid"()) AND ("r"."company_id" = "jobsite_contractor_training_requirements"."company_id"))))));



ALTER TABLE "public"."jobsite_rule_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobsite_rule_overrides_delete_manager_scope" ON "public"."jobsite_rule_overrides" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "jobsite_rule_overrides_insert_manager_scope" ON "public"."jobsite_rule_overrides" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "jobsite_rule_overrides_select_member_scope" ON "public"."jobsite_rule_overrides" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "jobsite_rule_overrides_update_manager_scope" ON "public"."jobsite_rule_overrides" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."jobsite_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobsite_users_delete_company_scope" ON "public"."jobsite_users" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "jobsite_users_insert_company_scope" ON "public"."jobsite_users" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "jobsite_users_select_company_scope" ON "public"."jobsite_users" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "jobsite_users_update_company_scope" ON "public"."jobsite_users" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."jobsite_weather_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobsite_weather_subscriptions_delete_scope" ON "public"."jobsite_weather_subscriptions" FOR DELETE TO "authenticated" USING (("public"."security_is_company_manager"("company_id") OR (("user_id" = "auth"."uid"()) AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))));



CREATE POLICY "jobsite_weather_subscriptions_insert_scope" ON "public"."jobsite_weather_subscriptions" FOR INSERT TO "authenticated" WITH CHECK ((("public"."security_is_company_manager"("company_id") OR ("user_id" = "auth"."uid"())) AND "public"."security_has_jobsite_access"("company_id", "jobsite_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "jobsite_weather_subscriptions"."jobsite_id") AND ("jobsite"."company_id" = "jobsite_weather_subscriptions"."company_id"))))));



CREATE POLICY "jobsite_weather_subscriptions_select_scope" ON "public"."jobsite_weather_subscriptions" FOR SELECT TO "authenticated" USING (("public"."security_is_company_manager"("company_id") OR (("user_id" = "auth"."uid"()) AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))));



CREATE POLICY "jobsite_weather_subscriptions_update_scope" ON "public"."jobsite_weather_subscriptions" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_manager"("company_id") OR (("user_id" = "auth"."uid"()) AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")))) WITH CHECK ((("public"."security_is_company_manager"("company_id") OR ("user_id" = "auth"."uid"())) AND "public"."security_has_jobsite_access"("company_id", "jobsite_id") AND (EXISTS ( SELECT 1
   FROM "public"."company_jobsites" "jobsite"
  WHERE (("jobsite"."id" = "jobsite_weather_subscriptions"."jobsite_id") AND ("jobsite"."company_id" = "jobsite_weather_subscriptions"."company_id"))))));



ALTER TABLE "public"."jobsites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobsites_delete_company_scope" ON "public"."jobsites" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "jobsites_insert_company_scope" ON "public"."jobsites" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "jobsites_select_company_scope" ON "public"."jobsites" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "jobsites_update_company_scope" ON "public"."jobsites" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."library_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "library_categories_select_authenticated" ON "public"."library_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "library_delete_admin" ON "public"."library_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



ALTER TABLE "public"."library_document_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "library_document_tags_select_authenticated" ON "public"."library_document_tags" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."library_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "library_insert_admin" ON "public"."library_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "library_select_authenticated" ON "public"."library_documents" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."library_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "library_tags_select_authenticated" ON "public"."library_tags" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."marketplace_document_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_document_purchases_select_company_scope" ON "public"."marketplace_document_purchases" FOR SELECT TO "authenticated" USING ("public"."billing_user_can_access_company"("company_id"));



ALTER TABLE "public"."observation_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "observation_photos_delete_company_scope" ON "public"."observation_photos" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "observation_photos_insert_company_scope" ON "public"."observation_photos" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "observation_photos_select_company_scope" ON "public"."observation_photos" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "observation_photos_update_company_scope" ON "public"."observation_photos" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."observations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "observations_delete_company_scope" ON "public"."observations" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "observations_insert_company_scope" ON "public"."observations" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "observations_select_company_scope" ON "public"."observations" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "observations_update_company_scope" ON "public"."observations" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."osha_predictability_baselines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permit_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permit_types_delete_company_scope" ON "public"."permit_types" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "permit_types_insert_company_scope" ON "public"."permit_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "permit_types_select_company_scope" ON "public"."permit_types" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "permit_types_update_company_scope" ON "public"."permit_types" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."permits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permits_delete_company_scope" ON "public"."permits" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "permits_insert_company_scope" ON "public"."permits" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "permits_select_company_scope" ON "public"."permits" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "permits_update_company_scope" ON "public"."permits" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."peshep_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_conflict_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_conflict_rules_select_all" ON "public"."platform_conflict_rules" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_job_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_job_runs_no_authenticated_access" ON "public"."platform_job_runs" TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."platform_jurisdiction_standard_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_jurisdiction_standard_mappings_select_all" ON "public"."platform_jurisdiction_standard_mappings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_jurisdiction_standard_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_jurisdiction_standard_overrides_select_all" ON "public"."platform_jurisdiction_standard_overrides" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_jurisdiction_standards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_jurisdiction_standards_select_all" ON "public"."platform_jurisdiction_standards" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_jurisdictions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_jurisdictions_select_all" ON "public"."platform_jurisdictions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_major_construction_fatality_incident_controls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_major_construction_fatality_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_permit_trigger_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_permit_trigger_rules_select_all" ON "public"."platform_permit_trigger_rules" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_predictability_aggregates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_rule_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_rule_templates_select_all" ON "public"."platform_rule_templates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_settings_insert_admin" ON "public"."platform_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_role"());



CREATE POLICY "platform_settings_select_admin" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING ("public"."is_admin_role"());



CREATE POLICY "platform_settings_update_admin" ON "public"."platform_settings" FOR UPDATE TO "authenticated" USING ("public"."is_admin_role"()) WITH CHECK ("public"."is_admin_role"());



ALTER TABLE "public"."platform_sub_trades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_sub_trades_select_all" ON "public"."platform_sub_trades" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_task_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_task_templates_select_all" ON "public"."platform_task_templates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_trades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_trades_select_all" ON "public"."platform_trades" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pmcfi_select_all" ON "public"."platform_major_construction_fatality_incidents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pmcfic_select_all" ON "public"."platform_major_construction_fatality_incident_controls" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."pshsep_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pshsep_attachments_delete_own" ON "public"."pshsep_attachments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pshsep_attachments_insert_own" ON "public"."pshsep_attachments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "pshsep_attachments_select_own" ON "public"."pshsep_attachments" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."pshsep_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pshsep_drafts_delete_own" ON "public"."pshsep_drafts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pshsep_drafts_insert_own" ON "public"."pshsep_drafts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "pshsep_drafts_select_own" ON "public"."pshsep_drafts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pshsep_drafts_update_own" ON "public"."pshsep_drafts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."pshsep_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pshsep_submissions_insert_own" ON "public"."pshsep_submissions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "pshsep_submissions_select_own" ON "public"."pshsep_submissions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."report_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_snapshots_delete_company_scope" ON "public"."report_snapshots" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "report_snapshots_insert_company_scope" ON "public"."report_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "report_snapshots_select_company_scope" ON "public"."report_snapshots" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "report_snapshots_update_company_scope" ON "public"."report_snapshots" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."risk_baseline_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "risk_baseline_profiles_select_all" ON "public"."risk_baseline_profiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."safety_data_bucket" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "safety_data_bucket_delete_manager_scope" ON "public"."safety_data_bucket" FOR DELETE TO "authenticated" USING ("public"."security_can_manage_safety_intelligence"("company_id"));



CREATE POLICY "safety_data_bucket_insert_company_scope" ON "public"."safety_data_bucket" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "safety_data_bucket_select_company_scope" ON "public"."safety_data_bucket" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "safety_data_bucket_update_manager_scope" ON "public"."safety_data_bucket" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_manage_safety_intelligence"("company_id"));



ALTER TABLE "public"."safety_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "safety_scores_delete_company_scope" ON "public"."safety_scores" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "safety_scores_insert_company_scope" ON "public"."safety_scores" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "safety_scores_select_company_scope" ON "public"."safety_scores" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "safety_scores_update_company_scope" ON "public"."safety_scores" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."sif_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sif_reviews_delete_company_scope" ON "public"."sif_reviews" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "sif_reviews_insert_company_scope" ON "public"."sif_reviews" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "sif_reviews_select_company_scope" ON "public"."sif_reviews" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "sif_reviews_update_company_scope" ON "public"."sif_reviews" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "sor_admin_supersede_locked" ON "public"."company_sor_records" FOR UPDATE TO "authenticated" USING ((("status" = ANY (ARRAY['submitted'::"text", 'locked'::"text"])) AND ("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_sor_records"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'admin'::"text", 'super_admin'::"text", 'platform_admin'::"text"])) AND ("actor"."account_status" = 'active'::"text"))))))) WITH CHECK (("status" = ANY (ARRAY['submitted'::"text", 'locked'::"text", 'superseded'::"text"])));



ALTER TABLE "public"."sor_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sor_audit_log_select_company_scope" ON "public"."sor_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "sor_audit_log"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "sor_audit_log"."company_id") AND ("actor"."account_status" = 'active'::"text"))))));



CREATE POLICY "sor_insert_company_scope" ON "public"."company_sor_records" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_sor_records"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_sor_records"."company_id") AND ("actor"."account_status" = 'active'::"text")))))));



CREATE POLICY "sor_select_company_scope" ON "public"."company_sor_records" FOR SELECT TO "authenticated" USING (("public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_sor_records"."company_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "company_sor_records"."company_id") AND ("actor"."account_status" = 'active'::"text"))))));



CREATE POLICY "sor_update_own_draft_only" ON "public"."company_sor_records" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("status" = 'draft'::"text"))) WITH CHECK ((("created_by" = "auth"."uid"()) AND ("status" = 'draft'::"text")));



ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "submissions_admin_all" ON "public"."user_submissions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "submissions_insert_own" ON "public"."user_submissions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "submissions_select_approved" ON "public"."user_submissions" FOR SELECT TO "authenticated" USING (("status" = 'approved'::"text"));



CREATE POLICY "submissions_select_own" ON "public"."user_submissions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "submissions_update_own_or_admin" ON "public"."submissions" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin_role"())) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin_role"()));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_select_own" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."time_card_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_card_role_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_card_role_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_card_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_card_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_expiration_deliveries_select_scope" ON "public"."training_expiration_notification_deliveries" FOR SELECT TO "authenticated" USING ((("recipient_user_id" = "auth"."uid"()) OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "training_expiration_notification_deliveries"."company_id") AND ("actor"."status" = 'active'::"text") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "actor"
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."company_id" = "training_expiration_notification_deliveries"."company_id") AND ("actor"."role" = ANY (ARRAY['company_admin'::"text", 'manager'::"text", 'safety_manager'::"text"])))))));



ALTER TABLE "public"."training_expiration_notification_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_agreements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_dashboard_layouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_dashboard_layouts_delete_self" ON "public"."user_dashboard_layouts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_dashboard_layouts_insert_self" ON "public"."user_dashboard_layouts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_dashboard_layouts_select_self" ON "public"."user_dashboard_layouts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_dashboard_layouts_update_self" ON "public"."user_dashboard_layouts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_onboarding_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_onboarding_state_delete_self" ON "public"."user_onboarding_state" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_onboarding_state_insert_self" ON "public"."user_onboarding_state" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_onboarding_state_select_self" ON "public"."user_onboarding_state" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_onboarding_state_update_self" ON "public"."user_onboarding_state" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_insert_self" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM ("public"."company_memberships" "actor"
     JOIN "public"."company_memberships" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("target"."user_id" = "user_profiles"."user_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "actor"
     JOIN "public"."user_roles" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("actor"."company_id" IS NOT NULL) AND ("target"."user_id" = "user_profiles"."user_id"))))));



CREATE POLICY "user_profiles_select_self_or_admin" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM ("public"."company_memberships" "actor"
     JOIN "public"."company_memberships" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("target"."user_id" = "user_profiles"."user_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "actor"
     JOIN "public"."user_roles" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("actor"."company_id" IS NOT NULL) AND ("target"."user_id" = "user_profiles"."user_id"))))));



CREATE POLICY "user_profiles_update_self" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM ("public"."company_memberships" "actor"
     JOIN "public"."company_memberships" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("target"."user_id" = "user_profiles"."user_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "actor"
     JOIN "public"."user_roles" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("actor"."company_id" IS NOT NULL) AND ("target"."user_id" = "user_profiles"."user_id")))))) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin_role"() OR (EXISTS ( SELECT 1
   FROM ("public"."company_memberships" "actor"
     JOIN "public"."company_memberships" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("target"."user_id" = "user_profiles"."user_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "actor"
     JOIN "public"."user_roles" "target" ON (("target"."company_id" = "actor"."company_id")))
  WHERE (("actor"."user_id" = "auth"."uid"()) AND ("actor"."role" = 'company_admin'::"text") AND ("actor"."company_id" IS NOT NULL) AND ("target"."user_id" = "user_profiles"."user_id"))))));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_delete_company_scope" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "user_roles_insert_company_scope" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."security_can_write_company_data"("company_id"));



CREATE POLICY "user_roles_select_company_scope" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."security_is_company_member"("company_id"));



CREATE POLICY "user_roles_update_company_scope" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."security_is_company_member"("company_id")) WITH CHECK ("public"."security_can_write_company_data"("company_id"));



ALTER TABLE "public"."user_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can create own peshep submissions" ON "public"."peshep_submissions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can create own submissions" ON "public"."submissions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can view own peshep submissions" ON "public"."peshep_submissions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can view own submissions" ON "public"."submissions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."weather_alert_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weather_alert_events_select_scope" ON "public"."weather_alert_events" FOR SELECT TO "authenticated" USING ("public"."security_has_jobsite_access"("company_id", "jobsite_id"));



ALTER TABLE "public"."weather_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weather_logs_delete_company_scope" ON "public"."weather_logs" FOR DELETE TO "authenticated" USING (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "weather_logs_insert_company_scope" ON "public"."weather_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "weather_logs_select_company_scope" ON "public"."weather_logs" FOR SELECT TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



CREATE POLICY "weather_logs_update_company_scope" ON "public"."weather_logs" FOR UPDATE TO "authenticated" USING (("public"."security_is_company_member"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))) WITH CHECK (("public"."security_can_write_company_data"("company_id") AND "public"."security_has_jobsite_access"("company_id", "jobsite_id")));



ALTER TABLE "public"."weather_notification_deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weather_notification_deliveries_select_scope" ON "public"."weather_notification_deliveries" FOR SELECT TO "authenticated" USING (("public"."security_is_company_manager"("company_id") OR (("user_id" = "auth"."uid"()) AND "public"."security_has_jobsite_access"("company_id", "jobsite_id"))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_company_users"("target_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_company_users"("target_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_workspace_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_workspace_users"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."billing_generate_invoice_number"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."billing_generate_invoice_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."billing_is_super_platform"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."billing_is_super_platform"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_is_super_platform"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."billing_staff_can_mutate_company"("target_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."billing_staff_can_mutate_company"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_staff_can_mutate_company"("target_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."billing_user_can_access_company"("target_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."billing_user_can_access_company"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."billing_user_can_access_company"("target_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_approved_company_owner"("approved_email" "text", "approved_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_approved_company_owner"("approved_email" "text", "approved_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."claim_approved_company_owner"("approved_email" "text", "approved_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."consume_company_invite"("invite_email" "text", "invited_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_company_invite"("invite_email" "text", "invited_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."consume_company_invite"("invite_email" "text", "invited_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_company_invite"("invite_email" "text", "invited_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_company_workspace"("p_company_name" "text", "p_industry" "text", "p_phone" "text", "p_website" "text", "p_address_line_1" "text", "p_city" "text", "p_state_region" "text", "p_postal_code" "text", "p_country" "text", "p_plan_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_company_workspace"("p_company_name" "text", "p_industry" "text", "p_phone" "text", "p_website" "text", "p_address_line_1" "text", "p_city" "text", "p_state_region" "text", "p_postal_code" "text", "p_country" "text", "p_plan_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_company_workspace"("p_company_name" "text", "p_industry" "text", "p_phone" "text", "p_website" "text", "p_address_line_1" "text", "p_city" "text", "p_state_region" "text", "p_postal_code" "text", "p_country" "text", "p_plan_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_app_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_company_finance_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_company_finance_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_company_finance_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_company_portal_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_company_portal_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_company_portal_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_company_portal_employee"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_company_portal_employee"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_company_portal_employee"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_company_portal_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_company_portal_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_company_portal_owner"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lookup_company_invite"("invite_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lookup_company_invite"("invite_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lookup_my_company_signup_request"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lookup_my_company_signup_request"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_company_memory_items"("p_company_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_company_memory_items"("p_company_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_company_memory_items"("p_company_id" "uuid", "p_query_embedding" "public"."vector", "p_match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_legacy_rbac_role"("raw_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_legacy_rbac_role"("raw_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_legacy_rbac_role"("raw_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_legacy_rbac_role"("raw_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."platform_performance_snapshot"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."platform_performance_snapshot"() TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_marketplace_purchase"("p_document_id" "uuid", "p_amount" integer, "p_description" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_marketplace_purchase"("p_document_id" "uuid", "p_amount" integer, "p_description" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."security_can_manage_safety_intelligence"("target_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."security_can_manage_safety_intelligence"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_can_manage_safety_intelligence"("target_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."security_can_mutate_company_memory"("target_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."security_can_mutate_company_memory"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_can_mutate_company_memory"("target_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."security_can_mutate_company_training_requirements"("target_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."security_can_mutate_company_training_requirements"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_can_mutate_company_training_requirements"("target_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."security_can_submit_company_field_audit"("target_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."security_can_submit_company_field_audit"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_can_submit_company_field_audit"("target_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."security_can_write_company_data"("target_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."security_can_write_company_data"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_can_write_company_data"("target_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."security_has_jobsite_access"("target_company_id" "uuid", "target_jobsite_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."security_has_jobsite_access"("target_company_id" "uuid", "target_jobsite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_has_jobsite_access"("target_company_id" "uuid", "target_jobsite_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."security_is_company_manager"("target_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."security_is_company_manager"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_is_company_manager"("target_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."security_is_company_member"("target_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."security_is_company_member"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."security_is_company_member"("target_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."si_bump_generated_document_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."si_bump_generated_document_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."si_bump_generated_document_version"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."si_log_history"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."si_log_history"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."si_store_generated_document_version"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."si_store_generated_document_version"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sor_audit_log_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sor_audit_log_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sor_guard_locked_rows"() TO "anon";
GRANT ALL ON FUNCTION "public"."sor_guard_locked_rows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sor_guard_locked_rows"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sor_prevent_hard_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."sor_prevent_hard_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sor_prevent_hard_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sor_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."sor_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sor_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_company_invite"("invite_email" "text", "invite_role" "text", "invite_team" "text", "invite_company_id" "uuid", "invite_account_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_company_invite"("invite_email" "text", "invite_role" "text", "invite_team" "text", "invite_company_id" "uuid", "invite_account_status" "text") TO "service_role";



GRANT ALL ON TABLE "public"."ai_call_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_call_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_call_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_call_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_engine_recommendation_snapshots" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_engine_recommendation_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_engine_recommendation_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_engine_recommendation_snapshots_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_output_feedback" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_output_feedback_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_output_feedback_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_output_feedback_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_visual_generation_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."behavior_risk_events" TO "anon";
GRANT ALL ON TABLE "public"."behavior_risk_events" TO "authenticated";
GRANT ALL ON TABLE "public"."behavior_risk_events" TO "service_role";



GRANT ALL ON TABLE "public"."billing_customers" TO "anon";
GRANT ALL ON TABLE "public"."billing_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_customers" TO "service_role";



GRANT ALL ON TABLE "public"."billing_events" TO "anon";
GRANT ALL ON TABLE "public"."billing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_events" TO "service_role";



GRANT ALL ON TABLE "public"."billing_invoice_counters" TO "anon";
GRANT ALL ON TABLE "public"."billing_invoice_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_invoice_counters" TO "service_role";



GRANT ALL ON TABLE "public"."billing_invoice_line_items" TO "anon";
GRANT ALL ON TABLE "public"."billing_invoice_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_invoice_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."billing_invoice_payments" TO "anon";
GRANT ALL ON TABLE "public"."billing_invoice_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_invoice_payments" TO "service_role";



GRANT ALL ON TABLE "public"."billing_invoices" TO "anon";
GRANT ALL ON TABLE "public"."billing_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."billing_staff_company_assignments" TO "anon";
GRANT ALL ON TABLE "public"."billing_staff_company_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_staff_company_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."client_onboarding_items" TO "anon";
GRANT ALL ON TABLE "public"."client_onboarding_items" TO "authenticated";
GRANT ALL ON TABLE "public"."client_onboarding_items" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_ai_reviews" TO "anon";
GRANT ALL ON TABLE "public"."company_ai_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."company_ai_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."company_analytics_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."company_analytics_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."company_analytics_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."company_audit_customer_locations" TO "anon";
GRANT ALL ON TABLE "public"."company_audit_customer_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."company_audit_customer_locations" TO "service_role";



GRANT ALL ON TABLE "public"."company_audit_customers" TO "anon";
GRANT ALL ON TABLE "public"."company_audit_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."company_audit_customers" TO "service_role";



GRANT ALL ON TABLE "public"."company_auditflow_assignments" TO "anon";
GRANT ALL ON TABLE "public"."company_auditflow_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."company_auditflow_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."company_auditflow_corrective_action_links" TO "anon";
GRANT ALL ON TABLE "public"."company_auditflow_corrective_action_links" TO "authenticated";
GRANT ALL ON TABLE "public"."company_auditflow_corrective_action_links" TO "service_role";



GRANT ALL ON TABLE "public"."company_auditflow_submissions" TO "anon";
GRANT ALL ON TABLE "public"."company_auditflow_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_auditflow_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."company_auditflow_template_versions" TO "anon";
GRANT ALL ON TABLE "public"."company_auditflow_template_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_auditflow_template_versions" TO "service_role";



GRANT ALL ON TABLE "public"."company_auditflow_templates" TO "anon";
GRANT ALL ON TABLE "public"."company_auditflow_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."company_auditflow_templates" TO "service_role";



GRANT ALL ON TABLE "public"."company_bucket_items" TO "anon";
GRANT ALL ON TABLE "public"."company_bucket_items" TO "authenticated";
GRANT ALL ON TABLE "public"."company_bucket_items" TO "service_role";



GRANT ALL ON TABLE "public"."company_bucket_runs" TO "anon";
GRANT ALL ON TABLE "public"."company_bucket_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."company_bucket_runs" TO "service_role";



GRANT ALL ON TABLE "public"."company_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."company_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."company_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."company_clients" TO "anon";
GRANT ALL ON TABLE "public"."company_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."company_clients" TO "service_role";



GRANT ALL ON TABLE "public"."company_conflict_pairs" TO "anon";
GRANT ALL ON TABLE "public"."company_conflict_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."company_conflict_pairs" TO "service_role";



GRANT ALL ON TABLE "public"."company_conflict_rules" TO "anon";
GRANT ALL ON TABLE "public"."company_conflict_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."company_conflict_rules" TO "service_role";



GRANT ALL ON TABLE "public"."company_contractor_documents" TO "anon";
GRANT ALL ON TABLE "public"."company_contractor_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."company_contractor_documents" TO "service_role";



GRANT ALL ON TABLE "public"."company_contractor_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."company_contractor_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."company_contractor_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."company_contractors" TO "anon";
GRANT ALL ON TABLE "public"."company_contractors" TO "authenticated";
GRANT ALL ON TABLE "public"."company_contractors" TO "service_role";



GRANT ALL ON TABLE "public"."company_controls" TO "anon";
GRANT ALL ON TABLE "public"."company_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."company_controls" TO "service_role";



GRANT ALL ON TABLE "public"."company_corrective_action_events" TO "anon";
GRANT ALL ON TABLE "public"."company_corrective_action_events" TO "authenticated";
GRANT ALL ON TABLE "public"."company_corrective_action_events" TO "service_role";



GRANT ALL ON TABLE "public"."company_corrective_action_evidence" TO "anon";
GRANT ALL ON TABLE "public"."company_corrective_action_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."company_corrective_action_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."company_corrective_actions" TO "anon";
GRANT ALL ON TABLE "public"."company_corrective_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_corrective_actions" TO "service_role";



GRANT ALL ON TABLE "public"."company_credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."company_credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."company_crews" TO "anon";
GRANT ALL ON TABLE "public"."company_crews" TO "authenticated";
GRANT ALL ON TABLE "public"."company_crews" TO "service_role";



GRANT ALL ON TABLE "public"."company_jsa_activities" TO "anon";
GRANT ALL ON TABLE "public"."company_jsa_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jsa_activities" TO "service_role";



GRANT ALL ON TABLE "public"."company_dap_activities" TO "anon";
GRANT ALL ON TABLE "public"."company_dap_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."company_dap_activities" TO "service_role";



GRANT ALL ON TABLE "public"."company_jsas" TO "anon";
GRANT ALL ON TABLE "public"."company_jsas" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jsas" TO "service_role";



GRANT ALL ON TABLE "public"."company_daps" TO "anon";
GRANT ALL ON TABLE "public"."company_daps" TO "authenticated";
GRANT ALL ON TABLE "public"."company_daps" TO "service_role";



GRANT ALL ON TABLE "public"."company_data_requests" TO "anon";
GRANT ALL ON TABLE "public"."company_data_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."company_data_requests" TO "service_role";



GRANT ALL ON TABLE "public"."company_document_requirements" TO "anon";
GRANT ALL ON TABLE "public"."company_document_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."company_document_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."company_document_templates" TO "anon";
GRANT ALL ON TABLE "public"."company_document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."company_document_templates" TO "service_role";



GRANT ALL ON TABLE "public"."company_documents" TO "anon";
GRANT ALL ON TABLE "public"."company_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."company_documents" TO "service_role";



GRANT ALL ON TABLE "public"."company_employee_jobsite_assignments" TO "anon";
GRANT ALL ON TABLE "public"."company_employee_jobsite_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."company_employee_jobsite_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."company_employee_profiles" TO "anon";
GRANT ALL ON TABLE "public"."company_employee_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_employee_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."company_employee_training_records" TO "anon";
GRANT ALL ON TABLE "public"."company_employee_training_records" TO "authenticated";
GRANT ALL ON TABLE "public"."company_employee_training_records" TO "service_role";



GRANT ALL ON TABLE "public"."company_finance_authorized_users" TO "anon";
GRANT ALL ON TABLE "public"."company_finance_authorized_users" TO "authenticated";
GRANT ALL ON TABLE "public"."company_finance_authorized_users" TO "service_role";



GRANT ALL ON TABLE "public"."company_finance_budgets" TO "anon";
GRANT ALL ON TABLE "public"."company_finance_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."company_finance_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."company_finance_receipts" TO "anon";
GRANT ALL ON TABLE "public"."company_finance_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."company_finance_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."company_finance_recurring_items" TO "anon";
GRANT ALL ON TABLE "public"."company_finance_recurring_items" TO "authenticated";
GRANT ALL ON TABLE "public"."company_finance_recurring_items" TO "service_role";



GRANT ALL ON TABLE "public"."company_finance_transactions" TO "anon";
GRANT ALL ON TABLE "public"."company_finance_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_finance_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."company_generated_document_versions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."company_generated_document_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_generated_document_versions" TO "service_role";



GRANT ALL ON TABLE "public"."company_generated_documents" TO "anon";
GRANT ALL ON TABLE "public"."company_generated_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."company_generated_documents" TO "service_role";



GRANT ALL ON TABLE "public"."company_hazards" TO "anon";
GRANT ALL ON TABLE "public"."company_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."company_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."company_hris_roster_imports" TO "anon";
GRANT ALL ON TABLE "public"."company_hris_roster_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."company_hris_roster_imports" TO "service_role";



GRANT ALL ON TABLE "public"."company_incidents" TO "anon";
GRANT ALL ON TABLE "public"."company_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."company_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."company_induction_completions" TO "anon";
GRANT ALL ON TABLE "public"."company_induction_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_induction_completions" TO "service_role";



GRANT ALL ON TABLE "public"."company_induction_programs" TO "anon";
GRANT ALL ON TABLE "public"."company_induction_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."company_induction_programs" TO "service_role";



GRANT ALL ON TABLE "public"."company_induction_requirements" TO "anon";
GRANT ALL ON TABLE "public"."company_induction_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."company_induction_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."company_inspection_calendar_signoffs" TO "anon";
GRANT ALL ON TABLE "public"."company_inspection_calendar_signoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."company_inspection_calendar_signoffs" TO "service_role";



GRANT ALL ON TABLE "public"."company_integration_webhook_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."company_integration_webhook_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."company_integration_webhook_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."company_integration_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."company_integration_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."company_integration_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."company_invites" TO "anon";
GRANT ALL ON TABLE "public"."company_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."company_invites" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_assignments" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_audit_observation_evidence" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_audit_observation_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_audit_observation_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_audit_observations" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_audit_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_audit_observations" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_audit_report_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_audit_report_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_audit_report_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_audit_signoffs" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_audit_signoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_audit_signoffs" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_audits" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_audits" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_chemicals" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_chemicals" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_chemicals" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_daily_todos" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_daily_todos" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_daily_todos" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_schedule_items" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_schedule_items" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_schedule_items" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_site_blueprints" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_site_blueprints" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_site_blueprints" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_site_maps" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_site_maps" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_site_maps" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_site_renders" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_site_renders" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_site_renders" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsite_visual_zones" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsite_visual_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsite_visual_zones" TO "service_role";



GRANT ALL ON TABLE "public"."company_jobsites" TO "anon";
GRANT ALL ON TABLE "public"."company_jobsites" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jobsites" TO "service_role";



GRANT ALL ON TABLE "public"."company_jsa_signoffs" TO "anon";
GRANT ALL ON TABLE "public"."company_jsa_signoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."company_jsa_signoffs" TO "service_role";



GRANT ALL ON TABLE "public"."company_leadership_safety_scores" TO "anon";
GRANT ALL ON TABLE "public"."company_leadership_safety_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."company_leadership_safety_scores" TO "service_role";



GRANT ALL ON TABLE "public"."company_legal_issues" TO "anon";
GRANT ALL ON TABLE "public"."company_legal_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."company_legal_issues" TO "service_role";



GRANT ALL ON TABLE "public"."company_memberships" TO "anon";
GRANT ALL ON TABLE "public"."company_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."company_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."company_memory_items" TO "anon";
GRANT ALL ON TABLE "public"."company_memory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."company_memory_items" TO "service_role";



GRANT ALL ON TABLE "public"."company_mobile_feature_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."company_mobile_feature_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."company_mobile_feature_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."company_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."company_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."company_notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."company_notifications" TO "anon";
GRANT ALL ON TABLE "public"."company_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."company_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."company_onboarding_imports" TO "anon";
GRANT ALL ON TABLE "public"."company_onboarding_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."company_onboarding_imports" TO "service_role";



GRANT ALL ON TABLE "public"."company_operations_records" TO "anon";
GRANT ALL ON TABLE "public"."company_operations_records" TO "authenticated";
GRANT ALL ON TABLE "public"."company_operations_records" TO "service_role";



GRANT ALL ON TABLE "public"."company_permit_trigger_rules" TO "anon";
GRANT ALL ON TABLE "public"."company_permit_trigger_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."company_permit_trigger_rules" TO "service_role";



GRANT ALL ON TABLE "public"."company_permits" TO "anon";
GRANT ALL ON TABLE "public"."company_permits" TO "authenticated";
GRANT ALL ON TABLE "public"."company_permits" TO "service_role";



GRANT ALL ON TABLE "public"."company_permits_catalog" TO "anon";
GRANT ALL ON TABLE "public"."company_permits_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."company_permits_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."company_positions" TO "anon";
GRANT ALL ON TABLE "public"."company_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_positions" TO "service_role";



GRANT ALL ON TABLE "public"."company_report_attachments" TO "anon";
GRANT ALL ON TABLE "public"."company_report_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."company_report_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."company_reports" TO "anon";
GRANT ALL ON TABLE "public"."company_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."company_reports" TO "service_role";



GRANT ALL ON TABLE "public"."company_risk_ai_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."company_risk_ai_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."company_risk_ai_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."company_risk_events" TO "anon";
GRANT ALL ON TABLE "public"."company_risk_events" TO "authenticated";
GRANT ALL ON TABLE "public"."company_risk_events" TO "service_role";



GRANT ALL ON TABLE "public"."company_risk_memory_facets" TO "anon";
GRANT ALL ON TABLE "public"."company_risk_memory_facets" TO "authenticated";
GRANT ALL ON TABLE "public"."company_risk_memory_facets" TO "service_role";



GRANT ALL ON TABLE "public"."company_risk_memory_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."company_risk_memory_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."company_risk_memory_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."company_risk_recommendation_events" TO "anon";
GRANT ALL ON TABLE "public"."company_risk_recommendation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."company_risk_recommendation_events" TO "service_role";



GRANT ALL ON TABLE "public"."company_risk_scores" TO "anon";
GRANT ALL ON TABLE "public"."company_risk_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."company_risk_scores" TO "service_role";



GRANT ALL ON TABLE "public"."company_rule_overrides" TO "anon";
GRANT ALL ON TABLE "public"."company_rule_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."company_rule_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."company_safety_form_definitions" TO "anon";
GRANT ALL ON TABLE "public"."company_safety_form_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_safety_form_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."company_safety_form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."company_safety_form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_safety_form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."company_safety_form_versions" TO "anon";
GRANT ALL ON TABLE "public"."company_safety_form_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_safety_form_versions" TO "service_role";



GRANT ALL ON TABLE "public"."company_safety_intelligence_audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."company_safety_intelligence_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."company_safety_intelligence_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."company_safety_intelligence_history" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."company_safety_intelligence_history" TO "authenticated";
GRANT ALL ON TABLE "public"."company_safety_intelligence_history" TO "service_role";



GRANT ALL ON TABLE "public"."company_safety_submissions" TO "anon";
GRANT ALL ON TABLE "public"."company_safety_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_safety_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."company_sales_activities" TO "anon";
GRANT ALL ON TABLE "public"."company_sales_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."company_sales_activities" TO "service_role";



GRANT ALL ON TABLE "public"."company_schedule_prediction_cache" TO "anon";
GRANT ALL ON TABLE "public"."company_schedule_prediction_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."company_schedule_prediction_cache" TO "service_role";



GRANT ALL ON TABLE "public"."company_security_events" TO "anon";
GRANT ALL ON TABLE "public"."company_security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."company_security_events" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."company_signup_requests" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."company_signup_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."company_signup_requests" TO "service_role";



GRANT ALL ON TABLE "public"."company_simultaneous_operations" TO "anon";
GRANT ALL ON TABLE "public"."company_simultaneous_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."company_simultaneous_operations" TO "service_role";



GRANT ALL ON TABLE "public"."company_sor_records" TO "anon";
GRANT ALL ON TABLE "public"."company_sor_records" TO "authenticated";
GRANT ALL ON TABLE "public"."company_sor_records" TO "service_role";



GRANT ALL ON TABLE "public"."company_sub_trades" TO "anon";
GRANT ALL ON TABLE "public"."company_sub_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."company_sub_trades" TO "service_role";



GRANT ALL ON TABLE "public"."company_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."company_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."company_task_controls" TO "anon";
GRANT ALL ON TABLE "public"."company_task_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."company_task_controls" TO "service_role";



GRANT ALL ON TABLE "public"."company_task_hazards" TO "anon";
GRANT ALL ON TABLE "public"."company_task_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."company_task_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."company_task_permit_triggers" TO "anon";
GRANT ALL ON TABLE "public"."company_task_permit_triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."company_task_permit_triggers" TO "service_role";



GRANT ALL ON TABLE "public"."company_task_training_requirements" TO "anon";
GRANT ALL ON TABLE "public"."company_task_training_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."company_task_training_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."company_tasks" TO "anon";
GRANT ALL ON TABLE "public"."company_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."company_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."company_toolbox_attendees" TO "anon";
GRANT ALL ON TABLE "public"."company_toolbox_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."company_toolbox_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."company_toolbox_sessions" TO "anon";
GRANT ALL ON TABLE "public"."company_toolbox_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_toolbox_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."company_toolbox_templates" TO "anon";
GRANT ALL ON TABLE "public"."company_toolbox_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."company_toolbox_templates" TO "service_role";



GRANT ALL ON TABLE "public"."company_trades" TO "anon";
GRANT ALL ON TABLE "public"."company_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."company_trades" TO "service_role";



GRANT ALL ON TABLE "public"."company_training_matrix_requirements" TO "anon";
GRANT ALL ON TABLE "public"."company_training_matrix_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."company_training_matrix_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."company_training_requirements" TO "anon";
GRANT ALL ON TABLE "public"."company_training_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."company_training_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."company_users" TO "anon";
GRANT ALL ON TABLE "public"."company_users" TO "authenticated";
GRANT ALL ON TABLE "public"."company_users" TO "service_role";



GRANT ALL ON TABLE "public"."company_weather_conditions" TO "anon";
GRANT ALL ON TABLE "public"."company_weather_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_weather_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."company_work_areas" TO "anon";
GRANT ALL ON TABLE "public"."company_work_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."company_work_areas" TO "service_role";



GRANT ALL ON TABLE "public"."corrective_actions" TO "anon";
GRANT ALL ON TABLE "public"."corrective_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."corrective_actions" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_corrective_actions" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_corrective_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_corrective_actions" TO "service_role";



GRANT ALL ON TABLE "public"."daps" TO "anon";
GRANT ALL ON TABLE "public"."daps" TO "authenticated";
GRANT ALL ON TABLE "public"."daps" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_daps" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_daps" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_daps" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_documents" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_documents" TO "service_role";



GRANT ALL ON TABLE "public"."incidents" TO "anon";
GRANT ALL ON TABLE "public"."incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."incidents" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_incidents" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."jobsites" TO "anon";
GRANT ALL ON TABLE "public"."jobsites" TO "authenticated";
GRANT ALL ON TABLE "public"."jobsites" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_jobsites" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_jobsites" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_jobsites" TO "service_role";



GRANT ALL ON TABLE "public"."observations" TO "anon";
GRANT ALL ON TABLE "public"."observations" TO "authenticated";
GRANT ALL ON TABLE "public"."observations" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_observations" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_observations" TO "service_role";



GRANT ALL ON TABLE "public"."permits" TO "anon";
GRANT ALL ON TABLE "public"."permits" TO "authenticated";
GRANT ALL ON TABLE "public"."permits" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_permits" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_permits" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_permits" TO "service_role";



GRANT ALL ON TABLE "public"."daily_reports" TO "anon";
GRANT ALL ON TABLE "public"."daily_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_reports" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_reports" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_reports" TO "service_role";



GRANT ALL ON TABLE "public"."compat_company_users" TO "anon";
GRANT ALL ON TABLE "public"."compat_company_users" TO "authenticated";
GRANT ALL ON TABLE "public"."compat_company_users" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_employee_intake_tokens" TO "anon";
GRANT ALL ON TABLE "public"."contractor_employee_intake_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_employee_intake_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_employee_jobsite_assignments" TO "anon";
GRANT ALL ON TABLE "public"."contractor_employee_jobsite_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_employee_jobsite_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_employee_profiles" TO "anon";
GRANT ALL ON TABLE "public"."contractor_employee_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_employee_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_employee_training_records" TO "anon";
GRANT ALL ON TABLE "public"."contractor_employee_training_records" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_employee_training_records" TO "service_role";



GRANT ALL ON TABLE "public"."dap_activities" TO "anon";
GRANT ALL ON TABLE "public"."dap_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."dap_activities" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."demo_requests" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."demo_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_requests" TO "service_role";



GRANT ALL ON TABLE "public"."document_downloads" TO "anon";
GRANT ALL ON TABLE "public"."document_downloads" TO "authenticated";
GRANT ALL ON TABLE "public"."document_downloads" TO "service_role";



GRANT ALL ON TABLE "public"."document_versions" TO "anon";
GRANT ALL ON TABLE "public"."document_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."document_versions" TO "service_role";



GRANT ALL ON TABLE "public"."employee_document_assignments" TO "anon";
GRANT ALL ON TABLE "public"."employee_document_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_document_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."employee_document_signatures" TO "anon";
GRANT ALL ON TABLE "public"."employee_document_signatures" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_document_signatures" TO "service_role";



GRANT ALL ON TABLE "public"."employee_pay_rates" TO "anon";
GRANT ALL ON TABLE "public"."employee_pay_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_pay_rates" TO "service_role";



GRANT ALL ON TABLE "public"."employee_profiles" TO "anon";
GRANT ALL ON TABLE "public"."employee_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."employee_time_card_payroll" TO "anon";
GRANT ALL ON TABLE "public"."employee_time_card_payroll" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_time_card_payroll" TO "service_role";



GRANT ALL ON TABLE "public"."employee_time_cards" TO "anon";
GRANT ALL ON TABLE "public"."employee_time_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_time_cards" TO "service_role";



GRANT ALL ON TABLE "public"."employee_time_entries" TO "anon";
GRANT ALL ON TABLE "public"."employee_time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_time_entries" TO "service_role";



GRANT ALL ON TABLE "public"."gus_generated_plans" TO "anon";
GRANT ALL ON TABLE "public"."gus_generated_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."gus_generated_plans" TO "service_role";



GRANT ALL ON TABLE "public"."gus_planning_messages" TO "anon";
GRANT ALL ON TABLE "public"."gus_planning_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."gus_planning_messages" TO "service_role";



GRANT ALL ON TABLE "public"."gus_planning_sessions" TO "anon";
GRANT ALL ON TABLE "public"."gus_planning_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."gus_planning_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."hazard_categories" TO "anon";
GRANT ALL ON TABLE "public"."hazard_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."hazard_categories" TO "service_role";



GRANT ALL ON TABLE "public"."hr_document_templates" TO "anon";
GRANT ALL ON TABLE "public"."hr_document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_document_templates" TO "service_role";



GRANT ALL ON TABLE "public"."incident_notification_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."incident_notification_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."incident_notification_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."incident_root_causes" TO "anon";
GRANT ALL ON TABLE "public"."incident_root_causes" TO "authenticated";
GRANT ALL ON TABLE "public"."incident_root_causes" TO "service_role";



GRANT ALL ON TABLE "public"."ingestion_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."ingestion_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ingestion_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."injury_forecast_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."injury_forecast_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."injury_forecast_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."injury_weather_backtest_runs" TO "anon";
GRANT ALL ON TABLE "public"."injury_weather_backtest_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."injury_weather_backtest_runs" TO "service_role";



GRANT ALL ON TABLE "public"."injury_weather_daily_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."injury_weather_daily_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."injury_weather_daily_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."internal_jobsite_audits" TO "anon";
GRANT ALL ON TABLE "public"."internal_jobsite_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_jobsite_audits" TO "service_role";



GRANT ALL ON TABLE "public"."jobsite_contractor_training_requirements" TO "anon";
GRANT ALL ON TABLE "public"."jobsite_contractor_training_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."jobsite_contractor_training_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."jobsite_rule_overrides" TO "anon";
GRANT ALL ON TABLE "public"."jobsite_rule_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."jobsite_rule_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."jobsite_users" TO "anon";
GRANT ALL ON TABLE "public"."jobsite_users" TO "authenticated";
GRANT ALL ON TABLE "public"."jobsite_users" TO "service_role";



GRANT ALL ON TABLE "public"."jobsite_weather_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."jobsite_weather_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."jobsite_weather_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."legacy_rbac_cutover_audit" TO "service_role";



GRANT ALL ON TABLE "public"."library_categories" TO "anon";
GRANT ALL ON TABLE "public"."library_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."library_categories" TO "service_role";



GRANT ALL ON TABLE "public"."library_document_tags" TO "anon";
GRANT ALL ON TABLE "public"."library_document_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."library_document_tags" TO "service_role";



GRANT ALL ON TABLE "public"."library_documents" TO "anon";
GRANT ALL ON TABLE "public"."library_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."library_documents" TO "service_role";



GRANT ALL ON TABLE "public"."library_tags" TO "anon";
GRANT ALL ON TABLE "public"."library_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."library_tags" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_document_purchases" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_document_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_document_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."observation_photos" TO "anon";
GRANT ALL ON TABLE "public"."observation_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."observation_photos" TO "service_role";



GRANT ALL ON TABLE "public"."osha_predictability_baselines" TO "service_role";



GRANT ALL ON TABLE "public"."permit_types" TO "anon";
GRANT ALL ON TABLE "public"."permit_types" TO "authenticated";
GRANT ALL ON TABLE "public"."permit_types" TO "service_role";



GRANT ALL ON TABLE "public"."peshep_submissions" TO "anon";
GRANT ALL ON TABLE "public"."peshep_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."peshep_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_conflict_rules" TO "anon";
GRANT ALL ON TABLE "public"."platform_conflict_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_conflict_rules" TO "service_role";



GRANT ALL ON TABLE "public"."platform_job_runs" TO "service_role";



GRANT ALL ON TABLE "public"."platform_jurisdiction_standard_mappings" TO "anon";
GRANT ALL ON TABLE "public"."platform_jurisdiction_standard_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_jurisdiction_standard_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."platform_jurisdiction_standard_overrides" TO "anon";
GRANT ALL ON TABLE "public"."platform_jurisdiction_standard_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_jurisdiction_standard_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."platform_jurisdiction_standards" TO "anon";
GRANT ALL ON TABLE "public"."platform_jurisdiction_standards" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_jurisdiction_standards" TO "service_role";



GRANT ALL ON TABLE "public"."platform_jurisdictions" TO "anon";
GRANT ALL ON TABLE "public"."platform_jurisdictions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_jurisdictions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_major_construction_fatality_incident_controls" TO "anon";
GRANT ALL ON TABLE "public"."platform_major_construction_fatality_incident_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_major_construction_fatality_incident_controls" TO "service_role";



GRANT ALL ON TABLE "public"."platform_major_construction_fatality_incidents" TO "anon";
GRANT ALL ON TABLE "public"."platform_major_construction_fatality_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_major_construction_fatality_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."platform_permit_trigger_rules" TO "anon";
GRANT ALL ON TABLE "public"."platform_permit_trigger_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_permit_trigger_rules" TO "service_role";



GRANT ALL ON TABLE "public"."platform_predictability_aggregates" TO "service_role";



GRANT ALL ON TABLE "public"."platform_rule_templates" TO "anon";
GRANT ALL ON TABLE "public"."platform_rule_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_rule_templates" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."platform_sub_trades" TO "anon";
GRANT ALL ON TABLE "public"."platform_sub_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_sub_trades" TO "service_role";



GRANT ALL ON TABLE "public"."platform_task_templates" TO "anon";
GRANT ALL ON TABLE "public"."platform_task_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_task_templates" TO "service_role";



GRANT ALL ON TABLE "public"."platform_trades" TO "anon";
GRANT ALL ON TABLE "public"."platform_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_trades" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pshsep_attachments" TO "anon";
GRANT ALL ON TABLE "public"."pshsep_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."pshsep_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."pshsep_drafts" TO "anon";
GRANT ALL ON TABLE "public"."pshsep_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."pshsep_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."pshsep_submissions" TO "anon";
GRANT ALL ON TABLE "public"."pshsep_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."pshsep_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."report_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."report_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."report_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."risk_baseline_profiles" TO "anon";
GRANT ALL ON TABLE "public"."risk_baseline_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_baseline_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."safety_data_bucket" TO "anon";
GRANT ALL ON TABLE "public"."safety_data_bucket" TO "authenticated";
GRANT ALL ON TABLE "public"."safety_data_bucket" TO "service_role";



GRANT ALL ON TABLE "public"."safety_scores" TO "anon";
GRANT ALL ON TABLE "public"."safety_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."safety_scores" TO "service_role";



GRANT ALL ON TABLE "public"."sif_reviews" TO "anon";
GRANT ALL ON TABLE "public"."sif_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."sif_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."sor_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."sor_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sor_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."time_card_categories" TO "anon";
GRANT ALL ON TABLE "public"."time_card_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."time_card_categories" TO "service_role";



GRANT ALL ON TABLE "public"."time_card_role_categories" TO "anon";
GRANT ALL ON TABLE "public"."time_card_role_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."time_card_role_categories" TO "service_role";



GRANT ALL ON TABLE "public"."time_card_role_tasks" TO "anon";
GRANT ALL ON TABLE "public"."time_card_role_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."time_card_role_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."time_card_roles" TO "anon";
GRANT ALL ON TABLE "public"."time_card_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."time_card_roles" TO "service_role";



GRANT ALL ON TABLE "public"."time_card_tasks" TO "anon";
GRANT ALL ON TABLE "public"."time_card_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."time_card_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."training_expiration_notification_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."training_expiration_notification_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."training_expiration_notification_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."user_agreements" TO "anon";
GRANT ALL ON TABLE "public"."user_agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_agreements" TO "service_role";



GRANT ALL ON TABLE "public"."user_dashboard_layouts" TO "anon";
GRANT ALL ON TABLE "public"."user_dashboard_layouts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_dashboard_layouts" TO "service_role";



GRANT ALL ON TABLE "public"."user_onboarding_state" TO "anon";
GRANT ALL ON TABLE "public"."user_onboarding_state" TO "authenticated";
GRANT ALL ON TABLE "public"."user_onboarding_state" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_submissions" TO "anon";
GRANT ALL ON TABLE "public"."user_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."weather_alert_events" TO "anon";
GRANT ALL ON TABLE "public"."weather_alert_events" TO "authenticated";
GRANT ALL ON TABLE "public"."weather_alert_events" TO "service_role";



GRANT ALL ON TABLE "public"."weather_logs" TO "anon";
GRANT ALL ON TABLE "public"."weather_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."weather_logs" TO "service_role";



GRANT ALL ON TABLE "public"."weather_notification_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."weather_notification_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."weather_notification_deliveries" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







