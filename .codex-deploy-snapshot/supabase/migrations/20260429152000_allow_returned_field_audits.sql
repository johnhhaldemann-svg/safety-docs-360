alter table public.company_jobsite_audits
drop constraint if exists company_jobsite_audits_status_check;

alter table public.company_jobsite_audits
add constraint company_jobsite_audits_status_check check (
  status in ('draft', 'pending_review', 'submitted', 'archived', 'returned')
);
