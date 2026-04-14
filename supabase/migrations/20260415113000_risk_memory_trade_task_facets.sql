-- Risk Memory hierarchy expansion: add sub-trade and task facet columns.

alter table public.company_risk_memory_facets
  add column if not exists sub_trade_code text null;

alter table public.company_risk_memory_facets
  add column if not exists task_code text null;

comment on column public.company_risk_memory_facets.sub_trade_code is
  'Optional shared taxonomy sub-trade code scoped under trade_code.';

comment on column public.company_risk_memory_facets.task_code is
  'Optional shared taxonomy task code scoped under trade_code and sub_trade_code.';
