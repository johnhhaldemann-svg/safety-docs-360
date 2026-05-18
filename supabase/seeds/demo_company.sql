-- Optional SQL seed for creating the Demo Construction workspace shell.
-- The application loader (`POST /api/demo/load`) performs the full data seed.

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
  demo_company,
  demo_seed_version,
  demo_seeded_at
)
values (
  'Demo Construction',
  'demo-construction-sql',
  'active',
  'Commercial construction',
  '555-0136',
  'https://example.com/demo-construction',
  '100 Demo Yard',
  'Austin',
  'TX',
  '78701',
  'USA',
  'Demo Safety Team',
  'demo@safety360docs.com',
  true,
  'demo-mode-v1',
  now()
)
on conflict (team_key) do update set
  name = excluded.name,
  status = excluded.status,
  industry = excluded.industry,
  phone = excluded.phone,
  website = excluded.website,
  address_line_1 = excluded.address_line_1,
  city = excluded.city,
  state_region = excluded.state_region,
  postal_code = excluded.postal_code,
  country = excluded.country,
  primary_contact_name = excluded.primary_contact_name,
  primary_contact_email = excluded.primary_contact_email,
  demo_company = true,
  demo_seed_version = excluded.demo_seed_version,
  demo_seeded_at = now(),
  updated_at = now();

insert into public.company_subscriptions (company_id, status, plan_name)
select id, 'active', 'Enterprise'
from public.companies
where team_key = 'demo-construction-sql'
  and demo_company = true
on conflict (company_id) do update set
  status = excluded.status,
  plan_name = excluded.plan_name,
  updated_at = now();

insert into public.company_jobsites (
  company_id,
  name,
  jobsite_number,
  project_number,
  location,
  status,
  project_manager,
  safety_lead,
  start_date,
  end_date,
  notes
)
select c.id, v.name, v.jobsite_number, v.project_number, v.location, v.status, v.project_manager, v.safety_lead, current_date + v.start_offset, current_date + v.end_offset, v.notes
from public.companies c
cross join (
  values
    ('LKC Phase 3', 'DEMO-LKC-03', 'DEMO-LKC-03', 'Austin, TX', 'active', 'Jordan Lee', 'Maria Chen', -42, 120, 'High-rise phase with steel erection, roofing, hot work, and crane picks.'),
    ('Hospital Expansion', 'DEMO-HOSP-02', 'DEMO-HOSP-02', 'San Antonio, TX', 'active', 'Nora Williams', 'Grace Kim', -18, 180, 'Occupied healthcare expansion with electrical, confined-space, and infection-control interfaces.'),
    ('Warehouse Buildout', 'DEMO-WH-11', 'DEMO-WH-11', 'Round Rock, TX', 'planned', 'Eli Brooks', 'Maria Chen', 7, 95, 'Warehouse fit-out with roofing, loading dock, and material-handling exposure.')
) as v(name, jobsite_number, project_number, location, status, project_manager, safety_lead, start_offset, end_offset, notes)
where c.team_key = 'demo-construction-sql'
  and c.demo_company = true
on conflict (company_id, name) do update set
  jobsite_number = excluded.jobsite_number,
  project_number = excluded.project_number,
  location = excluded.location,
  status = excluded.status,
  project_manager = excluded.project_manager,
  safety_lead = excluded.safety_lead,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  notes = excluded.notes,
  updated_at = now();
