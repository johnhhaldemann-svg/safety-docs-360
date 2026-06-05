alter table public.companies
  add column if not exists demo_company boolean not null default false,
  add column if not exists demo_seed_version text null,
  add column if not exists demo_seeded_at timestamptz null,
  add column if not exists demo_previous_company_id uuid null references public.companies(id) on delete set null;

create index if not exists companies_demo_company_idx
  on public.companies(demo_company, created_by, updated_at desc)
  where demo_company = true;

comment on column public.companies.demo_company is
  'True for isolated seeded demo workspaces. Production cleanup must never target rows unless this is true.';

comment on column public.companies.demo_previous_company_id is
  'Previous active company for the user who loaded this demo workspace, used by demo reset/restore flows.';
