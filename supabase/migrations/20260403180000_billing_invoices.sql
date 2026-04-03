-- Billing: customers, invoices, line items, payments, audit events, staff–company scope, invoice numbering.
-- Money fields are integer cents. Internal invoice records are the source of truth (Stripe IDs are optional).

-- ---------------------------------------------------------------------------
-- Staff may be limited to specific companies (role = admin). Super/platform see all.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_staff_company_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  unique (staff_user_id, company_id)
);

create index if not exists billing_staff_company_assignments_staff_idx
  on public.billing_staff_company_assignments (staff_user_id);

create index if not exists billing_staff_company_assignments_company_idx
  on public.billing_staff_company_assignments (company_id);

-- ---------------------------------------------------------------------------
-- Billing profile per company (one or more bill-to contacts).
-- ---------------------------------------------------------------------------
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  company_name text not null,
  billing_contact_name text null,
  billing_email text not null,
  billing_address_1 text null,
  billing_address_2 text null,
  city text null,
  state text null,
  zip text null,
  country text null default 'US',
  phone text null,
  tax_id text null,
  stripe_customer_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_customers_company_id_idx
  on public.billing_customers (company_id);

create index if not exists billing_customers_billing_email_idx
  on public.billing_customers (lower(billing_email));

drop trigger if exists set_billing_customers_updated_at on public.billing_customers;
create trigger set_billing_customers_updated_at
before update on public.billing_customers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Monotonic invoice number per calendar year (UTC).
-- ---------------------------------------------------------------------------
create table if not exists public.billing_invoice_counters (
  year int primary key,
  last_seq int not null default 0
);

create or replace function public.billing_generate_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.billing_generate_invoice_number() to service_role;
grant execute on function public.billing_generate_invoice_number() to authenticated;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.billing_customers (id) on delete restrict,
  company_id uuid not null references public.companies (id) on delete restrict,
  status text not null default 'draft',
  issue_date date not null default (timezone('utc', now()))::date,
  due_date date not null,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  amount_paid_cents bigint not null default 0,
  balance_due_cents bigint not null default 0,
  currency text not null default 'usd',
  notes text null,
  terms text null,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  sent_at timestamptz null,
  viewed_at timestamptz null,
  paid_at timestamptz null,
  voided_at timestamptz null,
  cancelled_at timestamptz null,
  payment_provider text null,
  payment_link text null,
  pdf_path text null,
  stripe_customer_id text null,
  stripe_invoice_id text null,
  stripe_checkout_session_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoices_status_check check (
    status in (
      'draft',
      'sent',
      'viewed',
      'partial',
      'paid',
      'overdue',
      'void',
      'cancelled'
    )
  ),
  constraint billing_invoices_money_nonneg check (
    subtotal_cents >= 0
    and tax_cents >= 0
    and discount_cents >= 0
    and total_cents >= 0
    and amount_paid_cents >= 0
    and balance_due_cents >= 0
  ),
  constraint billing_invoices_due_after_issue check (due_date >= issue_date)
);

create index if not exists billing_invoices_company_id_idx on public.billing_invoices (company_id);
create index if not exists billing_invoices_customer_id_idx on public.billing_invoices (customer_id);
create index if not exists billing_invoices_status_idx on public.billing_invoices (status);
create index if not exists billing_invoices_issue_date_idx on public.billing_invoices (issue_date desc);
create index if not exists billing_invoices_due_date_idx on public.billing_invoices (due_date);

drop trigger if exists set_billing_invoices_updated_at on public.billing_invoices;
create trigger set_billing_invoices_updated_at
before update on public.billing_invoices
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Line items
-- ---------------------------------------------------------------------------
create table if not exists public.billing_invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices (id) on delete cascade,
  sort_order int not null default 0,
  item_type text not null default 'custom',
  description text not null,
  quantity numeric(12, 4) not null default 1,
  unit_price_cents bigint not null,
  line_total_cents bigint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_line_items_type_check check (
    item_type in (
      'subscription',
      'document_review',
      'credit_pack',
      'consulting',
      'custom'
    )
  ),
  constraint billing_line_items_qty_positive check (quantity > 0),
  constraint billing_line_items_unit_nonneg check (unit_price_cents >= 0),
  constraint billing_line_items_line_nonneg check (line_total_cents >= 0)
);

create index if not exists billing_invoice_line_items_invoice_id_idx
  on public.billing_invoice_line_items (invoice_id, sort_order);

drop trigger if exists set_billing_invoice_line_items_updated_at on public.billing_invoice_line_items;
create trigger set_billing_invoice_line_items_updated_at
before update on public.billing_invoice_line_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table if not exists public.billing_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices (id) on delete cascade,
  payment_date date not null default (timezone('utc', now()))::date,
  amount_cents bigint not null,
  payment_method text not null default 'manual',
  external_payment_id text null,
  notes text null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint billing_payments_method_check check (
    payment_method in ('stripe', 'ach', 'check', 'cash', 'manual', 'other')
  ),
  constraint billing_payments_amount_positive check (amount_cents > 0)
);

