-- Align company_incidents with analytics / reports queries that reference closed_at.
alter table public.company_incidents
  add column if not exists closed_at timestamptz null;

comment on column public.company_incidents.closed_at is
  'Timestamp when the incident was closed; null while open or in progress.';
