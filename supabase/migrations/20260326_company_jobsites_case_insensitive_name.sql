alter table public.company_jobsites
drop constraint if exists company_jobsites_company_name_unique;

create unique index if not exists company_jobsites_company_name_unique_ci_idx
  on public.company_jobsites (company_id, lower(name));