create index if not exists billing_invoice_payments_invoice_id_idx
  on public.billing_invoice_payments (invoice_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit trail (append-only from app; no update/delete policies)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices (id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint billing_events_type_check check (
    event_type in (
      'created',
      'updated',
      'sent',
      'viewed',
      'reminder_sent',
      'payment_received',
      'marked_paid',
      'voided',
      'cancelled'
    )
  )
);

create index if not exists billing_events_invoice_id_idx
  on public.billing_events (invoice_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.billing_is_super_platform()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(ur.role, '') in ('super_admin', 'platform_admin')
    and coalesce(ur.account_status, 'active') = 'active'
  from public.user_roles ur
  where ur.user_id = auth.uid();
$$;

create or replace function public.billing_user_can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

create or replace function public.billing_staff_can_mutate_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

grant execute on function public.billing_is_super_platform() to authenticated;
grant execute on function public.billing_user_can_access_company(uuid) to authenticated;
grant execute on function public.billing_staff_can_mutate_company(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.billing_staff_company_assignments enable row level security;

drop policy if exists "billing_staff_assign_super_all" on public.billing_staff_company_assignments;
create policy "billing_staff_assign_super_all"
on public.billing_staff_company_assignments
for all
to authenticated
using (public.billing_is_super_platform())
with check (public.billing_is_super_platform());

alter table public.billing_customers enable row level security;

drop policy if exists "billing_customers_select" on public.billing_customers;
create policy "billing_customers_select"
on public.billing_customers
for select
to authenticated
using (public.billing_user_can_access_company(company_id));

drop policy if exists "billing_customers_mutate_staff" on public.billing_customers;
create policy "billing_customers_mutate_staff"
on public.billing_customers
for all
to authenticated
using (public.billing_staff_can_mutate_company(company_id))
with check (public.billing_staff_can_mutate_company(company_id));

alter table public.billing_invoices enable row level security;

drop policy if exists "billing_invoices_select" on public.billing_invoices;
create policy "billing_invoices_select"
on public.billing_invoices
for select
to authenticated
using (public.billing_user_can_access_company(company_id));

-- Inserts/updates: staff only (super/platform or assigned admin). Company members cannot mutate invoices via client.
drop policy if exists "billing_invoices_insert_staff" on public.billing_invoices;
create policy "billing_invoices_insert_staff"
on public.billing_invoices
for insert
to authenticated
with check (public.billing_staff_can_mutate_company(company_id));

drop policy if exists "billing_invoices_update_staff" on public.billing_invoices;
create policy "billing_invoices_update_staff"
on public.billing_invoices
for update
to authenticated
using (public.billing_staff_can_mutate_company(company_id))
with check (public.billing_staff_can_mutate_company(company_id));

drop policy if exists "billing_invoices_delete_staff" on public.billing_invoices;
create policy "billing_invoices_delete_staff"
on public.billing_invoices
for delete
to authenticated
using (public.billing_is_super_platform());

alter table public.billing_invoice_line_items enable row level security;

drop policy if exists "billing_line_items_select" on public.billing_invoice_line_items;
create policy "billing_line_items_select"
on public.billing_invoice_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_invoice_line_items.invoice_id
      and public.billing_user_can_access_company(i.company_id)
  )
);

drop policy if exists "billing_line_items_staff_all" on public.billing_invoice_line_items;
create policy "billing_line_items_staff_all"
on public.billing_invoice_line_items
for all
to authenticated
using (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_invoice_line_items.invoice_id
      and public.billing_staff_can_mutate_company(i.company_id)
  )
)
with check (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_invoice_line_items.invoice_id
      and public.billing_staff_can_mutate_company(i.company_id)
  )
);

alter table public.billing_invoice_payments enable row level security;

drop policy if exists "billing_payments_select" on public.billing_invoice_payments;
create policy "billing_payments_select"
on public.billing_invoice_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_invoice_payments.invoice_id
      and public.billing_user_can_access_company(i.company_id)
  )
);

drop policy if exists "billing_payments_staff_mutate" on public.billing_invoice_payments;
create policy "billing_payments_staff_mutate"
on public.billing_invoice_payments
for all
to authenticated
using (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_invoice_payments.invoice_id
      and public.billing_staff_can_mutate_company(i.company_id)
  )
)
with check (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_invoice_payments.invoice_id
      and public.billing_staff_can_mutate_company(i.company_id)
  )
);

alter table public.billing_events enable row level security;

drop policy if exists "billing_events_select" on public.billing_events;
create policy "billing_events_select"
on public.billing_events
for select
to authenticated
using (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_events.invoice_id
      and public.billing_user_can_access_company(i.company_id)
  )
);

drop policy if exists "billing_events_insert_staff" on public.billing_events;
create policy "billing_events_insert_staff"
on public.billing_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.billing_invoices i
    where i.id = billing_events.invoice_id
      and public.billing_staff_can_mutate_company(i.company_id)
  )
);

-- Counters: no direct client access
alter table public.billing_invoice_counters enable row level security;
