alter table public.owner_manual_review_items
  add column if not exists status text not null default 'not_started',
  add column if not exists required boolean not null default true;

update public.owner_manual_review_items
set status = case when completed then 'passed' else 'not_started' end
where status is null
  or status not in ('not_started', 'passed', 'needs_review', 'failed');

alter table public.owner_manual_review_items
drop constraint if exists owner_manual_review_items_status_check;

alter table public.owner_manual_review_items
add constraint owner_manual_review_items_status_check
check (status in ('not_started', 'passed', 'needs_review', 'failed'));

create unique index if not exists owner_manual_review_items_module_item_uidx
  on public.owner_manual_review_items(module_key, checklist_item);
