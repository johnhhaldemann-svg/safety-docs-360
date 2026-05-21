alter table public.company_audit_customers
add column if not exists address_line1 text null,
add column if not exists address_line2 text null,
add column if not exists city text null,
add column if not exists state_region text null,
add column if not exists postal_code text null,
add column if not exists country text null;
