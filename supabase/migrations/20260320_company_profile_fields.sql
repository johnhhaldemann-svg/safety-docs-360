alter table public.companies
add column if not exists industry text null,
add column if not exists phone text null,
add column if not exists website text null,
add column if not exists address_line_1 text null,
add column if not exists city text null,
add column if not exists state_region text null,
add column if not exists postal_code text null,
add column if not exists country text null,
add column if not exists primary_contact_name text null,
add column if not exists primary_contact_email text null;
