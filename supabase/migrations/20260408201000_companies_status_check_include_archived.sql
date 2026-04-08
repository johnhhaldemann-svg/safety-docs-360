-- Admin workspace approval/archive uses status='archived'; normalized schema only allowed
-- pending/approved/suspended. Extend check so approve (approved), archive (archived), restore (approved) work.
alter table public.companies
  drop constraint if exists companies_status_check;

alter table public.companies
  add constraint companies_status_check check (
    status in ('pending', 'approved', 'suspended', 'archived')
  );
