alter table public.company_training_requirements
  add column if not exists training_delivery_type text null,
  add column if not exists training_resource_title text null,
  add column if not exists training_resource_url text null,
  add column if not exists training_resource_instructions text null,
  add constraint company_training_requirements_training_delivery_type_check check (
    training_delivery_type is null
    or training_delivery_type in ('online', 'internal')
  ) not valid;

alter table public.company_training_requirements
  validate constraint company_training_requirements_training_delivery_type_check;

comment on column public.company_training_requirements.training_delivery_type is
  'How an assigned worker should access this training: online external course or internal company/app page.';
comment on column public.company_training_requirements.training_resource_title is
  'Worker-facing label for the training resource sent with assignments.';
comment on column public.company_training_requirements.training_resource_url is
  'Validated assignment URL. Use https:// links or same-origin app paths such as /training/module.';
comment on column public.company_training_requirements.training_resource_instructions is
  'Optional worker-facing instructions included with assignment notifications.';
