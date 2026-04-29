begin;

alter table public.company_jobsites
add column if not exists customer_company_name text null;

commit;
