alter table public.company_jobsite_audits
add column if not exists ai_review_id uuid null references public.company_ai_reviews(id) on delete set null,
add column if not exists ai_review_status text not null default 'not_started',
add column if not exists ai_review_summary jsonb not null default '{}'::jsonb;

alter table public.company_jobsite_audits
drop constraint if exists company_jobsite_audits_ai_review_status_check;

alter table public.company_jobsite_audits
add constraint company_jobsite_audits_ai_review_status_check check (
  ai_review_status in ('not_started', 'reviewed', 'fallback_reviewed', 'failed')
);

create index if not exists company_jobsite_audits_ai_review_idx
on public.company_jobsite_audits(company_id, ai_review_status, updated_at desc);
