-- Primary body region affected (trade-specific patterns, training targeting).

alter table public.company_incidents
  add column if not exists body_part text null;

alter table public.company_incidents
  drop constraint if exists company_incidents_body_part_check;

alter table public.company_incidents
  add constraint company_incidents_body_part_check check (
    body_part is null
    or body_part in (
      'back',
      'hand',
      'fingers',
      'knee',
      'shoulder',
      'eye',
      'foot',
      'other'
    )
  );

comment on column public.company_incidents.body_part is
  'Primary body region for predictive / trade analytics. Null for non-injury categories or legacy rows.';

create index if not exists company_incidents_company_body_part_idx
  on public.company_incidents (company_id, body_part)
  where body_part is not null;
