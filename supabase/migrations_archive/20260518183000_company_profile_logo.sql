alter table public.companies
add column if not exists logo_data_url text null,
add column if not exists logo_file_name text null;
